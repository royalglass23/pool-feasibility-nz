import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";

export function spatialEvidenceForMap(
  key: string,
  result: DataAccessSpikeResult,
) {
  const evidence =
    result.datasets[key as keyof DataAccessSpikeResult["datasets"]];
  return {
    id: key,
    label: evidence.dataset,
    status:
      evidence.status === "success" && evidence.geometry
        ? ("available" as const)
        : ("unavailable" as const),
    geometry: evidence.geometry,
    provenance: {
      provider: evidence.provider,
      dataset: evidence.dataset,
      datasetIdentifier: evidence.datasetIdentifier,
      retrievedAt: evidence.retrievedAt,
      datasetDate: evidence.datasetDate,
      licence: evidence.licence,
      attribution: evidence.attribution,
      geometryUsed: evidence.geometryUsed,
      attributesUsed: evidence.attributesUsed,
      evidenceType: evidence.evidenceType,
      confidence: evidence.confidence,
    },
  };
}

export function legalParcelEvidenceForMap(result: DataAccessSpikeResult) {
  return {
    id: "legal_parcel",
    label: "Confirmed legal parcel",
    status:
      result.parcelMatch.status === "mapped_primary_parcel"
        ? ("available" as const)
        : ("unavailable" as const),
    geometry: {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: result.parcel.geometry,
        },
      ],
    } satisfies FeatureCollection,
    provenance: {
      provider: "LINZ",
      dataset: "NZ Primary Parcels",
      datasetIdentifier: result.parcel.parcelId,
      retrievedAt: new Date().toISOString(),
      datasetDate: null,
      licence: "LINZ data licence",
      attribution: null,
      geometryUsed: "confirmed parcel boundary",
      attributesUsed: ["parcelId"],
      evidenceType: "official_property_boundary",
      confidence: (
        result.parcelMatch.status === "mapped_primary_parcel"
          ? "high"
          : "unavailable"
      ) as "high" | "unavailable",
    },
  };
}

export type MapPolygonFeature = Feature<Polygon>;
