import type { FeatureCollection, Geometry } from "geojson";
import { bbox } from "@turf/turf";
import { z } from "zod";
import {
  isProviderEvidenceError,
  providerEvidenceErrorCode,
  type DataAccessSpikeGateway,
  type DatasetEvidence,
  type Position,
} from "./data-access-gateway";
import { queryableDatasetKeys, type DatasetKey, type QueryableDatasetKey } from "./dataset-catalog";

export type DetailedLayerState =
  | "returned"
  | "verified_empty"
  | "internal_reference_only"
  | "unavailable"
  | "timeout"
  | "provider_error";

export type DetailedLayerResult = {
  key: DatasetKey;
  state: DetailedLayerState;
  evidence: DatasetEvidence;
  geometry: FeatureCollection<Geometry> | null;
  message: string;
};

export type FastPropertyDetails = {
  status: "complete" | "partial";
  layers: DetailedLayerResult[];
  retrievedAt: string;
  durationMs: number;
  region: string;
  limitations: string[];
};

const requestSchema = z.object({
  mode: z.literal("detailed").optional(),
  addressId: z.string().trim().min(1).max(100),
  coordinates: z.tuple([
    z.number().min(160).max(180),
    z.number().min(-48).max(-33),
  ]),
}).strict();

const detailedDatasetKeys = [...queryableDatasetKeys, "culverts"] as const;

export type FastPropertyDetailsResponse =
  | { ok: true; status: 200; data: FastPropertyDetails }
  | { ok: false; status: 400; error: { code: "INVALID_REQUEST"; message: string } };

const inFlightDetailRequests = new Map<string, Promise<FastPropertyDetailsResponse>>();

export async function executeFastPropertyDetailsRequest(input: {
  body: unknown;
  gateway: DataAccessSpikeGateway;
  now?: () => Date;
  timeoutMs?: number;
  concurrency?: number;
}): Promise<FastPropertyDetailsResponse> {
  const key = JSON.stringify(input.body);
  const existing = inFlightDetailRequests.get(key);
  if (existing) return existing;
  const request = executeFastPropertyDetailsRequestUncoalesced(input);
  inFlightDetailRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlightDetailRequests.get(key) === request) inFlightDetailRequests.delete(key);
  }
}

async function executeFastPropertyDetailsRequestUncoalesced(input: {
  body: unknown;
  gateway: DataAccessSpikeGateway;
  now?: () => Date;
  timeoutMs?: number;
  concurrency?: number;
}): Promise<FastPropertyDetailsResponse> {
  const request = requestSchema.safeParse(input.body);
  if (!request.success) {
    return {
      ok: false,
      status: 400,
      error: { code: "INVALID_REQUEST", message: "Submit one selected address point." },
    };
  }

  const startedAt = performance.now();
  const retrievedAt = (input.now?.() ?? new Date()).toISOString();
  const timeoutMs = input.timeoutMs ?? 5_000;
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 4, 6));
  const parcelResult = await safeFindParcel(input.gateway, request.data.coordinates, timeoutMs);
  const envelope = parcelResult?.parcels[0]?.geometry
    ? parcelEnvelope(parcelResult.parcels[0].geometry)
    : pointEnvelope(request.data.coordinates);

  const layers: DetailedLayerResult[] = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < detailedDatasetKeys.length) {
      const key = detailedDatasetKeys[nextIndex++];
      layers.push(await queryLayer({ gateway: input.gateway, key, envelope, retrievedAt, timeoutMs }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, detailedDatasetKeys.length) }, worker));
  layers.sort((left, right) => detailedDatasetKeys.indexOf(left.key as (typeof detailedDatasetKeys)[number]) - detailedDatasetKeys.indexOf(right.key as (typeof detailedDatasetKeys)[number]));

  const failed = layers.filter(
    (layer) =>
      layer.state === "timeout" ||
      layer.state === "provider_error" ||
      (layer.state === "unavailable" && Boolean(layer.evidence.errorCode)),
  );
  return {
    ok: true,
    status: 200,
    data: {
      status: failed.length === 0 ? "complete" : "partial",
      layers,
      retrievedAt,
      durationMs: Math.round(performance.now() - startedAt),
      region: "New Zealand; provider coverage varies by territorial authority and dataset licence.",
      limitations: [
        "A verified empty response means no feature was returned for this bounded query; it does not prove that an asset or constraint is absent.",
        "Auckland Council and Watercare layers may be usable for internal reference only and are not clearance or consent evidence.",
        "Returned geometry is indicative mapped information and requires professional and on-site verification.",
      ],
    },
  };
}

async function queryLayer(input: {
  gateway: DataAccessSpikeGateway;
  key: DatasetKey;
  envelope: [number, number, number, number];
  retrievedAt: string;
  timeoutMs: number;
}): Promise<DetailedLayerResult> {
  const evidence = input.gateway.datasetEvidence(input.key, input.retrievedAt);
  const capability = input.gateway.datasetCapability(input.key);
  if (!capability.detailedQuery || !input.gateway.queryFeatures) {
    return unavailable(
      input.key,
      evidence,
      capability.reason ?? "This provider does not expose detailed geometry in the current adapter.",
    );
  }
  try {
    const geometry = await withTimeout(
      input.gateway.queryFeatures(input.key as QueryableDatasetKey, input.envelope),
      input.timeoutMs,
    );
    const internalReference = evidence.evidenceUse === "internal_reference";
    const featureCount = geometry.features.length;
    return {
      key: input.key,
      state: internalReference
        ? "internal_reference_only"
        : featureCount === 0
          ? "verified_empty"
          : "returned",
      evidence: {
        ...evidence,
        status: "success",
        featureCount,
        geometry: featureCount > 0 ? geometry : undefined,
        confidence: featureCount > 0 ? "limited" : "limited",
      },
      geometry: featureCount > 0 ? geometry : null,
      message: internalReference
        ? "Returned for internal reference only; do not treat this as report or clearance evidence."
        : featureCount > 0
          ? `Returned ${featureCount} mapped feature${featureCount === 1 ? "" : "s"}.`
          : "The provider verified an empty result for this bounded query.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED";
    const state: DetailedLayerState = message === "PROVIDER_TIMEOUT"
      ? "timeout"
      : isProviderEvidenceError(error)
        ? "provider_error"
        : "unavailable";
    return {
      key: input.key,
      state,
      evidence: {
        ...evidence,
        status: state === "unavailable" ? "unavailable" : "error",
        evidenceUse: "unavailable",
        confidence: "unavailable",
        errorCode: providerEvidenceErrorCode(error),
      },
      geometry: null,
      message: state === "timeout"
        ? "The provider timed out; no geometry was drawn. Retry is available."
        : "The provider returned an error; no geometry was drawn. Retry is available.",
    };
  }
}

function unavailable(key: DatasetKey, evidence: DatasetEvidence, message: string): DetailedLayerResult {
  return {
    key,
    state: "unavailable",
    evidence: { ...evidence, evidenceUse: "unavailable", confidence: "unavailable", reason: message },
    geometry: null,
    message,
  };
}

async function safeFindParcel(gateway: DataAccessSpikeGateway, coordinates: Position, timeoutMs: number) {
  try {
    return await withTimeout(gateway.findParcelsAt(coordinates), timeoutMs);
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function parcelEnvelope(geometry: Parameters<typeof bbox>[0]): [number, number, number, number] {
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = bbox(geometry);
  return [minLongitude, minLatitude, maxLongitude, maxLatitude];
}

function pointEnvelope([longitude, latitude]: Position): [number, number, number, number] {
  const delta = 0.0001;
  return [longitude - delta, latitude - delta, longitude + delta, latitude + delta];
}
