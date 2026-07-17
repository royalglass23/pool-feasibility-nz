import type {
  DatasetKey,
  QueryableDatasetKey,
} from "../data-access-spike/dataset-catalog";
import type { DatasetEvidence } from "../data-access-spike/data-access-gateway";

export const linzLicence = "Creative Commons Attribution 4.0 International";
export const linzAttribution = {
  text: "Land Information New Zealand (LINZ), CC BY 4.0",
  url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data",
} as const;
export const aucklandCouncilLicence =
  "Auckland Council geospatial terms; generated-report reuse unconfirmed";
export const aucklandCouncilAttribution = {
  text: "Auckland Council geospatial data",
  url: "https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx",
} as const;
export const linzAddressQueryUrl =
  "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Addresses/FeatureServer/0/query";
export const linzParcelQueryUrl =
  "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query";
export const linzAerialStyleUrl =
  "https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/style/aerial.json";
export const watercareGisSourceUrl =
  "https://www.watercare.co.nz/builders-and-developers/tools-fees-and-resources/gis-maps";
export const watercareLicence = "Creative Commons BY-NC-ND 3.0 New Zealand";
export const watercareAttribution = {
  text: "Watercare Services Limited, CC BY-NC-ND 3.0 NZ",
  url: watercareGisSourceUrl,
} as const;

type DatasetCatalogEntry = {
  provider: "LINZ" | "Auckland Council" | "Watercare";
  dataset: string;
  licenceStatus: "permitted" | "conditional";
  queryUrl: string;
  datasetDate: string | null;
  licence: string;
  attribution: { text: string; url: string };
  where?: string;
  evidenceUse?: DatasetEvidence["evidenceUse"];
  geometryUsed?: string;
  attributesUsed?: string[];
  evidenceType?: string;
};

const linzDatasetDefaults = {
  provider: "LINZ",
  licenceStatus: "permitted",
  licence: linzLicence,
  attribution: linzAttribution,
} as const;
const councilDatasetDefaults = {
  provider: "Auckland Council",
  licenceStatus: "conditional",
  licence: aucklandCouncilLicence,
  attribution: aucklandCouncilAttribution,
} as const;
const watercareDatasetDefaults = {
  provider: "Watercare",
  licenceStatus: "conditional",
  licence: watercareLicence,
  attribution: watercareAttribution,
  evidenceUse: "internal_reference",
  geometryUsed: "mapped_provider_geometry",
  evidenceType: "official_reference_geometry",
} as const;

export const datasetCatalog: Record<QueryableDatasetKey, DatasetCatalogEntry> =
  {
    building_footprints: {
      ...linzDatasetDefaults,
      dataset: "NZ Building Outlines",
      datasetDate: null,
      queryUrl:
        "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",
    },
    contours: {
      ...councilDatasetDefaults,
      dataset: "Contours 2016 - 0.25 metre contours",
      datasetDate: "2016",
      queryUrl:
        "https://mapspublic.aucklandcouncil.govt.nz/arcgis/rest/services/Contours/MapServer/11/query",
    },
    planning_zone: {
      ...councilDatasetDefaults,
      dataset: "Unitary Plan Base Zone",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Unitary_Plan_Base_Zone/FeatureServer/0/query",
    },
    planning_overlays: {
      ...councilDatasetDefaults,
      dataset:
        "Significant Ecological Areas Overlay (representative overlay spike)",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Significant_Ecological_Areas_Overlay/FeatureServer/0/query",
    },
    flood_plains: {
      ...councilDatasetDefaults,
      dataset: "Flood Plains",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Flood_Plains/FeatureServer/0/query",
    },
    flood_prone_areas: {
      ...councilDatasetDefaults,
      dataset: "Flood Prone Areas",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Flood_Prone_Areas/FeatureServer/0/query",
    },
    overland_flow_paths: {
      ...councilDatasetDefaults,
      dataset: "Overland Flow Paths",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Overland_Flow_Paths/FeatureServer/0/query",
    },
    public_stormwater_assets: {
      ...councilDatasetDefaults,
      dataset: "Stormwater Pipe",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Pipe/FeatureServer/0/query",
    },
    manholes: {
      ...councilDatasetDefaults,
      dataset: "Stormwater Manhole and Chamber",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Manhole_And_Chamber/FeatureServer/0/query",
    },
    catchpits: {
      ...councilDatasetDefaults,
      dataset: "Stormwater Catchpit",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Catchpit/FeatureServer/0/query",
    },
    watercourses: {
      ...councilDatasetDefaults,
      dataset: "Stormwater Watercourse",
      datasetDate: null,
      queryUrl:
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Watercourse/FeatureServer/0/query",
    },
    wastewater_manholes: {
      ...watercareDatasetDefaults,
      dataset: "Wastewater Manholes",
      datasetDate: null,
      queryUrl:
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Wastewater_Network/FeatureServer/3/query",
    },
    wastewater_assets: {
      ...watercareDatasetDefaults,
      dataset: "Wastewater Pipes",
      datasetDate: null,
      queryUrl:
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Wastewater_Network/FeatureServer/5/query",
    },
    public_water_assets: {
      ...watercareDatasetDefaults,
      dataset: "Water Pipes",
      datasetDate: null,
      queryUrl:
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Water_Network/FeatureServer/5/query",
    },
    water_fittings: {
      ...watercareDatasetDefaults,
      dataset: "Water Fittings",
      datasetDate: null,
      queryUrl:
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Water_Network/FeatureServer/4/query",
    },
    wastewater_fittings: {
      ...watercareDatasetDefaults,
      dataset: "Wastewater Fittings",
      datasetDate: null,
      queryUrl:
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Wastewater_Network/FeatureServer/1/query",
    },
  };

export function officialDatasetEvidence(
  dataset: DatasetKey,
  retrievedAt: string,
): DatasetEvidence {
  if (dataset in datasetCatalog) {
    const entry = datasetCatalog[dataset as QueryableDatasetKey];
    return {
      provider: entry.provider,
      dataset: entry.dataset,
      datasetIdentifier: entry.queryUrl,
      status: "unavailable",
      licenceStatus: entry.licenceStatus,
      evidenceUse:
        entry.evidenceUse ??
        (entry.licenceStatus === "permitted" ? "report_allowed" : "spike_only"),
      retrievedAt,
      datasetDate: entry.datasetDate,
      licence: entry.licence,
      attribution: entry.attribution,
      geometryUsed: entry.geometryUsed ?? "mapped_provider_geometry",
      attributesUsed: entry.attributesUsed ?? ["provider_properties"],
      evidenceType: entry.evidenceType ?? "official_mapped_geometry",
      confidence: "unavailable",
    };
  }

  switch (dataset) {
    case "address_resolution":
      return {
        provider: "LINZ",
        dataset: "NZ Addresses",
        datasetIdentifier: linzAddressQueryUrl,
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "report_allowed",
        retrievedAt,
        datasetDate: null,
        licence: linzLicence,
        attribution: linzAttribution,
        geometryUsed: "address_point",
        attributesUsed: [
          "address_id",
          "full_address",
          "full_address_number",
          "unit",
          "territorial_authority",
          "address_lifecycle",
        ],
        evidenceType: "address_resolution",
        confidence: "high",
      };
    case "legal_parcel":
      return {
        provider: "LINZ",
        dataset: "NZ Primary Parcels",
        datasetIdentifier: linzParcelQueryUrl,
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "report_allowed",
        retrievedAt,
        datasetDate: "2026-07-11",
        licence: linzLicence,
        attribution: linzAttribution,
        geometryUsed: "legal_parcel_polygon",
        attributesUsed: [
          "id",
          "appellation",
          "parcel_intent",
          "land_district",
          "titles",
          "survey_area",
          "calc_area",
        ],
        evidenceType: "legal_parcel_resolution",
        confidence: "high",
      };
    case "aerial_imagery":
      return {
        provider: "LINZ",
        dataset: "LINZ Basemaps Aerial",
        datasetIdentifier: linzAerialStyleUrl,
        status: "unavailable",
        licenceStatus: "permitted",
        evidenceUse: "unavailable",
        retrievedAt,
        datasetDate: null,
        licence: linzLicence,
        attribution: null,
        geometryUsed: null,
        attributesUsed: ["style_source_attribution"],
        evidenceType: "aerial_style_metadata",
        confidence: "unavailable",
      };
    case "culverts":
      return {
        provider: "Auckland Council",
        dataset: "Culverts",
        datasetIdentifier:
          "https://www.aucklandcouncil.govt.nz/geospatial/Pages/default.aspx",
        status: "unavailable",
        licenceStatus: "unavailable",
        evidenceUse: "unavailable",
        retrievedAt,
        datasetDate: null,
        licence: aucklandCouncilLicence,
        attribution: aucklandCouncilAttribution,
        geometryUsed: null,
        attributesUsed: [],
        evidenceType: "provider_availability",
        confidence: "unavailable",
        reason:
          "No dedicated official culvert endpoint was verified in this spike",
      };
    default:
      throw new Error("DATASET_METADATA_MISSING");
  }
}
