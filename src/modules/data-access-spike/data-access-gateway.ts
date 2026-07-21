import type { FeatureCollection, Geometry, Polygon } from "geojson";
import type { DatasetKey, QueryableDatasetKey } from "./dataset-catalog";

export type Position = [longitude: number, latitude: number];

export interface AddressMatch {
  addressId: string;
  fullAddress: string;
  fullAddressNumber: string;
  unit: string | null;
  territorialAuthority: string;
  coordinates: Position;
}

export interface ParcelMatch {
  parcelId: string;
  appellation: string;
  parcelIntent: string;
  landDistrict: string;
  titles: string[];
  surveyAreaSquareMetres: number | null;
  calculatedAreaSquareMetres: number | null;
  geometry: Polygon;
}

export interface ParcelQueryResult {
  parcels: ParcelMatch[];
  duplicatesRemoved: number;
}

export interface CountResult {
  count: number;
  durationMs: number;
}

export interface AerialAttribution {
  text: string;
  url: string;
}

export interface DatasetEvidence {
  provider: string;
  dataset: string;
  datasetIdentifier: string;
  status: "success" | "available" | "unavailable" | "error";
  licenceStatus: "permitted" | "conditional" | "unavailable";
  evidenceUse:
    "report_allowed" | "spike_only" | "internal_reference" | "unavailable";
  retrievedAt: string;
  datasetDate: string | null;
  licence: string;
  attribution: AerialAttribution | null;
  geometryUsed: string | null;
  attributesUsed: string[];
  evidenceType: string;
  confidence: "high" | "limited" | "unavailable";
  featureCount?: number;
  durationMs?: number;
  geometry?: FeatureCollection<Geometry>;
  reason?: string;
  errorCode?: ProviderEvidenceErrorCode;
}

export type ProviderEvidenceErrorCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_RESPONSE_TOO_LARGE"
  | "PROVIDER_HTTP_ERROR"
  | "PROVIDER_REQUEST_FAILED";

const providerEvidenceErrorCodes = [
  "PROVIDER_TIMEOUT",
  "PROVIDER_RESPONSE_INVALID",
  "PROVIDER_RESPONSE_TOO_LARGE",
  "PROVIDER_HTTP_ERROR",
  "PROVIDER_REQUEST_FAILED",
] as const satisfies readonly ProviderEvidenceErrorCode[];

export function isProviderEvidenceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return providerEvidenceErrorCodes.some((code) => message.startsWith(code));
}

export function providerEvidenceErrorCode(
  error: unknown,
): ProviderEvidenceErrorCode {
  const message = error instanceof Error ? error.message : "";
  return (
    providerEvidenceErrorCodes.find((code) => message.startsWith(code)) ??
    "PROVIDER_REQUEST_FAILED"
  );
}

export interface DataAccessSpikeGateway {
  datasetEvidence(dataset: DatasetKey, retrievedAt: string): DatasetEvidence;
  searchAddresses(requestedAddress: string): Promise<AddressMatch[]>;
  findParcelsAt(position: Position): Promise<ParcelQueryResult>;
  countFeatures(
    dataset: QueryableDatasetKey,
    envelope: [number, number, number, number],
  ): Promise<CountResult>;
  queryFeatures?(
    dataset: QueryableDatasetKey,
    envelope: [number, number, number, number],
  ): Promise<FeatureCollection<Geometry>>;
  checkAerial(
    apiKey: string,
  ): Promise<{ durationMs: number; attribution: AerialAttribution }>;
}
