import { describe, expect, it } from "vitest";
import {
  feasibilityScoringRules,
  classifyFeasibilityScore,
} from "@/config/feasibility-scoring";
import {
  assessFeasibility,
  type FeasibilityAssessmentInput,
} from "@/modules/scoring/assess-feasibility";
import type { PoolScenarioComparison } from "@/modules/spatial/analyze-pool-scenarios";

describe("deterministic feasibility assessment", () => {
  it("publishes the versioned category caps and stable result bands", () => {
    expect(feasibilityScoringRules.version).toBe("feasibility-scoring-v1");
    expect(
      feasibilityScoringRules.categories.map(({ id, maximumPoints }) => ({
        id,
        maximumPoints,
      })),
    ).toEqual([
      { id: "available_space", maximumPoints: 25 },
      { id: "underground_services", maximumPoints: 20 },
      { id: "flooding_and_drainage", maximumPoints: 20 },
      { id: "terrain_and_slope", maximumPoints: 15 },
      { id: "planning_constraints", maximumPoints: 10 },
      { id: "construction_access", maximumPoints: 10 },
    ]);
    expect(
      [0, 29, 30, 49, 50, 69, 70, 84, 85, 100].map((score) =>
        classifyFeasibilityScore(score),
      ),
    ).toEqual([
      "low_preliminary_feasibility",
      "low_preliminary_feasibility",
      "significant_constraints",
      "significant_constraints",
      "potentially_feasible_but_constrained",
      "potentially_feasible_but_constrained",
      "likely_feasible_with_normal_investigations",
      "likely_feasible_with_normal_investigations",
      "strong_preliminary_candidate",
      "strong_preliminary_candidate",
    ]);
    expect(feasibilityScoringRules.categoryRules).toEqual({
      availableSpaceByScenario: {
        compact: 15,
        "compact-plus": 18,
        standard: 20,
        "standard-plus": 23,
        large: 25,
      },
      serviceDistanceBands: [
        { minimumMetres: 10, points: 20 },
        { minimumMetres: 5, points: 15 },
        { minimumMetres: 2, points: 10 },
        { minimumMetres: 0, points: 5 },
      ],
      intersectingServicePoints: 0,
      triggeredConstraintPoints: 0,
      severeSlopeDegrees: 20,
      substantialFloodOverlapPercent: 50,
      constructionAccessPoints: { clear: 10, constrained: 5, blocked: 0 },
    });
    expect(feasibilityScoringRules.confidence).toEqual({
      currentDatasetMaximumAgeDays: 365,
      levels: { high: 80, medium: 55, low: 0 },
      partialAddressPoints: 10,
      maximumPoints: {
        address: 15,
        parcel: 15,
        providerAvailability: 20,
        providerAge: 10,
        infrastructure: 10,
        buildings: 10,
        terrain: 10,
        title: 5,
        easements: 5,
      },
    });
    expect(feasibilityScoringRules.evidenceRequirements).toMatchObject({
      core: ["address_resolution", "legal_parcel", "building_footprints"],
      terrain: ["contours"],
      flowPath: ["overland_flow_paths"],
      restrictedOverlay: ["planning_overlays"],
    });
    expect(feasibilityScoringRules.criticalFlags).toMatchObject({
      parcel: { id: "parcel_unconfirmed", effect: "override" },
      infrastructure: {
        id: "major_mapped_infrastructure",
        effect: "qualify",
      },
      flood: { id: "all_candidates_flood_affected", effect: "qualify" },
      flowPath: { id: "candidate_overland_flow_path", effect: "qualify" },
      terrain: { id: "severe_mapped_terrain", effect: "qualify" },
      coreData: { id: "required_core_data_unavailable", effect: "override" },
      restrictedOverlay: { id: "known_restricted_overlay", effect: "qualify" },
    });
    expect(feasibilityScoringRules.missingEvidence).toEqual({
      categoryAwardedPoints: null,
      scoreNormalization: "known_categories_only",
      lowersConfidence: true,
    });
  });

  it("returns the same fully explained assessment for identical known evidence", () => {
    const input = assessmentInput();

    const first = assessFeasibility(input);
    const second = assessFeasibility(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      analysisVersion: "feasibility-scoring-v1",
      score: 100,
      band: "strong_preliminary_candidate",
      qualification: "normal",
      confidence: { level: "high" },
      criticalFlags: [],
      finalRecommendation:
        "Strong preliminary candidate based on known mapped evidence.",
    });
    expect(
      first.categories.map((category) => ({
        id: category.id,
        maximumPoints: category.maximumPoints,
        awardedPoints: category.awardedPoints,
        status: category.status,
      })),
    ).toEqual([
      {
        id: "available_space",
        maximumPoints: 25,
        awardedPoints: 25,
        status: "scored",
      },
      {
        id: "underground_services",
        maximumPoints: 20,
        awardedPoints: 20,
        status: "scored",
      },
      {
        id: "flooding_and_drainage",
        maximumPoints: 20,
        awardedPoints: 20,
        status: "scored",
      },
      {
        id: "terrain_and_slope",
        maximumPoints: 15,
        awardedPoints: 15,
        status: "scored",
      },
      {
        id: "planning_constraints",
        maximumPoints: 10,
        awardedPoints: 10,
        status: "scored",
      },
      {
        id: "construction_access",
        maximumPoints: 10,
        awardedPoints: 10,
        status: "scored",
      },
    ]);
    for (const category of first.categories) {
      expect(category.appliedRuleIds.length).toBeGreaterThan(0);
      expect(category.evidenceReferences.length).toBeGreaterThan(0);
      expect(category.rationale.length).toBeGreaterThan(0);
      expect(category.unknownInputs).toEqual([]);
    }
  });

  it("lowers confidence without treating missing providers as absent constraints", () => {
    const result = assessFeasibility(
      assessmentInput({
        providers: [
          { ...provider("address_resolution", true), datasetDate: null },
          { ...provider("legal_parcel", true), datasetDate: null },
          { ...unavailableProvider("building_footprints"), required: true },
          { ...unavailableProvider("contours"), required: true },
          {
            ...unavailableProvider("public_stormwater_assets"),
            required: true,
          },
        ],
        parcel: {
          status: "confirmed",
          titleEvidence: "available",
          easementEvidence: "unavailable",
        },
        screening: {
          infrastructure: "unknown",
          flood: "clear",
          flowPath: "clear",
          terrain: "unknown",
          restrictedOverlay: "clear",
          constructionAccess: "unknown",
        },
      }),
    );

    expect(result.score).toBe(100);
    expect(result.confidence).toMatchObject({ level: "low" });
    expect(
      result.confidence.factors.map((factor) => ({
        id: factor.id,
        awardedPoints: factor.awardedPoints,
        status: factor.status,
      })),
    ).toEqual([
      { id: "address", awardedPoints: 15, status: "available" },
      { id: "parcel", awardedPoints: 15, status: "available" },
      {
        id: "provider_availability",
        awardedPoints: 8,
        status: "limited",
      },
      { id: "provider_age", awardedPoints: 0, status: "unavailable" },
      { id: "infrastructure", awardedPoints: 0, status: "unavailable" },
      { id: "buildings", awardedPoints: 0, status: "unavailable" },
      { id: "terrain", awardedPoints: 0, status: "unavailable" },
      { id: "title", awardedPoints: 5, status: "available" },
      { id: "easements", awardedPoints: 0, status: "unavailable" },
    ]);
    expect(
      result.categories
        .filter((category) => category.status === "unknown")
        .map((category) => category.id),
    ).toEqual([
      "underground_services",
      "terrain_and_slope",
      "construction_access",
    ]);
    expect(
      result.categories.find(
        (category) => category.id === "underground_services",
      ),
    ).toMatchObject({
      awardedPoints: null,
      unknownInputs: ["screening:infrastructure"],
    });
  });

  it("uses the approved no-clear-candidate wording in the score explanation", () => {
    const comparison = scenarioComparison();
    comparison.scenarios = comparison.scenarios.map((scenario) => ({
      ...scenario,
      status: "no_clear_candidate" as const,
      candidates: [],
    }));
    comparison.successfulShells = [];
    comparison.shellRange = null;

    const result = assessFeasibility(
      assessmentInput({ scenarioComparison: comparison }),
    );

    expect(
      result.categories.find(({ id }) => id === "available_space")?.rationale,
    ).toBe(
      "No clear candidate area was identified using the tested screening scenarios.",
    );
  });

  it("leaves physical feasibility indeterminate when every category is unknown", () => {
    const unknownComparison = scenarioComparison();
    unknownComparison.scenarios = unknownComparison.scenarios.map(
      (scenario) => ({
        ...scenario,
        status: "insufficient_data" as const,
        candidates: [],
        missingRequiredEvidence: ["scenario_comparison"],
      }),
    );
    unknownComparison.successfulShells = [];
    unknownComparison.shellRange = null;

    const result = assessFeasibility(
      assessmentInput({
        scenarioComparison: unknownComparison,
        screening: screening({
          infrastructure: "unknown",
          flood: "unknown",
          flowPath: "unknown",
          terrain: "unknown",
          restrictedOverlay: "unknown",
          constructionAccess: "unknown",
        }),
      }),
    );

    expect(result).toMatchObject({
      score: null,
      band: null,
      qualification: "indeterminate",
      finalRecommendation:
        "Physical feasibility is indeterminate until mapped evidence is available.",
    });
    expect(
      result.categories.every((category) => category.status === "unknown"),
    ).toBe(true);
    expect(result.confidence.score).toBeLessThan(100);
  });

  it("does not reduce confidence when only optional provider evidence is unavailable", () => {
    const result = assessFeasibility(
      assessmentInput({
        providers: [
          provider("address_resolution", true),
          provider("legal_parcel", true),
          provider("building_footprints", true),
          provider("contours", true),
          unavailableProvider("aerial_imagery"),
          unavailableProvider("culverts"),
        ],
      }),
    );

    expect(result.confidence).toMatchObject({ score: 100, level: "high" });
  });

  it.each([
    {
      family: "parcel",
      expectedId: "parcel_unconfirmed",
      expectedEffect: "override",
      expectedQualification: "insufficient_core_data",
      input: () =>
        assessmentInput({
          parcel: {
            status: "unconfirmed",
            titleEvidence: "available",
            easementEvidence: "available",
          },
        }),
    },
    {
      family: "infrastructure",
      expectedId: "major_mapped_infrastructure",
      expectedEffect: "qualify",
      expectedQualification: "specialist_review_required",
      input: () =>
        assessmentInput({
          screening: screening({ infrastructure: "triggered" }),
        }),
    },
    {
      family: "flood",
      expectedId: "all_candidates_flood_affected",
      expectedEffect: "qualify",
      expectedQualification: "specialist_review_required",
      input: () =>
        assessmentInput({ screening: screening({ flood: "triggered" }) }),
    },
    {
      family: "flow path",
      expectedId: "candidate_overland_flow_path",
      expectedEffect: "qualify",
      expectedQualification: "specialist_review_required",
      input: () =>
        assessmentInput({ screening: screening({ flowPath: "triggered" }) }),
    },
    {
      family: "terrain",
      expectedId: "severe_mapped_terrain",
      expectedEffect: "qualify",
      expectedQualification: "specialist_review_required",
      input: () =>
        assessmentInput({ screening: screening({ terrain: "triggered" }) }),
    },
    {
      family: "core data",
      expectedId: "required_core_data_unavailable",
      expectedEffect: "override",
      expectedQualification: "insufficient_core_data",
      input: () =>
        assessmentInput({
          providers: [
            provider("address_resolution", true),
            { ...unavailableProvider("legal_parcel"), required: true },
            provider("building_footprints", true),
            provider("contours", true),
          ],
        }),
    },
    {
      family: "restricted overlay",
      expectedId: "known_restricted_overlay",
      expectedEffect: "qualify",
      expectedQualification: "specialist_review_required",
      input: () =>
        assessmentInput({
          screening: screening({ restrictedOverlay: "triggered" }),
        }),
    },
  ])(
    "applies the deterministic $family critical flag",
    ({ expectedId, expectedEffect, expectedQualification, input }) => {
      const result = assessFeasibility(input());

      expect(result.criticalFlags).toEqual([
        expect.objectContaining({ id: expectedId, effect: expectedEffect }),
      ]);
      expect(result.qualification).toBe(expectedQualification);
    },
  );
});

function assessmentInput(
  overrides: Partial<FeasibilityAssessmentInput> = {},
): FeasibilityAssessmentInput {
  return {
    scenarioComparison: scenarioComparison(),
    address: { status: "confirmed", exactMatch: true },
    parcel: {
      status: "confirmed",
      titleEvidence: "available",
      easementEvidence: "available",
    },
    providers: [
      provider("address_resolution", true),
      provider("legal_parcel", true),
      provider("building_footprints", true),
      provider("contours", true),
      provider("public_stormwater_assets", false),
    ],
    screening: {
      infrastructure: "clear",
      flood: "clear",
      flowPath: "clear",
      terrain: "clear",
      restrictedOverlay: "clear",
      constructionAccess: "clear",
    },
    assessedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function provider(id: string, required: boolean) {
  return {
    id,
    required,
    status: "available" as const,
    retrievedAt: "2026-07-20T00:00:00.000Z",
    datasetDate: "2026-07-01T00:00:00.000Z",
    confidence: "high" as const,
  };
}

function unavailableProvider(id: string) {
  return {
    id,
    required: false,
    status: "unavailable" as const,
    retrievedAt: "2026-07-20T00:00:00.000Z",
    datasetDate: null,
    confidence: "unavailable" as const,
  };
}

function screening(
  overrides: Partial<FeasibilityAssessmentInput["screening"]> = {},
): FeasibilityAssessmentInput["screening"] {
  return {
    infrastructure: "clear",
    flood: "clear",
    flowPath: "clear",
    terrain: "clear",
    restrictedOverlay: "clear",
    constructionAccess: "clear",
    ...overrides,
  };
}

function scenarioComparison(): PoolScenarioComparison {
  const evidence = {
    id: "fixture",
    label: "Fixture evidence",
    status: "available" as const,
    geometry: { type: "FeatureCollection" as const, features: [] },
    provenance: {
      provider: "Fixture provider",
      dataset: "Fixture evidence",
      datasetIdentifier: "fixture:evidence",
      retrievedAt: "2026-07-20T00:00:00.000Z",
      datasetDate: "2026-07-01T00:00:00.000Z",
      licence: "Fixture only",
      attribution: null,
      geometryUsed: "fixture geometry",
      attributesUsed: [],
      evidenceType: "controlled_fixture",
      confidence: "high" as const,
    },
  };
  const polygon = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [174.607, -36.861],
          [174.609, -36.861],
          [174.609, -36.859],
          [174.607, -36.859],
          [174.607, -36.861],
        ],
      ],
    },
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
        resultWording: "Fixture result",
        testedPlacementCount: 1,
        testedRotationsDegrees: [0],
        usableAreaSquareMetres: 100,
        analysisEvidence: { parcel: evidence, buildings: evidence },
        constraintScreening: [],
        constraintGroupScreening: [],
        candidates: [
          {
            id: "large-1",
            rank: 1,
            centre: [174.608, -36.86],
            rotationDegrees: 0,
            shell: polygon,
            envelope: polygon,
            placementEvidence: { parcel: evidence, buildings: evidence },
            constraintIntersections: [],
            mappedServiceDistances: [
              {
                evidence: { ...evidence, id: "public_stormwater_assets" },
                status: "no_mapped_feature",
                distanceMetres: null,
              },
            ],
            rankingEvidence: ["Fixture ranking"],
          },
        ],
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
    recommendedShell: {
      scenarioId: "large",
      label: "Large",
      lengthMetres: 9,
      widthMetres: 4,
      candidateId: "large-1",
      status: "likely",
      rationale:
        "Largest successfully placed shell within the best-supported feasibility status.",
    },
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
