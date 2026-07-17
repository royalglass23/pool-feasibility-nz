import { bbox } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { z } from "zod";
import type {
  AddressMatch,
  DataAccessSpikeGateway,
  DatasetEvidence,
  ParcelMatch,
  ProviderEvidenceErrorCode,
} from "./data-access-gateway";
import { providerEvidenceErrorCode } from "./data-access-gateway";
import {
  datasetKeys,
  queryableDatasetKeys,
  type DatasetKey,
} from "./dataset-catalog";

export type {
  AddressMatch,
  AerialAttribution,
  CountResult,
  DataAccessSpikeGateway,
  ParcelMatch,
  ParcelQueryResult,
  Position,
} from "./data-access-gateway";

export class DataAccessSpikeError extends Error {
  constructor(
    readonly code:
      | "ADDRESS_NOT_FOUND"
      | "ADDRESS_AMBIGUOUS"
      | "PARCEL_NOT_FOUND"
      | "PARCEL_AMBIGUOUS"
      | "OUTSIDE_SUPPORTED_REGION",
    readonly addressOptions: AddressOption[] = [],
  ) {
    super(code);
    this.name = "DataAccessSpikeError";
  }
}

export type AddressOption = Pick<AddressMatch, "addressId" | "fullAddress">;

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
  datasets: Record<DatasetKey, DatasetEvidence>;
  successfulDatasets: DatasetKey[];
  unavailableDatasets: DatasetKey[];
  reportEligibleDatasets: DatasetKey[];
  spikeOnlyDatasets: DatasetKey[];
  internalReferenceDatasets: DatasetKey[];
  providerErrors: Array<{
    dataset: DatasetKey;
    code: ProviderEvidenceErrorCode;
  }>;
  generatedAt: string;
  blockers: string[];
}

const addressInputSchema = z.string().trim().min(8).max(200);

export async function runDataAccessSpike(input: {
  requestedAddress: string;
  selectedAddressId?: string;
  gateway: DataAccessSpikeGateway;
  basemapApiKey?: string;
  now?: () => Date;
}): Promise<DataAccessSpikeResult> {
  const requestedAddress = addressInputSchema.parse(input.requestedAddress);
  const retrievedAt = (input.now?.() ?? new Date()).toISOString();
  const addressMatches = await input.gateway.searchAddresses(requestedAddress);

  const resolvedAddress = input.selectedAddressId
    ? addressMatches.find(
        (candidate) => candidate.addressId === input.selectedAddressId,
      )
    : resolveUnselectedAddress(addressMatches, requestedAddress);
  if (!resolvedAddress) {
    throw new DataAccessSpikeError("ADDRESS_NOT_FOUND");
  }
  if (resolvedAddress.territorialAuthority !== "Auckland") {
    throw new DataAccessSpikeError("OUTSIDE_SUPPORTED_REGION");
  }

  const resolvedParcels = await input.gateway.findParcelsAt(
    resolvedAddress.coordinates,
  );
  const parcel = requireSingleParcel(resolvedParcels.parcels);
  const parcelMatch = assessParcelMatch(parcel);

  const addressAlternatives = addressMatches.filter(
    (candidate) => candidate.addressId !== resolvedAddress.addressId,
  );
  const comparisonParcels: DataAccessSpikeResult["comparisonParcels"] = [];
  for (const alternative of addressAlternatives) {
    const response = await input.gateway.findParcelsAt(alternative.coordinates);
    const comparison = requireSingleParcel(response.parcels);
    comparisonParcels.push({
      addressId: alternative.addressId,
      fullAddress: alternative.fullAddress,
      parcelId: comparison.parcelId,
      appellation: comparison.appellation,
    });
  }

  const envelope = bbox(parcel.geometry) as [number, number, number, number];
  const datasetEntries: Array<readonly [DatasetKey, DatasetEvidence]> = [];
  for (const key of queryableDatasetKeys) {
    const evidence = input.gateway.datasetEvidence(key, retrievedAt);
    try {
      const geometry = await input.gateway.queryFeatures?.(key, envelope);
      const result = geometry
        ? { count: geometry.features.length, durationMs: undefined }
        : await input.gateway.countFeatures(key, envelope);
      datasetEntries.push([
        key,
        {
          ...evidence,
          status: "success",
          confidence:
            evidence.licenceStatus === "permitted" ? "high" : "limited",
          featureCount: result.count,
          ...(result.durationMs === undefined
            ? {}
            : { durationMs: result.durationMs }),
          ...(geometry ? { geometry } : {}),
        },
      ]);
    } catch (error) {
      datasetEntries.push([
        key,
        {
          ...evidence,
          status: "error",
          evidenceUse: "unavailable",
          confidence: "unavailable",
          errorCode: providerEvidenceErrorCode(error),
        },
      ]);
    }
  }

  const datasets = Object.fromEntries(datasetEntries) as Record<
    DatasetKey,
    DatasetEvidence
  >;
  datasets.address_resolution = {
    ...input.gateway.datasetEvidence("address_resolution", retrievedAt),
    featureCount: addressMatches.length,
  };
  datasets.legal_parcel = {
    ...input.gateway.datasetEvidence("legal_parcel", retrievedAt),
    featureCount: 1,
  };
  datasets.aerial_imagery = await observeAerial(
    input.gateway,
    input.basemapApiKey,
    retrievedAt,
  );
  datasets.culverts = input.gateway.datasetEvidence("culverts", retrievedAt);

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
      (datasets[key].status === "success" ||
        datasets[key].status === "available") &&
      datasets[key].evidenceUse === "spike_only",
  );
  const internalReferenceDatasets = datasetKeys.filter(
    (key) =>
      datasets[key].status === "success" &&
      datasets[key].evidenceUse === "internal_reference",
  );
  const providerErrors = datasetKeys.flatMap((key) =>
    datasets[key].status === "error"
      ? [
          {
            dataset: key,
            code: datasets[key].errorCode ?? "PROVIDER_REQUEST_FAILED",
          },
        ]
      : [],
  );
  const distinctFromAlternatives = comparisonParcels.every(
    (comparison) => comparison.parcelId !== parcel.parcelId,
  );
  const exactAddressMatched =
    !input.selectedAddressId &&
    normalizeAddress(resolvedAddress.fullAddress) ===
      normalizeAddress(requestedAddress);

  return {
    requestedAddress,
    resolvedAddress,
    addressAlternatives,
    parcel,
    parcelMatch,
    comparisonParcels,
    identityCheck: {
      exactAddressMatched,
      distinctFromAlternatives,
      duplicateParcelRowsRemoved: resolvedParcels.duplicatesRemoved,
    },
    datasets,
    successfulDatasets,
    unavailableDatasets,
    reportEligibleDatasets,
    spikeOnlyDatasets,
    internalReferenceDatasets,
    providerErrors,
    generatedAt: retrievedAt,
    blockers: [
      ...(datasets.aerial_imagery.status === "available"
        ? []
        : [
            "Real aerial map not verified: LINZ Basemaps access is unavailable",
          ]),
      ...(parcelMatch.status === "mapped_primary_parcel"
        ? []
        : [
            "The mapped containing parcel cannot be treated as the confirmed legal parcel",
          ]),
      "Auckland Council generated-report reuse requires licence confirmation",
      "Watercare geometry is internal reference data only and must be independently verified before action",
    ],
  };
}

function resolveUnselectedAddress(
  addressMatches: AddressMatch[],
  requestedAddress: string,
): AddressMatch {
  const exactMatches = addressMatches.filter(
    (candidate) =>
      normalizeAddress(candidate.fullAddress) ===
      normalizeAddress(requestedAddress),
  );
  if (exactMatches.length === 1) return exactMatches[0];

  const options = (exactMatches.length > 1 ? exactMatches : addressMatches).map(
    ({ addressId, fullAddress }) => ({ addressId, fullAddress }),
  );
  if (options.length > 1) {
    throw new DataAccessSpikeError("ADDRESS_AMBIGUOUS", options);
  }

  throw new DataAccessSpikeError("ADDRESS_NOT_FOUND");
}

function assessParcelMatch(
  parcel: ParcelMatch,
): DataAccessSpikeResult["parcelMatch"] {
  const reasons = [
    ...(parcel.titles.length !== 1
      ? ["The containing parcel must be associated with exactly one title"]
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
  retrievedAt: string,
): Promise<DatasetEvidence> {
  const commonEvidence = gateway.datasetEvidence("aerial_imagery", retrievedAt);

  if (!apiKey) {
    return {
      ...commonEvidence,
      status: "unavailable",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      reason: "LINZ_BASEMAPS_API_KEY is not configured",
    };
  }

  try {
    const result = await gateway.checkAerial(apiKey);
    return {
      ...commonEvidence,
      status: "available",
      evidenceUse: "spike_only",
      confidence: "limited",
      durationMs: result.durationMs,
      attribution: result.attribution,
    };
  } catch (error) {
    return {
      ...commonEvidence,
      status: "error",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      errorCode: providerEvidenceErrorCode(error),
    };
  }
}

export function parcelFeature(parcel: ParcelMatch): Feature<Polygon> {
  return {
    type: "Feature",
    properties: { parcelId: parcel.parcelId },
    geometry: parcel.geometry,
  };
}
