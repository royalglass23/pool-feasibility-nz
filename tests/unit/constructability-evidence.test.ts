import { describe, expect, it } from "vitest";
import {
  buildConstructabilitySnapshot,
  constructabilityAnswersSchema,
  constructabilitySnapshotSchema,
} from "@/modules/assessment/constructability-evidence";
import { calculateExcavationGeometryScenarios } from "@/modules/assessment/excavation-geometry";
import { parsePersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import { buildTestPersistedAssessmentSubmission } from "../fixtures/preliminary-report";

const answers = {
  version: 1,
  estimatedDepthMetres: 1.5,
  route: { provenance: "uncertain", geometry: null },
  accessConditions: ["none_of_these"],
  nearbyFeatures: ["none_of_these"],
} satisfies import("@/modules/assessment/constructability-evidence").ConstructabilityAnswers;

describe("constructability evidence", () => {
  it("round-trips a user supplied line and its route facts in the saved report payload", () => {
    const suggestedRoute = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85],
        [174.76015, -36.8499],
      ] as [number, number][],
    };
    const adjustedRoute = {
      type: "LineString" as const,
      coordinates: [
        suggestedRoute.coordinates[0]!,
        [174.76008, -36.84994],
        suggestedRoute.coordinates[1]!,
      ] as [number, number][],
    };
    const routeFacts = {
      valid: true,
      length: { status: "assessed" as const, value: 15.2 },
      elevationChange: {
        status: "not_assessed" as const,
        reason: "data_unavailable" as const,
      },
      steepestGradient: {
        status: "not_assessed" as const,
        reason: "data_unavailable" as const,
      },
      parcelDeparture: { status: "assessed" as const, value: false },
      buildings: { status: "assessed" as const, value: false },
      services: {
        status: "not_assessed" as const,
        reason: "data_unavailable" as const,
      },
    };
    const submission = buildTestPersistedAssessmentSubmission(
      "rg-341-route-roundtrip",
    );
    submission.homeowner.name = "Jane Homeowner";
    submission.report.reportData.constructability =
      buildConstructabilitySnapshot({
        answers: {
          ...answers,
          route: { provenance: "user-supplied", geometry: adjustedRoute },
        },
        suggestedRoute,
        routePolicyVersion: 1,
        routeFacts,
      });
    const saved = parsePersistedAssessmentSubmission(
      JSON.parse(JSON.stringify(submission)),
    );
    expect(saved.report.reportData.constructability).toMatchObject({
      route: { provenance: "user-supplied", geometry: adjustedRoute },
      routeFacts,
    });
  });
  it("preserves mapped and user concerns independently", () => {
    const snapshot = buildConstructabilitySnapshot({
      answers,
      mappedEvidence: [
        {
          id: "mapped-retaining-wall",
          category: "access_excavation",
          status: "concern",
          provider: "official-map",
          dataset: "retaining-walls",
        },
      ],
      providerAvailability: [
        {
          category: "access_excavation",
          provider: "official-map",
          dataset: "retaining-walls",
          status: "available",
        },
      ],
    });

    expect(snapshot.overallStatus).toBe("needs_checking");
    expect(snapshot.mappedEvidence).toHaveLength(1);
    expect(snapshot.userEvidence).toEqual([]);
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "mapped",
        evidenceId: "mapped-retaining-wall",
        status: "needs_checking",
      }),
    );
  });

  it("rejects mutually exclusive answers and out-of-range depth", () => {
    expect(() =>
      constructabilityAnswersSchema.parse({
        ...answers,
        accessConditions: ["none_of_these", "rocky_ground"],
      }),
    ).toThrow();
    expect(() =>
      constructabilityAnswersSchema.parse({
        ...answers,
        estimatedDepthMetres: 2.1,
      }),
    ).toThrow();
  });

  it("treats unanswered route and unavailable providers as not fully assessed", () => {
    const snapshot = buildConstructabilitySnapshot({ answers });
    expect(snapshot.overallStatus).toBe("not_fully_assessed");
    expect(snapshot.sectionStatus).toBe("not_assessed");
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "provider",
        category: "terrain_ground",
        status: "not_assessed",
        label: "Not assessed — data unavailable",
      }),
    );
  });

  it("keeps a user concern when mapping identifies no concern", () => {
    const snapshot = buildConstructabilitySnapshot({
      answers: { ...answers, accessConditions: ["rocky_ground"] },
      mappedEvidence: [
        {
          id: "mapped-ground",
          category: "terrain_ground",
          status: "no_concern",
          provider: "official-map",
          dataset: "ground-map",
        },
      ],
    });
    expect(snapshot.overallStatus).toBe("needs_checking");
    expect(snapshot.mappedEvidence[0].status).toBe("no_concern");
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "user",
        evidenceId: "rocky_ground",
      }),
    );
  });

  it("retains mapped and user provenances when observations disagree", () => {
    const snapshot = buildConstructabilitySnapshot({
      answers: { ...answers, accessConditions: ["retaining_wall"] },
      mappedEvidence: [
        {
          id: "mapped-ground",
          category: "access_excavation",
          status: "no_concern",
          provider: "official-map",
          dataset: "ground-map",
        },
        {
          id: "mapped-barrier",
          category: "barrier",
          status: "concern",
          provider: "official-map",
          dataset: "building-map",
        },
      ],
    });
    expect(snapshot.mappedEvidence).toHaveLength(2);
    expect(snapshot.userEvidence).toEqual([
      { category: "access_excavation", condition: "retaining_wall" },
    ]);
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "mapped",
        evidenceId: "mapped-barrier",
      }),
    );
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({ source: "user", evidenceId: "retaining_wall" }),
    );
    expect(snapshot.overallStatus).toBe("needs_checking");
  });

  it("keeps a declared concern visible while critical uncertainty makes the overall result not fully assessed", () => {
    const snapshot = buildConstructabilitySnapshot({
      answers: {
        ...answers,
        accessConditions: ["rocky_ground"],
        nearbyFeatures: ["not_sure"],
      },
    });
    expect(snapshot.overallStatus).toBe("not_fully_assessed");
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "user",
        evidenceId: "rocky_ground",
        status: "needs_checking",
      }),
    );
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "user",
        evidenceId: "nearby_not_sure",
        status: "not_assessed",
      }),
    );
  });

  it("requires a signed suggested route before accepting a claimed confirmation", () => {
    expect(() =>
      buildConstructabilitySnapshot({
        answers: {
          ...answers,
          route: {
            provenance: "confirmed",
            geometry: {
              type: "LineString",
              coordinates: [
                [174.76, -36.85],
                [174.761, -36.851],
              ],
            },
          },
        },
      }),
    ).toThrow("INVALID_CONSTRUCTABILITY_ROUTE");
  });

  it("uses preliminary onsite-confirmation status only with complete clear evidence", () => {
    const route = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85],
        [174.761, -36.851],
      ] as [number, number][],
    };
    const snapshot = buildConstructabilitySnapshot({
      answers: {
        ...answers,
        route: { provenance: "confirmed", geometry: route },
      },
      suggestedRoute: route,
      mappedEvidence: [],
      providerAvailability: (
        ["terrain_ground", "barrier", "access_excavation"] as const
      ).map((category) => ({
        category,
        provider: "official-map",
        dataset: category,
        status: "available" as const,
      })),
    });
    expect(snapshot.overallStatus).toBe("no_obvious_concern");
  });

  it("rejects a saved status or finding that contradicts its evidence", () => {
    const snapshot = buildConstructabilitySnapshot({ answers });
    expect(() =>
      constructabilitySnapshotSchema.parse({
        ...snapshot,
        overallStatus: "no_obvious_concern",
      }),
    ).toThrow();
    expect(() =>
      constructabilitySnapshotSchema.parse({
        ...snapshot,
        findings: [
          {
            source: "user",
            evidenceId: "fences",
            category: "barrier",
            status: "needs_checking",
          },
        ],
      }),
    ).toThrow();
  });

  it("records the affected provider check when data is unavailable", () => {
    const snapshot = buildConstructabilitySnapshot({
      answers,
      providerAvailability: [
        {
          category: "terrain_ground",
          provider: "LINZ",
          dataset: "DEM",
          status: "error",
        },
      ],
    });
    expect(snapshot.findings).toContainEqual(
      expect.objectContaining({
        source: "provider",
        evidenceId: "DEM",
        category: "terrain_ground",
        label: "Not assessed — data unavailable",
      }),
    );
  });

  it("reproduces saved excavation geometry from its versioned inputs and rejects altered totals", () => {
    const snapshot = buildConstructabilitySnapshot({
      answers,
      excavation: {
        dimensions: { lengthMetres: 6, widthMetres: 3 },
        terrainAdjustment: "unavailable",
      },
    });
    const saved = constructabilitySnapshotSchema.parse(
      JSON.parse(JSON.stringify(snapshot)),
    );
    expect(saved.excavationGeometry).toMatchObject({
      assumptionId: "firth-masonry-side-300mm-v1",
      poolOutlineCubicMetres: 27,
      sideAllowanceCubicMetres: 35.64,
    });
    expect(() =>
      constructabilitySnapshotSchema.parse({
        ...saved,
        excavationGeometry: {
          ...saved.excavationGeometry!,
          sideAllowanceCubicMetres: 35.65,
        },
      }),
    ).toThrow();
    expect(() =>
      constructabilitySnapshotSchema.parse({
        ...saved,
        excavationGeometry: calculateExcavationGeometryScenarios({
          lengthMetres: 6,
          widthMetres: 3,
          estimatedDepthMetres: 1.6,
          terrainAdjustment: "unavailable",
        }),
      }),
    ).toThrow();
  });

  it("rejects saved excavation inputs that contradict the saved pool layout", () => {
    const submission = buildTestPersistedAssessmentSubmission(
      "rg-342-layout-integrity",
    );
    submission.homeowner.name = "Jane Homeowner";
    submission.report.reportData.constructability =
      buildConstructabilitySnapshot({
        answers,
        excavation: {
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      });
    expect(() => parsePersistedAssessmentSubmission(submission)).not.toThrow();
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...submission,
        poolLayout: { ...submission.poolLayout, lengthMetres: 7 },
      }),
    ).toThrow();
  });
});
