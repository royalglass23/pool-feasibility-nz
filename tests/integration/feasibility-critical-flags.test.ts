import { describe, expect, it } from "vitest";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import type {
  DatasetEvidence,
  ParcelMatch,
} from "@/modules/data-access-spike/data-access-gateway";
import { feasibilityScoringRules } from "@/config/feasibility-scoring";
import {
  datasetKeys,
  queryableDatasetKeys,
  type DatasetKey,
} from "@/modules/data-access-spike/dataset-catalog";
import { assessDataAccessFeasibility } from "@/modules/scoring/assess-data-access-feasibility";
import type { PoolScenarioComparison } from "@/modules/spatial/analyze-pool-scenarios";
import type {
  ConstraintScreeningSummary,
  SpatialEvidenceInput,
} from "@/modules/spatial/analyze-pool-candidates";

type AdapterInput = Parameters<typeof assessDataAccessFeasibility>[0];

describe("data-access feasibility critical flag integration", () => {
  it.each([
    {
      family: "parcel",
      expectedId: "parcel_unconfirmed",
      input: () => ({
        ...adapterInput(),
        parcelMatchStatus: "containing_parcel_requires_confirmation" as const,
      }),
    },
    {
      family: "infrastructure",
      expectedId: "major_mapped_infrastructure",
      input: () =>
        adapterInput({
          scenarioComparison: comparison({ serviceDistance: 0 }),
        }),
    },
    {
      family: "flood",
      expectedId: "all_candidates_flood_affected",
      input: () =>
        adapterInput({
          scenarioComparison: comparison({
            constraintScreening: floodSplitScreening(12),
            constraintGroupScreening: [floodGroupScreening(12, 75)],
          }),
        }),
    },
    {
      family: "flow path",
      expectedId: "candidate_overland_flow_path",
      input: () =>
        adapterInput({
          scenarioComparison: comparison({
            constraintScreening: [screening("overland_flow_paths", 12, 3)],
          }),
        }),
    },
    {
      family: "terrain",
      expectedId: "severe_mapped_terrain",
      input: () =>
        adapterInput({
          terrainEvidence: {
            status: "measured",
            maximumSlopeDegrees: 25,
          },
        }),
    },
    {
      family: "core data",
      expectedId: "required_core_data_unavailable",
      input: () => {
        const input = adapterInput();
        input.datasets.building_footprints = {
          ...input.datasets.building_footprints,
          status: "unavailable",
          confidence: "unavailable",
          geometry: undefined,
        };
        return input;
      },
    },
    {
      family: "restricted overlay",
      expectedId: "known_restricted_overlay",
      input: () =>
        adapterInput({
          scenarioComparison: comparison({
            constraintScreening: [screening("planning_overlays", 12, 2)],
          }),
        }),
    },
  ])(
    "derives the $family flag from normalized evidence and scenario results",
    ({ expectedId, input }) => {
      const result = assessDataAccessFeasibility(input());

      expect(result.criticalFlags).toContainEqual(
        expect.objectContaining({ id: expectedId }),
      );
      expect(result.qualification).not.toBe("normal");
      expect(result.finalRecommendation).not.toBe("");
    },
  );

  it("does not trigger the flood flag when another tested scenario has unaffected candidate areas", () => {
    const scenarioComparison = comparison({
      constraintScreening: floodSplitScreening(12),
      constraintGroupScreening: [floodGroupScreening(12, 75)],
    });
    scenarioComparison.scenarios.push({
      ...scenarioComparison.scenarios[0],
      constraintScreening: floodSplitScreening(12),
      constraintGroupScreening: [floodGroupScreening(12, 0)],
    });

    const result = assessDataAccessFeasibility(
      adapterInput({ scenarioComparison }),
    );

    expect(result.criticalFlags).not.toContainEqual(
      expect.objectContaining({ id: "all_candidates_flood_affected" }),
    );
  });
});

function adapterInput(overrides: Partial<AdapterInput> = {}): AdapterInput {
  return {
    scenarioComparison: comparison(),
    exactAddressMatched: true,
    parcelMatchStatus: "mapped_primary_parcel",
    parcel,
    datasets: datasets(),
    terrainEvidence: {
      status: "unknown",
      maximumSlopeDegrees: null,
    },
    assessedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function datasets(): Record<DatasetKey, DatasetEvidence> {
  return Object.fromEntries(
    datasetKeys.map((id) => {
      const queryable = queryableDatasetKeys.includes(
        id as (typeof queryableDatasetKeys)[number],
      );
      const unavailable = id === "culverts";
      return [
        id,
        {
          provider: "Fixture provider",
          dataset: id,
          datasetIdentifier: `fixture:${id}`,
          status: unavailable
            ? "unavailable"
            : id === "aerial_imagery"
              ? "available"
              : "success",
          licenceStatus: unavailable ? "unavailable" : "permitted",
          evidenceUse: unavailable ? "unavailable" : "report_allowed",
          retrievedAt: "2026-07-20T00:00:00.000Z",
          datasetDate: "2026-07-01T00:00:00.000Z",
          licence: "Fixture only",
          attribution: null,
          geometryUsed: queryable ? "fixture geometry" : null,
          attributesUsed: [],
          evidenceType: "controlled_fixture",
          confidence: unavailable ? "unavailable" : "high",
          ...(queryable ? { geometry: collection([]) } : {}),
        } satisfies DatasetEvidence,
      ];
    }),
  ) as unknown as Record<DatasetKey, DatasetEvidence>;
}

function comparison(
  input: {
    serviceDistance?: number;
    constraintScreening?: ConstraintScreeningSummary[];
    constraintGroupScreening?: Array<{
      groupId: string;
      status: "measured" | "unavailable";
      apparentPlacementCount: number;
      minimumAffectedEnvelopePercent: number | null;
    }>;
  } = {},
): PoolScenarioComparison {
  const candidate = {
    id: "large-1",
    rank: 1,
    centre: [174.608, -36.86],
    rotationDegrees: 0,
    shell: {
      type: "Feature" as const,
      properties: {},
      geometry: parcelGeometry,
    },
    envelope: {
      type: "Feature" as const,
      properties: {},
      geometry: parcelGeometry,
    },
    placementEvidence: { parcel: spatialEvidence, buildings: spatialEvidence },
    constraintIntersections: [],
    mappedServiceDistances: [
      {
        evidence: { ...spatialEvidence, id: "public_stormwater_assets" },
        status: "measured" as const,
        distanceMetres: input.serviceDistance ?? 10,
      },
    ],
    rankingEvidence: ["Controlled fixture"],
  };
  return {
    version: "pool-scenario-comparison-v1",
    preferences: {
      frontageDirection: null,
      preferredLocation: "any",
      preferredSize: null,
    },
    scenarios: [
      {
        scenario: {
          id: "large",
          label: "Large",
          kind: "anchor",
          version: "pool-scenario-comparison-v1",
          shellLengthMetres: 9,
          shellWidthMetres: 4,
          constructionAllowanceMetres: 1,
          rotationsDegrees: [0],
          placementSpacingMetres: 1,
          maximumTestedPlacements: 100,
          maximumCandidates: 3,
        },
        status: "likely",
        resultWording: "Controlled fixture",
        testedPlacementCount: 12,
        testedRotationsDegrees: [0],
        usableAreaSquareMetres: 100,
        analysisEvidence: {
          parcel: spatialEvidence,
          buildings: spatialEvidence,
        },
        constraintScreening: input.constraintScreening ?? [],
        constraintGroupScreening: input.constraintGroupScreening ?? [],
        candidates: [candidate],
        missingRequiredEvidence: [],
      },
    ],
    rankedScenarioIds: ["large"],
    successfulShells: [
      {
        scenarioId: "large",
        label: "Large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: "large-1",
      },
    ],
    shellRange: {
      minimum: {
        scenarioId: "large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: "large-1",
      },
      maximum: {
        scenarioId: "large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: "large-1",
      },
    },
  };
}

function screening(
  evidenceId: string,
  apparentPlacementCount: number,
  intersectingPlacementCount: number,
): ConstraintScreeningSummary {
  return {
    evidenceId,
    status: "measured",
    apparentPlacementCount,
    intersectingPlacementCount,
    allApparentPlacementsAffected:
      apparentPlacementCount > 0 &&
      apparentPlacementCount === intersectingPlacementCount,
  };
}

function floodSplitScreening(
  apparentPlacementCount: number,
): ConstraintScreeningSummary[] {
  return feasibilityScoringRules.evidenceRequirements.flood.map(
    (evidenceId, index) =>
      screening(
        evidenceId,
        apparentPlacementCount,
        index === 0 ? Math.ceil(apparentPlacementCount / 2) : 0,
      ),
  );
}

function floodGroupScreening(
  apparentPlacementCount: number,
  minimumAffectedEnvelopePercent: number,
) {
  return {
    groupId: feasibilityScoringRules.constraintGroups.flood.id,
    status: "measured" as const,
    apparentPlacementCount,
    minimumAffectedEnvelopePercent,
  };
}

function collection(
  geometries: Geometry[],
  properties: Record<string, unknown> = {},
): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({
      type: "Feature",
      properties,
      geometry,
    })),
  };
}

const parcelGeometry: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [174.607, -36.861],
      [174.609, -36.861],
      [174.609, -36.859],
      [174.607, -36.859],
      [174.607, -36.861],
    ],
  ],
};

const parcel: ParcelMatch = {
  parcelId: "8545868",
  appellation: "Lot 1 DP 576345",
  parcelIntent: "Fee Simple Title",
  landDistrict: "North Auckland",
  titles: ["1060427"],
  surveyAreaSquareMetres: 600,
  calculatedAreaSquareMetres: 600,
  geometry: parcelGeometry,
};

const spatialEvidence: SpatialEvidenceInput = {
  id: "fixture",
  label: "Fixture",
  status: "available",
  geometry: collection([]),
  provenance: {
    provider: "Fixture provider",
    dataset: "Fixture",
    datasetIdentifier: "fixture:evidence",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    datasetDate: "2026-07-01T00:00:00.000Z",
    licence: "Fixture only",
    attribution: null,
    geometryUsed: "fixture geometry",
    attributesUsed: [],
    evidenceType: "controlled_fixture",
    confidence: "high",
  },
};
