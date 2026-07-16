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
] as const;

export type QueryableDatasetKey = (typeof queryableDatasetKeys)[number];

export const datasetKeys = [
  "address_resolution",
  "legal_parcel",
  "aerial_imagery",
  ...queryableDatasetKeys,
  "wastewater_assets",
  "public_water_assets",
  "culverts",
] as const;

export type DatasetKey = (typeof datasetKeys)[number];

export const datasetCatalog: Record<
  QueryableDatasetKey,
  {
    provider: "LINZ" | "Auckland Council";
    dataset: string;
    licenceStatus: "permitted" | "conditional";
    queryUrl: string;
    where?: string;
  }
> = {
  building_footprints: {
    provider: "LINZ",
    dataset: "NZ Building Outlines",
    licenceStatus: "permitted",
    queryUrl:
      "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",
  },
  contours: {
    provider: "Auckland Council",
    dataset: "Contours 2016 - 0.25 metre contours",
    licenceStatus: "conditional",
    queryUrl:
      "https://mapspublic.aucklandcouncil.govt.nz/arcgis/rest/services/Contours/MapServer/11/query",
  },
  planning_zone: {
    provider: "Auckland Council",
    dataset: "Unitary Plan Base Zone",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Unitary_Plan_Base_Zone/FeatureServer/0/query",
  },
  planning_overlays: {
    provider: "Auckland Council",
    dataset:
      "Significant Ecological Areas Overlay (representative overlay spike)",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Significant_Ecological_Areas_Overlay/FeatureServer/0/query",
  },
  flood_plains: {
    provider: "Auckland Council",
    dataset: "Flood Plains",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Flood_Plains/FeatureServer/0/query",
  },
  flood_prone_areas: {
    provider: "Auckland Council",
    dataset: "Flood Prone Areas",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Flood_Prone_Areas/FeatureServer/0/query",
  },
  overland_flow_paths: {
    provider: "Auckland Council",
    dataset: "Overland Flow Paths",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Overland_Flow_Paths/FeatureServer/0/query",
  },
  public_stormwater_assets: {
    provider: "Auckland Council",
    dataset: "Stormwater Pipe",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Pipe/FeatureServer/0/query",
  },
  manholes: {
    provider: "Auckland Council",
    dataset: "Stormwater Manhole and Chamber",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Manhole_And_Chamber/FeatureServer/0/query",
  },
  catchpits: {
    provider: "Auckland Council",
    dataset: "Stormwater Catchpit",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Catchpit/FeatureServer/0/query",
  },
  watercourses: {
    provider: "Auckland Council",
    dataset: "Stormwater Watercourse",
    licenceStatus: "conditional",
    queryUrl:
      "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Watercourse/FeatureServer/0/query",
  },
};
