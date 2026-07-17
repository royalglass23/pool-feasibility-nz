export const queryableDatasetKeys = [
  "building_footprints",
  "contours",
  "planning_zone",
  "planning_overlays",
  "flood_plains",
  "flood_prone_areas",
  "overland_flow_paths",
  "public_stormwater_assets",
  "manholes",
  "catchpits",
  "watercourses",
  "wastewater_assets",
  "public_water_assets",
  "wastewater_manholes",
  "water_fittings",
  "wastewater_fittings",
] as const;

export type QueryableDatasetKey = (typeof queryableDatasetKeys)[number];

export const datasetKeys = [
  "address_resolution",
  "legal_parcel",
  "aerial_imagery",
  ...queryableDatasetKeys,
  "culverts",
] as const;

export type DatasetKey = (typeof datasetKeys)[number];
