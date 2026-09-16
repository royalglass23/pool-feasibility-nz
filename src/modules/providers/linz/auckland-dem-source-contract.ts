export const AUCKLAND_DEM_SOURCE = "LINZ Auckland 2024 DEM STAC" as const;

export const AUCKLAND_DEM_DATASETS = [
  {
    collectionUrl:
      "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/collection.json",
    path: "/auckland/auckland-part-2_2024/dem_1m/2193/",
    dataset: "Auckland Part 2 LiDAR 1m DEM (2024)",
    datasetIdentifier:
      "https://data.linz.govt.nz/layer/122580-auckland-part-2-lidar-1m-dem-2024/",
    datasetDate: "2024-06-26/2024-11-04",
  },
  {
    collectionUrl:
      "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/collection.json",
    path: "/auckland/auckland-part-1_2024/dem_1m/2193/",
    dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
    datasetIdentifier:
      "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
    datasetDate: "2024-04-30/2024-06-27",
  },
] as const;

export const AUCKLAND_DEM_LICENCE_CODE = "CC-BY-4.0" as const;

// Promotion requires the independent evidence listed in
// docs/auckland-2024-lidar-dem-slope-research.md. Keep this code-owned gate
// closed while docs/data-sources.md classifies the source as spike_only.
export const AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED = false;

export const AUCKLAND_DEM_REQUIRED_METADATA = {
  horizontalCrs: "EPSG:2193",
  horizontalUnit: "metre",
  verticalDatum: "NZVD2016",
  elevationUnit: "metre",
  gridResolutionMetres: 1,
  licence: "Creative Commons Attribution 4.0 International",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  attribution: {
    text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
    url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
  },
} as const;

export type AucklandDemRequiredMetadata = typeof AUCKLAND_DEM_REQUIRED_METADATA;

export function matchesAucklandDemRequiredMetadata(
  value: unknown,
): value is AucklandDemRequiredMetadata {
  const record = asRecord(value);
  const attribution = asRecord(record?.attribution);
  return (
    record?.horizontalCrs === AUCKLAND_DEM_REQUIRED_METADATA.horizontalCrs &&
    record.horizontalUnit === AUCKLAND_DEM_REQUIRED_METADATA.horizontalUnit &&
    record.verticalDatum === AUCKLAND_DEM_REQUIRED_METADATA.verticalDatum &&
    record.elevationUnit === AUCKLAND_DEM_REQUIRED_METADATA.elevationUnit &&
    record.gridResolutionMetres ===
      AUCKLAND_DEM_REQUIRED_METADATA.gridResolutionMetres &&
    record.licence === AUCKLAND_DEM_REQUIRED_METADATA.licence &&
    record.licenceUrl === AUCKLAND_DEM_REQUIRED_METADATA.licenceUrl &&
    attribution?.text === AUCKLAND_DEM_REQUIRED_METADATA.attribution.text &&
    attribution.url === AUCKLAND_DEM_REQUIRED_METADATA.attribution.url
  );
}

export function isAucklandDemIsoTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
