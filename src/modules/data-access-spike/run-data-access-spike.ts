import { bbox } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { z } from "zod";
import {
  datasetCatalog,
  datasetKeys,
  queryableDatasetKeys,
  type DatasetKey,
  type QueryableDatasetKey,
} from "./dataset-catalog";

export type Position = [longitude: number, latitude: number];

export interface CountResult {
  count: number;
  durationMs: number;
}

export interface DataAccessSpikeGateway {
  searchAddresses(requestedAddress: string): Promise<unknown>;
  findParcelsAt(position: Position): Promise<unknown>;
  countFeatures(
    dataset: QueryableDatasetKey,
    envelope: [number, number, number, number],
  ): Promise<CountResult>;
  checkAerial(apiKey: string): Promise<{ durationMs: number }>;
}

export class DataAccessSpikeError extends Error {
  constructor(
    readonly code:
      | "ADDRESS_NOT_FOUND"
      | "ADDRESS_AMBIGUOUS"
      | "PARCEL_NOT_FOUND"
      | "PARCEL_AMBIGUOUS"
      | "OUTSIDE_SUPPORTED_REGION"
      | "PROVIDER_RESPONSE_INVALID",
  ) {
    super(code);
    this.name = "DataAccessSpikeError";
  }
}

type DatasetObservation = {
  provider: string;
  dataset: string;
  status: "success" | "unavailable" | "error";
  licenceStatus: "permitted" | "conditional" | "unavailable";
  evidenceUse: "report_allowed" | "spike_only" | "unavailable";
  featureCount?: number;
  durationMs?: number;
  reason?: string;
  errorCode?: "PROVIDER_REQUEST_FAILED";
};

export interface DataAccessSpikeResult {
  requestedAddress: string;
  resolvedAddress: AddressMatch;
  addressAlternatives: AddressMatch[];
  parcel: ParcelMatch;
  parcelMatch: {
    status: "mapped_primary_parcel" | "containing_parcel_requires_confirmation";
    reasons: string[];
  };
  comparisonParcels: Array<{
    addressId: string;
    fullAddress: string;
    parcelId: string;
    appellation: string;
  }>;
  identityCheck: {
    exactAddressMatched: boolean;
    distinctFromAlternatives: boolean;
    duplicateParcelRowsRemoved: number;
  };
  datasets: Record<DatasetKey, DatasetObservation>;
  successfulDatasets: DatasetKey[];
  unavailableDatasets: DatasetKey[];
  reportEligibleDatasets: DatasetKey[];
  spikeOnlyDatasets: DatasetKey[];
  providerErrors: Array<{
    dataset: DatasetKey;
    code: "PROVIDER_REQUEST_FAILED";
  }>;
  generatedAt: string;
  blockers: string[];
}

type AddressMatch = {
  addressId: string;
  fullAddress: string;
  fullAddressNumber: string;
  unit: string | null;
  coordinates: Position;
};

type ParcelMatch = {
  parcelId: string;
  appellation: string;
  parcelIntent: string;
  landDistrict: string;
  titles: string[];
  surveyAreaSquareMetres: number | null;
  calculatedAreaSquareMetres: number | null;
  geometry: Polygon;
};

const addressInputSchema = z.string().trim().min(8).max(200);
const positionSchema = z.tuple([
  z.number().min(160).max(180),
  z.number().min(-48).max(-33),
]);
const addressCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.object({
          type: z.literal("Point"),
          coordinates: positionSchema,
        }),
        properties: z.object({
          address_id: z.union([z.string(), z.number()]),
          full_address: z.string(),
          full_address_number: z.string(),
          unit: z.string().nullable().optional(),
          territorial_authority: z.string(),
          address_lifecycle: z.string(),
        }),
      }),
    )
    .max(20),
});
const parcelCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.object({
          type: z.literal("Polygon"),
          coordinates: z
            .array(z.array(positionSchema).min(4).max(5_000))
            .min(1)
            .max(100),
        }),
        properties: z.object({
          id: z.union([z.string(), z.number()]),
          appellation: z.string(),
          parcel_intent: z.string(),
          land_district: z.string(),
          titles: z.string().nullable(),
          survey_area: z.number().nullable(),
          calc_area: z.number().nullable(),
        }),
      }),
    )
    .max(20),
});

export async function runDataAccessSpike(input: {
  requestedAddress: string;
  gateway: DataAccessSpikeGateway;
  basemapApiKey?: string;
  now?: () => Date;
}): Promise<DataAccessSpikeResult> {
  const requestedAddress = addressInputSchema.parse(input.requestedAddress);
  const addressResponse = parseProviderResponse(
    addressCollectionSchema,
    await input.gateway.searchAddresses(requestedAddress),
  );
  const addressMatches = addressResponse.features.map<AddressMatch>(
    (feature) => ({
      addressId: String(feature.properties.address_id),
      fullAddress: feature.properties.full_address,
      fullAddressNumber: feature.properties.full_address_number,
      unit: feature.properties.unit ?? null,
      coordinates: feature.geometry.coordinates,
    }),
  );

  const exactMatches = addressMatches.filter(
    (candidate) =>
      normalizeAddress(candidate.fullAddress) ===
      normalizeAddress(requestedAddress),
  );
  if (exactMatches.length === 0) {
    throw new DataAccessSpikeError("ADDRESS_NOT_FOUND");
  }
  if (exactMatches.length > 1) {
    throw new DataAccessSpikeError("ADDRESS_AMBIGUOUS");
  }

  const resolvedAddress = exactMatches[0];
  const resolvedFeature = addressResponse.features.find(
    (feature) =>
      String(feature.properties.address_id) === resolvedAddress.addressId,
  );
  if (resolvedFeature?.properties.territorial_authority !== "Auckland") {
    throw new DataAccessSpikeError("OUTSIDE_SUPPORTED_REGION");
  }

  const resolvedParcelResponse = parseProviderResponse(
    parcelCollectionSchema,
    await input.gateway.findParcelsAt(resolvedAddress.coordinates),
  );
  const resolvedParcels = deduplicateParcels(resolvedParcelResponse.features);
  const parcel = requireSingleParcel(resolvedParcels.parcels);
  const parcelMatch = assessParcelMatch(resolvedAddress, parcel);

  const addressAlternatives = addressMatches.filter(
    (candidate) => candidate.addressId !== resolvedAddress.addressId,
  );
  const comparisonParcels = await Promise.all(
    addressAlternatives.slice(0, 5).map(async (alternative) => {
      const response = parseProviderResponse(
        parcelCollectionSchema,
        await input.gateway.findParcelsAt(alternative.coordinates),
      );
      const comparison = requireSingleParcel(
        deduplicateParcels(response.features).parcels,
      );
      return {
        addressId: alternative.addressId,
        fullAddress: alternative.fullAddress,
        parcelId: comparison.parcelId,
        appellation: comparison.appellation,
      };
    }),
  );

  const envelope = bbox(parcel.geometry) as [number, number, number, number];
  const datasetEntries = await Promise.all(
    queryableDatasetKeys.map(async (key) => {
      const catalog = datasetCatalog[key];
      try {
        const result = await input.gateway.countFeatures(key, envelope);
        return [
          key,
          {
            provider: catalog.provider,
            dataset: catalog.dataset,
            status: "success",
            licenceStatus: catalog.licenceStatus,
            evidenceUse:
              catalog.licenceStatus === "permitted"
                ? "report_allowed"
                : "spike_only",
            featureCount: result.count,
            durationMs: result.durationMs,
          } satisfies DatasetObservation,
        ] as const;
      } catch {
        return [
          key,
          {
            provider: catalog.provider,
            dataset: catalog.dataset,
            status: "error",
            licenceStatus: catalog.licenceStatus,
            evidenceUse: "unavailable",
            errorCode: "PROVIDER_REQUEST_FAILED",
          } satisfies DatasetObservation,
        ] as const;
      }
    }),
  );

  const datasets = Object.fromEntries(datasetEntries) as Record<
    DatasetKey,
    DatasetObservation
  >;
  datasets.address_resolution = {
    provider: "LINZ",
    dataset: "NZ Addresses",
    status: "success",
    licenceStatus: "permitted",
    evidenceUse: "report_allowed",
    featureCount: addressMatches.length,
  };
  datasets.legal_parcel = {
    provider: "LINZ",
    dataset: "NZ Primary Parcels",
    status: "success",
    licenceStatus: "permitted",
    evidenceUse: "report_allowed",
    featureCount: 1,
  };
  datasets.aerial_imagery = await observeAerial(
    input.gateway,
    input.basemapApiKey,
  );
  datasets.wastewater_assets = unavailableWatercare("Wastewater assets");
  datasets.public_water_assets = unavailableWatercare("Public water assets");
  datasets.culverts = {
    provider: "Auckland Council",
    dataset: "Culverts",
    status: "unavailable",
    licenceStatus: "unavailable",
    evidenceUse: "unavailable",
    reason: "No dedicated official culvert endpoint was verified in this spike",
  };

  const successfulDatasets = datasetKeys.filter(
    (key) => datasets[key].status === "success",
  );
  const unavailableDatasets = datasetKeys.filter(
    (key) => datasets[key].status === "unavailable",
  );
  const reportEligibleDatasets = datasetKeys.filter(
    (key) =>
      datasets[key].status === "success" &&
      datasets[key].evidenceUse === "report_allowed",
  );
  const spikeOnlyDatasets = datasetKeys.filter(
    (key) =>
      datasets[key].status === "success" &&
      datasets[key].evidenceUse === "spike_only",
  );
  const providerErrors = datasetKeys.flatMap((key) =>
    datasets[key].status === "error"
      ? [{ dataset: key, code: "PROVIDER_REQUEST_FAILED" as const }]
      : [],
  );
  const distinctFromAlternatives = comparisonParcels.every(
    (comparison) => comparison.parcelId !== parcel.parcelId,
  );

  return {
    requestedAddress,
    resolvedAddress,
    addressAlternatives,
    parcel,
    parcelMatch,
    comparisonParcels,
    identityCheck: {
      exactAddressMatched: true,
      distinctFromAlternatives,
      duplicateParcelRowsRemoved: resolvedParcels.duplicatesRemoved,
    },
    datasets,
    successfulDatasets,
    unavailableDatasets,
    reportEligibleDatasets,
    spikeOnlyDatasets,
    providerErrors,
    generatedAt: (input.now?.() ?? new Date()).toISOString(),
    blockers: [
      ...(datasets.aerial_imagery.status === "success"
        ? []
        : [
            "Real aerial map not verified: LINZ Basemaps access is unavailable",
          ]),
      ...(parcelMatch.status === "mapped_primary_parcel"
        ? []
        : [
            "The mapped containing parcel cannot be treated as the unit's confirmed legal parcel",
          ]),
      "Auckland Council generated-report reuse requires licence confirmation",
      "Watercare automated access and generated-report reuse rights are unverified",
    ],
  };
}

function assessParcelMatch(
  address: AddressMatch,
  parcel: ParcelMatch,
): DataAccessSpikeResult["parcelMatch"] {
  const reasons = [
    ...(address.unit ? ["The supplied address is a unit address"] : []),
    ...(parcel.titles.length > 1
      ? ["The containing parcel is associated with multiple titles"]
      : []),
    ...(parcel.parcelIntent !== "Fee Simple Title"
      ? ["The containing parcel is not identified as a fee simple title parcel"]
      : []),
  ];

  return {
    status:
      reasons.length === 0
        ? "mapped_primary_parcel"
        : "containing_parcel_requires_confirmation",
    reasons,
  };
}

function parseProviderResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new DataAccessSpikeError("PROVIDER_RESPONSE_INVALID");
  }
  return result.data;
}

function normalizeAddress(value: string): string {
  const addressTokens = value
    .toLocaleLowerCase("en-NZ")
    .replace(/\bnew zealand\b/g, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/);

  if (addressTokens.at(-1) === "auckland") {
    addressTokens.pop();
  }

  return addressTokens.join(" ");
}

function deduplicateParcels(
  features: z.infer<typeof parcelCollectionSchema>["features"],
): { parcels: ParcelMatch[]; duplicatesRemoved: number } {
  const byId = new Map<string, ParcelMatch>();
  for (const feature of features) {
    const parcelId = String(feature.properties.id);
    if (byId.has(parcelId)) continue;

    byId.set(parcelId, {
      parcelId,
      appellation: feature.properties.appellation,
      parcelIntent: feature.properties.parcel_intent,
      landDistrict: feature.properties.land_district,
      titles: feature.properties.titles
        ? feature.properties.titles.split(",").map((title) => title.trim())
        : [],
      surveyAreaSquareMetres: feature.properties.survey_area,
      calculatedAreaSquareMetres: feature.properties.calc_area,
      geometry: feature.geometry as Polygon,
    });
  }

  return {
    parcels: [...byId.values()],
    duplicatesRemoved: features.length - byId.size,
  };
}

function requireSingleParcel(parcels: ParcelMatch[]): ParcelMatch {
  if (parcels.length === 0) {
    throw new DataAccessSpikeError("PARCEL_NOT_FOUND");
  }
  if (parcels.length > 1) {
    throw new DataAccessSpikeError("PARCEL_AMBIGUOUS");
  }
  return parcels[0];
}

async function observeAerial(
  gateway: DataAccessSpikeGateway,
  apiKey: string | undefined,
): Promise<DatasetObservation> {
  if (!apiKey) {
    return {
      provider: "LINZ",
      dataset: "LINZ Basemaps Aerial",
      status: "unavailable",
      licenceStatus: "permitted",
      evidenceUse: "unavailable",
      reason: "LINZ_BASEMAPS_API_KEY is not configured",
    };
  }

  try {
    const result = await gateway.checkAerial(apiKey);
    return {
      provider: "LINZ",
      dataset: "LINZ Basemaps Aerial",
      status: "success",
      licenceStatus: "permitted",
      evidenceUse: "report_allowed",
      durationMs: result.durationMs,
    };
  } catch {
    return {
      provider: "LINZ",
      dataset: "LINZ Basemaps Aerial",
      status: "error",
      licenceStatus: "permitted",
      evidenceUse: "unavailable",
      errorCode: "PROVIDER_REQUEST_FAILED",
    };
  }
}

function unavailableWatercare(dataset: string): DatasetObservation {
  return {
    provider: "Watercare",
    dataset,
    status: "unavailable",
    licenceStatus: "unavailable",
    evidenceUse: "unavailable",
    reason:
      "No official automated endpoint with suitable commercial generated-report reuse rights was verified",
  };
}

export function parcelFeature(parcel: ParcelMatch): Feature<Polygon> {
  return {
    type: "Feature",
    properties: { parcelId: parcel.parcelId },
    geometry: parcel.geometry,
  };
}
