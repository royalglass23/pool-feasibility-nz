import {
  area,
  booleanDisjoint,
  booleanWithin,
  distance,
  feature,
  point,
} from "@turf/turf";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import { describe, expect, it } from "vitest";
import { compactPoolScenario } from "@/config/pool-scenarios";
import {
  analyzeCompactCandidates,
  type SpatialEvidenceInput,
} from "@/modules/spatial/analyze-compact-candidates";

const centre = [174.6079, -36.8602] as const;
const parcel = rectangleParcel(centre, 0.00018, 0.00013);
const building = rectangleParcel(centre, 0.00004, 0.00004);

describe("Compact pool candidate analysis", () => {
  it("keeps every construction envelope inside the parcel and outside known buildings", () => {
    const result = analyze({
      parcel,
      buildings: evidence("building_footprints", collection([building])),
    });

    expect(result.status).toBe("candidates_found");
    expect(result.candidates).toHaveLength(3);
    expect(result.testedPlacementCount).toBeGreaterThan(3);
    expect(result.testedRotationsDegrees).toEqual([0, 45, 90, 135]);
    expect(result.analysisEvidence).toMatchObject({
      parcel: {
        id: "legal_parcel",
        provenance: { geometryUsed: "fixture geometry" },
      },
      buildings: {
        id: "building_footprints",
        provenance: { geometryUsed: "fixture geometry" },
      },
    });
    expect(result.usableAreaSquareMetres).toBeCloseTo(
      area(feature(parcel)) - area(feature(building)),
      1,
    );
    for (const candidate of result.candidates) {
      expect(booleanWithin(candidate.envelope, feature(parcel))).toBe(true);
      expect(booleanDisjoint(candidate.envelope, feature(building))).toBe(true);
    }
  });

  it("records intersections, mapped-service distance, provenance, and deterministic ranking", () => {
    const result = analyze({
      parcel,
      constraints: [evidence("flood_plains", collection([parcel]))],
      mappedServices: [
        evidence(
          "wastewater_assets",
          collection([
            {
              type: "Point",
              coordinates: [centre[0] - 0.00015, centre[1] - 0.0001],
            },
          ]),
        ),
      ],
    });

    const rankedDistances = result.candidates.map((candidate) =>
      Math.min(
        ...candidate.mappedServiceDistances.flatMap((measurement) =>
          measurement.distanceMetres === null
            ? []
            : [measurement.distanceMetres],
        ),
      ),
    );
    expect(rankedDistances).toEqual(
      [...rankedDistances].sort((left, right) => right - left),
    );
    for (const candidate of result.candidates) {
      expect(candidate.constraintIntersections[0]).toMatchObject({
        evidence: {
          id: "flood_plains",
          provenance: {
            provider: "Fixture provider",
            datasetIdentifier: "fixture:flood_plains",
          },
        },
        status: "measured",
        intersects: true,
        affectedEnvelopePercent: 100,
      });
      expect(candidate.mappedServiceDistances[0]).toMatchObject({
        evidence: { id: "wastewater_assets" },
        status: "measured",
      });
      expect(candidate.rankingEvidence).toContain(
        "All configured mapped constraint layers were available for this ranking.",
      );
    }
  });

  it("preserves Compact metric dimensions, rotation, and coordinate order at Auckland latitude", () => {
    const unrotated = analyze({
      parcel: rectangleParcel(centre, 0.00014, 0.00003),
    }).candidates[0];
    const rotated = analyze({
      parcel: rectangleParcel(centre, 0.000035, 0.00014),
    }).candidates[0];

    expect(unrotated.rotationDegrees).toBe(0);
    expect(rotated.rotationDegrees).toBe(90);
    const [first, second, third] = unrotated.shell.geometry.coordinates[0];
    expect(
      distance(point(first), point(second), { units: "meters" }),
    ).toBeCloseTo(5, 2);
    expect(
      distance(point(second), point(third), { units: "meters" }),
    ).toBeCloseTo(3, 2);
    for (const [longitude, latitude] of unrotated.shell.geometry
      .coordinates[0]) {
      expect(longitude).toBeGreaterThan(174);
      expect(longitude).toBeLessThan(175);
      expect(latitude).toBeGreaterThan(-37);
      expect(latitude).toBeLessThan(-36);
    }
  });

  it("returns insufficient data for unavailable buildings or an unconfirmed parcel", () => {
    expect(
      analyze({
        parcel,
        buildings: evidence("building_footprints", undefined),
      }),
    ).toMatchObject({
      status: "insufficient_data",
      candidates: [],
      missingRequiredEvidence: ["building_footprints"],
      analysisEvidence: {
        parcel: { id: "legal_parcel", status: "available" },
        buildings: { id: "building_footprints", status: "unavailable" },
      },
    });
    expect(analyze({ parcel, parcelStatus: "unconfirmed" })).toMatchObject({
      status: "insufficient_data",
      candidates: [],
      missingRequiredEvidence: ["legal_parcel"],
    });
  });

  it("does not declare a pool impossible when no tested envelope clears the building", () => {
    const result = analyze({
      parcel,
      buildings: evidence("building_footprints", collection([parcel])),
    });
    expect(result.status).toBe("no_clear_candidate");
    expect(result.candidates).toEqual([]);
    expect(result.analysisEvidence).toMatchObject({
      parcel: { id: "legal_parcel", status: "available" },
      buildings: { id: "building_footprints", status: "available" },
    });
    expect(result.resultWording).toBe(
      "No clear candidate area was identified using the tested screening scenarios.",
    );
    expect(result.resultWording).not.toContain("impossible");
  });
});

function analyze(input: {
  parcel: Polygon;
  parcelStatus?: "confirmed" | "unconfirmed";
  buildings?: SpatialEvidenceInput;
  constraints?: SpatialEvidenceInput[];
  mappedServices?: SpatialEvidenceInput[];
}) {
  return analyzeCompactCandidates({
    parcel: input.parcel,
    parcelStatus: input.parcelStatus ?? "confirmed",
    parcelEvidence: evidence("legal_parcel", collection([input.parcel])),
    buildings:
      input.buildings ?? evidence("building_footprints", collection([])),
    constraints: input.constraints ?? [],
    mappedServices: input.mappedServices ?? [],
    config: compactPoolScenario,
  });
}

function evidence(
  id: string,
  geometry: FeatureCollection<Geometry> | undefined,
): SpatialEvidenceInput {
  return {
    id,
    label: id.replaceAll("_", " "),
    status: geometry ? "available" : "unavailable",
    ...(geometry ? { geometry } : {}),
    provenance: {
      provider: "Fixture provider",
      dataset: id,
      datasetIdentifier: `fixture:${id}`,
      retrievedAt: "2026-07-19T00:00:00.000Z",
      datasetDate: "2026-07",
      licence: "Fixture only",
      attribution: null,
      geometryUsed: geometry ? "fixture geometry" : null,
      attributesUsed: [],
      evidenceType: "controlled_fixture",
      confidence: geometry ? "high" : "unavailable",
    },
  };
}

function collection(geometries: Geometry[]): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    })),
  };
}

function rectangleParcel(
  [longitude, latitude]: readonly [number, number],
  halfLongitude: number,
  halfLatitude: number,
): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [longitude - halfLongitude, latitude - halfLatitude],
        [longitude + halfLongitude, latitude - halfLatitude],
        [longitude + halfLongitude, latitude + halfLatitude],
        [longitude - halfLongitude, latitude + halfLatitude],
        [longitude - halfLongitude, latitude - halfLatitude],
      ],
    ],
  };
}
