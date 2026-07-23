import { featureCollection, polygon } from "@turf/turf";
import { describe, expect, it } from "vitest";
import {
  findAssistedPoolPlacements,
  type AssistedPlacementEvidence,
} from "@/modules/spatial/find-assisted-pool-placements";

const parcel = polygon([
  [
    [174.6077, -36.86035],
    [174.6081, -36.86035],
    [174.6081, -36.86005],
    [174.6077, -36.86005],
    [174.6077, -36.86035],
  ],
]);

const provenance = {
  provider: "fixture",
  dataset: "controlled test geometry",
  datasetIdentifier: "fixture:assisted-search",
  retrievedAt: "2026-07-23T00:00:00.000Z",
  datasetDate: null,
  licence: "Controlled test fixture",
  attribution: null,
  geometryUsed: "fixture geometry",
  attributesUsed: [],
  evidenceType: "controlled_fixture",
  confidence: "high" as const,
};

function evidence(
  id: string,
  geometry = featureCollection([]),
): AssistedPlacementEvidence {
  return { id, label: id, status: "available", geometry, provenance };
}

const baseInput = {
  parcel: parcel.geometry,
  parcelStatus: "confirmed" as const,
  parcelEvidence: evidence("legal_parcel"),
  buildings: evidence("building_footprints"),
  constraints: [],
  mappedServices: [],
  dimensions: { lengthMetres: 5, widthMetres: 3 },
  rotationsDegrees: [0, 90],
};

describe("findAssistedPoolPlacements", () => {
  it("returns at most three distinct ranked candidates for preset or custom dimensions", () => {
    const result = findAssistedPoolPlacements(baseInput);

    expect(result.status).toBe("candidates_found");
    expect(result.candidates).toHaveLength(3);
    expect(
      new Set(result.candidates.map((candidate) => candidate.id)).size,
    ).toBe(3);
    expect(result.candidates.map((candidate) => candidate.rank)).toEqual([
      1, 2, 3,
    ]);
    expect(result.candidates.map((candidate) => candidate.role)).toEqual([
      "best_overall",
      "access_constructability",
      "smaller_or_rotated_fallback",
    ]);
    expect(
      result.candidates.every(
        (candidate) => candidate.hardConflicts.length === 0,
      ),
    ).toBe(true);
    expect(
      result.candidates.every((candidate) => candidate.explanation.length > 0),
    ).toBe(true);
  });

  it("excludes candidates intersecting hard mapped GIS constraints", () => {
    const result = findAssistedPoolPlacements({
      ...baseInput,
      constraints: [
        evidence(
          "flood_prone_areas",
          featureCollection([
            polygon([
              [
                [174.60788, -36.86022],
                [174.60798, -36.86022],
                [174.60798, -36.86012],
                [174.60788, -36.86012],
                [174.60788, -36.86022],
              ],
            ]),
          ]),
        ),
      ],
    });

    expect(
      result.candidates.every((candidate) =>
        candidate.hardConflicts.every(
          (conflict) => conflict.type !== "measured_constraint_intersection",
        ),
      ),
    ).toBe(true);
  });

  it("returns inspection-required when required evidence is unknown", () => {
    const result = findAssistedPoolPlacements({
      ...baseInput,
      buildings: {
        ...baseInput.buildings,
        status: "unavailable",
        geometry: undefined,
      },
    });

    expect(result.status).toBe("inspection_required");
    expect(result.candidates).toEqual([]);
    expect(result.message).toMatch(/building footprint/i);
  });

  it("keeps imagery advisory and lets its penalty influence ranking without removing clear GIS candidates", () => {
    const result = findAssistedPoolPlacements({
      ...baseInput,
      imageryAssessment: ({ shell, rotationDegrees }) =>
        rotationDegrees === 0
          ? [
              {
                type: "possible_existing_pool",
                affectedArea: shell,
                confidence: "high",
                explanation:
                  "A possible existing pool is visible in the candidate area.",
                evidenceStatus: "observed",
                inspectionRequirement: "required",
              },
            ]
          : [],
    });

    expect(result.status).toBe("candidates_found");
    expect(result.candidates[0].rotationDegrees).not.toBe(0);
    expect(result.candidates[0].imageryFindings).toEqual([]);
    expect(
      result.candidates.some(
        (candidate) => candidate.imageryFindings.length > 0,
      ),
    ).toBe(true);
  });

  it("returns an explicit provider-failure state with inspection-required imagery evidence", () => {
    const result = findAssistedPoolPlacements({
      ...baseInput,
      imageryAssessment: () => {
        throw new Error("provider unavailable");
      },
    });

    expect(result.status).toBe("provider_failure");
    expect(result.candidates).toHaveLength(3);
    expect(
      result.candidates.every((candidate) =>
        candidate.imageryFindings.every(
          (finding) => finding.inspectionRequirement === "required",
        ),
      ),
    ).toBe(true);
  });
});
