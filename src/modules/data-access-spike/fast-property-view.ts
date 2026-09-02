import { z } from "zod";
import type { FeatureCollection, Polygon } from "geojson";
import type {
  AddressMatch,
  AddressSearch,
} from "@/modules/address-search/address-search";
import type {
  DatasetEvidence,
  OfficialPropertyLayers,
  ParcelMatch,
} from "./data-access-gateway";
import { providerEvidenceErrorCode } from "./data-access-gateway";
import {
  DataAccessSpikeError,
  classifyBoundaryState,
  type BoundaryState,
} from "./run-data-access-spike";
import { normalizeAddressQuery } from "@/shared/text/normalize-address-query";
import { buildFastPoolGeometry } from "./fast-pool-placement";
import type { FastPropertyDetails } from "./execute-fast-property-details";

export const FAST_COMPACT_POOL = {
  id: "compact" as const,
  label: "Compact",
  lengthMetres: 6.5,
  widthMetres: 3,
};

export { FAST_POOL_CATALOGUE } from "./fast-pool-placement";

export function buildFastCompactPoolGeometry(
  center: [number, number],
): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: [buildFastPoolGeometry(center, 6.5, 3)],
  };
}

export type FastPropertyViewResult = {
  requestedAddress: string;
  resolvedAddress: AddressMatch;
  boundary: {
    state: BoundaryState | "loading";
    geometry: ParcelMatch["geometry"] | null;
    areaSquareMetres: number | null;
    parcelId: string | null;
  };
  aerial: {
    state: "loading" | "ready" | "unavailable" | "error";
    durationMs: number | null;
    attribution: { text: string; url: string } | null;
  };
  datasets: {
    address_resolution: DatasetEvidence;
    legal_parcel: DatasetEvidence | null;
    aerial_imagery: DatasetEvidence | null;
  };
  defaultPool: typeof FAST_COMPACT_POOL;
  progress: {
    address: "found";
    boundary: "loading" | "found" | "provisional" | "unavailable";
    aerial: "loading" | "ready" | "unavailable" | "error";
    detailedChecks: "not_loaded";
  };
  firstUsableViewStartedAt: string;
  fastPathDurationMs: number;
  detailedChecks?: FastPropertyDetails;
};

export type FastPropertyViewStage = Pick<
  FastPropertyViewResult,
  "boundary" | "aerial" | "datasets" | "progress" | "fastPathDurationMs"
>;

export type FastPropertyBoundaryData = {
  boundary: FastPropertyViewResult["boundary"];
  legalParcelEvidence: DatasetEvidence;
  progressBoundary: FastPropertyViewResult["progress"]["boundary"];
};

const addressSchema = z.string().trim().min(8).max(200);

export async function resolveFastPropertyAddress(input: {
  requestedAddress: string;
  selectedAddressId?: string;
  addressSearch: AddressSearch;
  propertyLayers: OfficialPropertyLayers;
  now?: () => Date;
}): Promise<FastPropertyViewResult> {
  const requestedAddress = addressSchema.parse(input.requestedAddress);
  const startedAt = (input.now?.() ?? new Date()).toISOString();
  const resolvedAddress = input.selectedAddressId
    ? await input.addressSearch.getById(input.selectedAddressId)
    : resolveAddress(
        await input.addressSearch.search(requestedAddress),
        requestedAddress,
      );
  if (!resolvedAddress) throw new DataAccessSpikeError("ADDRESS_NOT_FOUND");

  return {
    requestedAddress,
    resolvedAddress,
    boundary: {
      state: "loading",
      geometry: null,
      areaSquareMetres: null,
      parcelId: null,
    },
    aerial: {
      state: "loading",
      durationMs: null,
      attribution: null,
    },
    datasets: {
      address_resolution: input.propertyLayers.datasetEvidence(
        "address_resolution",
        startedAt,
      ),
      legal_parcel: null,
      aerial_imagery: null,
    },
    defaultPool: FAST_COMPACT_POOL,
    progress: {
      address: "found",
      boundary: "loading",
      aerial: "loading",
      detailedChecks: "not_loaded",
    },
    firstUsableViewStartedAt: startedAt,
    fastPathDurationMs: Math.round(performance.now()),
  };
}

export async function loadFastPropertyStages(input: {
  resolvedAddress: AddressMatch;
  propertyLayers: OfficialPropertyLayers;
  basemapApiKey?: string;
  initialBoundary?: FastPropertyBoundaryData;
  startedClock?: number;
  retrievedAt?: string;
}): Promise<FastPropertyViewStage> {
  const startedClock = input.startedClock ?? performance.now();
  const retrievedAt = input.retrievedAt ?? new Date().toISOString();
  const boundaryPromise = input.initialBoundary
    ? Promise.resolve(input.initialBoundary)
    : loadFastPropertyBoundary({
        resolvedAddress: input.resolvedAddress,
        propertyLayers: input.propertyLayers,
        retrievedAt,
      });
  const aerialPromise = Promise.allSettled([
    input.basemapApiKey
      ? input.propertyLayers.checkAerial(input.basemapApiKey)
      : Promise.reject(new Error("AERIAL_NOT_CONFIGURED")),
  ]).then(([outcome]) => outcome);
  const [boundaryData, aerialOutcome] = await Promise.all([
    boundaryPromise,
    aerialPromise,
  ]);
  const aerial =
    aerialOutcome.status === "fulfilled"
      ? {
          state: "ready" as const,
          durationMs: aerialOutcome.value.durationMs,
          attribution: aerialOutcome.value.attribution,
        }
      : {
          state:
            aerialOutcome.reason instanceof Error &&
            aerialOutcome.reason.message === "AERIAL_NOT_CONFIGURED"
              ? ("unavailable" as const)
              : ("error" as const),
          durationMs: null,
          attribution: null,
        };
  const aerialBase = input.propertyLayers.datasetEvidence(
    "aerial_imagery",
    retrievedAt,
  );
  const addressEvidence = input.propertyLayers.datasetEvidence(
    "address_resolution",
    retrievedAt,
  );
  const aerialEvidence =
    aerialOutcome.status === "fulfilled"
      ? {
          ...aerialBase,
          status: "available" as const,
          evidenceUse: "report_allowed" as const,
          confidence: "limited" as const,
          durationMs: aerialOutcome.value.durationMs,
          attribution: aerialOutcome.value.attribution,
        }
      : {
          ...aerialBase,
          status:
            aerial.state === "unavailable"
              ? ("unavailable" as const)
              : ("error" as const),
          evidenceUse: "unavailable" as const,
          confidence: "unavailable" as const,
          errorCode:
            aerial.state === "error"
              ? providerEvidenceErrorCode(aerialOutcome.reason)
              : undefined,
        };

  return {
    boundary: boundaryData.boundary,
    aerial,
    datasets: {
      address_resolution: addressEvidence,
      legal_parcel: boundaryData.legalParcelEvidence,
      aerial_imagery: aerialEvidence,
    },
    progress: {
      address: "found",
      boundary: boundaryData.progressBoundary,
      aerial: aerial.state,
      detailedChecks: "not_loaded",
    },
    fastPathDurationMs: Math.round(performance.now() - startedClock),
  };
}

export async function runFastPropertyView(input: {
  requestedAddress: string;
  selectedAddressId?: string;
  addressSearch: AddressSearch;
  propertyLayers: OfficialPropertyLayers;
  basemapApiKey?: string;
  now?: () => Date;
}): Promise<FastPropertyViewResult> {
  const startedClock = performance.now();
  const initial = await resolveFastPropertyAddress({
    requestedAddress: input.requestedAddress,
    selectedAddressId: input.selectedAddressId,
    addressSearch: input.addressSearch,
    propertyLayers: input.propertyLayers,
    now: input.now,
  });
  const stage = await loadFastPropertyStages({
    resolvedAddress: initial.resolvedAddress,
    propertyLayers: input.propertyLayers,
    basemapApiKey: input.basemapApiKey,
    initialBoundary:
      initial.datasets.legal_parcel === null
        ? undefined
        : {
            boundary: initial.boundary,
            legalParcelEvidence: initial.datasets.legal_parcel,
            progressBoundary: initial.progress.boundary,
          },
    startedClock,
    retrievedAt: initial.firstUsableViewStartedAt,
  });
  return { ...initial, ...stage };
}

async function loadFastPropertyBoundary(input: {
  resolvedAddress: AddressMatch;
  propertyLayers: OfficialPropertyLayers;
  retrievedAt: string;
}): Promise<FastPropertyBoundaryData> {
  const [boundaryOutcome] = await Promise.allSettled([
    input.propertyLayers.findParcelsAt(input.resolvedAddress.coordinates),
  ]);
  const parcels =
    boundaryOutcome.status === "fulfilled" ? boundaryOutcome.value.parcels : [];
  const legalParcelBase = input.propertyLayers.datasetEvidence(
    "legal_parcel",
    input.retrievedAt,
  );
  const legalParcelEvidence =
    boundaryOutcome.status === "fulfilled"
      ? {
          ...legalParcelBase,
          status: "success" as const,
          confidence:
            parcels.length === 1 ? ("high" as const) : ("limited" as const),
          featureCount: parcels.length,
        }
      : {
          ...legalParcelBase,
          status: "error" as const,
          evidenceUse: "unavailable" as const,
          confidence: "unavailable" as const,
          errorCode: providerEvidenceErrorCode(boundaryOutcome.reason),
        };
  const boundaryState: BoundaryState =
    boundaryOutcome.status === "rejected"
      ? "unavailable"
      : classifyBoundaryState(parcels);
  const parcel = parcels[0] ?? null;

  return {
    boundary: {
      state: boundaryState,
      geometry: parcel?.geometry ?? null,
      areaSquareMetres: parcel?.calculatedAreaSquareMetres ?? null,
      parcelId: parcel?.parcelId ?? null,
    },
    legalParcelEvidence,
    progressBoundary:
      boundaryState === "confirmed"
        ? "found"
        : boundaryState === "unavailable"
          ? "unavailable"
          : "provisional",
  };
}

function resolveAddress(
  matches: AddressMatch[],
  requestedAddress: string,
): AddressMatch {
  const normalized = normalizeAddressQuery(requestedAddress);
  const exact = matches.filter(
    (match) => normalizeAddressQuery(match.fullAddress) === normalized,
  );
  if (exact.length === 1) return exact[0];
  const options = (exact.length > 1 ? exact : matches).map(
    ({ addressId, fullAddress }) => ({ addressId, fullAddress }),
  );
  if (options.length > 1)
    throw new DataAccessSpikeError("ADDRESS_AMBIGUOUS", options);
  if (matches.length === 0) throw new DataAccessSpikeError("ADDRESS_NOT_FOUND");
  return matches[0];
}
