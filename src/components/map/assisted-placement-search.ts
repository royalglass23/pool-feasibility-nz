import { useState } from "react";
import type { Feature, Polygon } from "geojson";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { AerialConflictFinding } from "@/modules/spatial/assess-aerial-imagery-conflicts";
import {
  findAssistedPoolPlacements,
  rankAssistedPoolPlacements,
  type AssistedPlacementSearchResult,
} from "@/modules/spatial/find-assisted-pool-placements";
import type { AssistedPlacementCandidate } from "@/modules/spatial/find-assisted-pool-placements";

const constraintKeys = [
  "planning_zone",
  "planning_overlays",
  "flood_plains",
  "flood_prone_areas",
  "overland_flow_paths",
] as const;

const mappedServiceKeys = [
  "wastewater_assets",
  "public_water_assets",
  "public_stormwater_assets",
] as const;

export function useAssistedPlacementSearch({
  result,
  dimensions,
  mapRef,
  aerialVerified,
}: {
  result: DataAccessSpikeResult;
  dimensions: { lengthMetres: number; widthMetres: number } | null;
  mapRef: { current: import("maplibre-gl").Map | null };
  aerialVerified: boolean;
}) {
  const [assistedSearch, setAssistedSearch] =
    useState<AssistedPlacementSearchResult | null>(null);
  const [assistedSearchLoading, setAssistedSearchLoading] = useState(false);

  async function runAssistedSearch() {
    if (!dimensions || assistedSearchLoading) return;
    setAssistedSearchLoading(true);
    const deterministicResult = findAssistedPoolPlacements({
      parcel: result.parcel.geometry,
      parcelStatus:
        result.parcelMatch.status === "mapped_primary_parcel"
          ? "confirmed"
          : "unconfirmed",
      parcelEvidence: legalParcelEvidenceForMap(result),
      buildings: spatialEvidenceForMap("building_footprints", result),
      constraints: constraintKeys.map((key) => spatialEvidenceForMap(key, result)),
      mappedServices: mappedServiceKeys.map((key) =>
        spatialEvidenceForMap(key, result),
      ),
      dimensions,
      rotationsDegrees: [0, 45, 90, 135],
    });
    setAssistedSearch(deterministicResult);
    if (deterministicResult.candidates.length === 0) {
      setAssistedSearchLoading(false);
      return;
    }

    let imageDataUrl: string | undefined;
    try {
      imageDataUrl = mapRef.current?.getCanvas().toDataURL("image/png");
    } catch {
      imageDataUrl = undefined;
    }
    const aerialEvidence = result.datasets.aerial_imagery;
    const context = {
      status:
        aerialEvidence.status === "available"
          ? ("available" as const)
          : ("unavailable" as const),
      alignment: aerialVerified ? ("aligned" as const) : ("uncertain" as const),
      resolution: aerialVerified
        ? ("sufficient" as const)
        : ("limited" as const),
      evidenceId: aerialEvidence.datasetIdentifier,
      ...(imageDataUrl
        ? { image: { dataUrl: imageDataUrl, mediaType: "image/png" as const } }
        : {}),
    };
    const assessments = await Promise.all(
      deterministicResult.candidates.map(async (candidate) => {
        try {
          const response = await fetch("/api/internal/aerial-conflicts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidate: {
                id: candidate.id,
                envelope: candidate.shell,
                dimensions: candidate.dimensions,
                rotationDegrees: candidate.rotationDegrees,
              },
              context,
            }),
          });
          if (!response.ok) throw new Error("AERIAL_CONFLICT_ROUTE_FAILED");
          const body = (await response.json()) as {
            candidateId: string;
            findings: AerialConflictFinding[];
            providerFailure?: boolean;
          };
          return [
            body.candidateId,
            body.providerFailure
              ? body.findings.map((finding) => ({
                  ...finding,
                  evidenceStatus: "unavailable" as const,
                  inspectionRequirement: "required" as const,
                }))
              : body.findings,
          ] as const;
        } catch {
          return [
            candidate.id,
            [unavailableImageryFinding(candidate.shell)] as AerialConflictFinding[],
          ] as const;
        }
      }),
    );
    setAssistedSearch(
      rankAssistedPoolPlacements(deterministicResult, new Map(assessments)),
    );
    setAssistedSearchLoading(false);
  }

  return { assistedSearch, assistedSearchLoading, runAssistedSearch };
}

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
    },
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

export function unavailableImageryFinding(
  shell: Feature<Polygon>,
): AerialConflictFinding {
  return {
    type: "image_alignment_uncertainty",
    affectedArea: shell,
    confidence: "low",
    explanation:
      "Aerial imagery is unavailable for reliable candidate conflict review.",
    evidenceStatus: "unavailable",
    inspectionRequirement: "required",
  };
}

export type { AssistedPlacementCandidate };
