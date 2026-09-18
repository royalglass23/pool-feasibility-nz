import { describe, expect, it } from "vitest";
import {
  buildConstructabilitySnapshot,
  constructabilityAnswersSchema,
  constructabilitySnapshotSchema,
} from "@/modules/assessment/constructability-evidence";

const answers = {
  version: 1,
  estimatedDepthMetres: 1.5,
  route: { provenance: "uncertain", geometry: null },
  accessConditions: ["none_of_these"],
  nearbyFeatures: ["none_of_these"],
} satisfies import("@/modules/assessment/constructability-evidence").ConstructabilityAnswers;

describe("constructability evidence", () => {
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
});
