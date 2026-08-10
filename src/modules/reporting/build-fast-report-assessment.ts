import type { FeatureCollection, Geometry } from "geojson";
import { feasibilityScoringRules } from "@/config/feasibility-scoring";
import { poolScenarioCatalogue } from "@/config/pool-scenarios";
import {
  buildSessionAssessment,
  type SessionAssessment,
} from "@/modules/assessment/build-session-assessment";
import type {
  DatasetEvidence,
  ParcelMatch,
} from "@/modules/data-access-spike/data-access-gateway";
import {
  datasetKeys,
  type DatasetKey,
} from "@/modules/data-access-spike/dataset-catalog";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { assessDataAccessFeasibility } from "@/modules/scoring/assess-data-access-feasibility";
import {
  analyzePoolScenarios,
  type SpatialEvidenceInput,
} from "@/modules/spatial/analyze-pool-scenarios";
import { humanizeIdentifier } from "@/shared/text/humanize-identifier";

const EMPTY_GEOMETRY: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [],
};

export function buildFastReportAssessment(
  result: FastPropertyViewResult,
  assessedAt: string,
): SessionAssessment | null {
  if (!result.boundary.geometry) return null;

  const datasets = normalizeFastDatasets(result, assessedAt);
  const parcel: ParcelMatch = {
    parcelId: result.boundary.parcelId ?? result.resolvedAddress.addressId,
    appellation: result.boundary.parcelId
      ? `Mapped parcel ${result.boundary.parcelId}`
      : "Mapped parcel",
    parcelIntent: "Unknown",
    landDistrict: result.resolvedAddress.territorialAuthority,
    titles: [],
    surveyAreaSquareMetres: result.boundary.areaSquareMetres,
    calculatedAreaSquareMetres: result.boundary.areaSquareMetres,
    geometry: result.boundary.geometry,
  };
  const scenarioComparison = analyzePoolScenarios({
    parcel: parcel.geometry,
    parcelStatus:
      result.boundary.state === "confirmed" ? "confirmed" : "unconfirmed",
    parcelEvidence: spatialEvidence("legal_parcel", datasets.legal_parcel, {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: parcel.geometry },
      ],
    }),
    buildings: spatialEvidence(
      "building_footprints",
      datasets.building_footprints,
    ),
    constraints:
      feasibilityScoringRules.evidenceRequirements.constraintLayers.map((key) =>
        spatialEvidence(key, datasets[key]),
      ),
    constraintGroups: Object.values(feasibilityScoringRules.constraintGroups),
    mappedServices:
      feasibilityScoringRules.evidenceRequirements.infrastructure.map((key) =>
        spatialEvidence(key, datasets[key]),
      ),
    catalogue: poolScenarioCatalogue,
    preferences: {
      frontageDirection: null,
      preferredLocation: "any",
      preferredSize: null,
    },
  });
  const feasibilityAssessment = assessDataAccessFeasibility({
    scenarioComparison,
    exactAddressMatched: true,
    parcelMatchStatus:
      result.boundary.state === "confirmed"
        ? "mapped_primary_parcel"
        : "containing_parcel_requires_confirmation",
    parcelIdentityConfirmed: result.boundary.state === "confirmed",
    parcel,
    datasets,
    terrainEvidence: { status: "unknown", maximumSlopeDegrees: null },
    assessedAt,
  });

  return buildSessionAssessment({
    resolvedAddress: result.resolvedAddress,
    parcel,
    datasets,
    scenarioComparison,
    feasibilityAssessment,
    generatedAt: assessedAt,
  } as DataAccessSpikeResult);
}

function normalizeFastDatasets(
  result: FastPropertyViewResult,
  assessedAt: string,
): Record<DatasetKey, DatasetEvidence> {
  const detailed = new Map(
    (result.detailedChecks?.layers ?? []).map((layer) => [layer.key, layer]),
  );
  return Object.fromEntries(
    datasetKeys.map((key) => {
      const direct =
        key === "legal_parcel"
          ? (result.datasets.legal_parcel ??
            legalParcelEvidence(result, assessedAt))
          : key === "aerial_imagery"
            ? result.datasets.aerial_imagery
            : null;
      const layer = detailed.get(key);
      const evidence =
        direct ?? layer?.evidence ?? unavailableEvidence(key, assessedAt);
      const verifiedEmpty = layer?.state === "verified_empty";
      return [
        key,
        {
          ...evidence,
          ...(layer?.geometry
            ? { geometry: layer.geometry }
            : verifiedEmpty
              ? { geometry: EMPTY_GEOMETRY }
              : {}),
        },
      ];
    }),
  ) as Record<DatasetKey, DatasetEvidence>;
}

function legalParcelEvidence(
  result: FastPropertyViewResult,
  retrievedAt: string,
): DatasetEvidence | null {
  if (!result.boundary.geometry) return null;
  return {
    provider: "LINZ",
    dataset: "NZ Primary Parcels",
    datasetIdentifier: "signed-fast-property-boundary",
    status: "success",
    licenceStatus: "permitted",
    evidenceUse: "report_allowed",
    retrievedAt,
    datasetDate: null,
    licence: "Creative Commons Attribution 4.0 International",
    attribution: null,
    geometryUsed: "Confirmed parcel polygon",
    attributesUsed: ["parcel_id"],
    evidenceType: "legal_parcel",
    confidence: result.boundary.state === "confirmed" ? "high" : "limited",
    geometry: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { parcelId: result.boundary.parcelId },
          geometry: result.boundary.geometry,
        },
      ],
    },
  };
}

function unavailableEvidence(
  key: DatasetKey,
  retrievedAt: string,
): DatasetEvidence {
  return {
    provider: "Not available",
    dataset: humanizeIdentifier(key),
    datasetIdentifier: key,
    status: "unavailable",
    licenceStatus: "unavailable",
    evidenceUse: "unavailable",
    retrievedAt,
    datasetDate: null,
    licence: "Not available",
    attribution: null,
    geometryUsed: null,
    attributesUsed: [],
    evidenceType: "unavailable",
    confidence: "unavailable",
    reason: "This evidence was not available in the saved fast property check.",
  };
}

function spatialEvidence(
  key: DatasetKey,
  evidence: DatasetEvidence,
  geometryOverride?: FeatureCollection<Geometry>,
): SpatialEvidenceInput {
  const geometry = geometryOverride ?? evidence.geometry;
  const reportGeometry =
    evidence.evidenceUse === "report_allowed" &&
    evidence.status === "success" &&
    geometry
      ? geometry
      : null;
  return {
    id: key,
    label: evidence.dataset,
    status: reportGeometry ? "available" : "unavailable",
    ...(reportGeometry ? { geometry: reportGeometry } : {}),
    provenance: {
      provider: evidence.provider,
      dataset: evidence.dataset,
      datasetIdentifier: evidence.datasetIdentifier,
      retrievedAt: evidence.retrievedAt,
      datasetDate: evidence.datasetDate,
      licence: evidence.licence,
      attribution: evidence.attribution,
      geometryUsed: evidence.geometryUsed,
      attributesUsed: [...evidence.attributesUsed],
      evidenceType: evidence.evidenceType,
      confidence: evidence.confidence,
    },
  };
}
