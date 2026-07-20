import { describe, expect, it } from "vitest";
import { distance, point } from "@turf/turf";
import { poolScenarioCatalogue } from "@/config/pool-scenarios";
import {
  analyzePoolScenarios,
  type SpatialEvidenceInput,
} from "@/modules/spatial/analyze-pool-scenarios";
import type { FeatureCollection, Geometry, Polygon } from "geojson";

describe("pool scenario comparison", () => {
  it("publishes a bounded, versioned dimension grid with the three named anchors", () => {
    expect(poolScenarioCatalogue.version).toBe("pool-scenario-comparison-v1");
    expect(
      poolScenarioCatalogue.scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        kind: scenario.kind,
        shell: scenario.shell,
      })),
    ).toEqual([
      {
        id: "compact",
        label: "Compact",
        kind: "anchor",
        shell: { lengthMetres: 5, widthMetres: 3 },
      },
      {
        id: "compact-plus",
        label: "Compact Plus",
        kind: "intermediate",
        shell: { lengthMetres: 6, widthMetres: 3.25 },
      },
      {
        id: "standard",
        label: "Standard",
        kind: "anchor",
        shell: { lengthMetres: 7, widthMetres: 3.5 },
      },
      {
        id: "standard-plus",
        label: "Standard Plus",
        kind: "intermediate",
        shell: { lengthMetres: 8, widthMetres: 3.75 },
      },
      {
        id: "large",
        label: "Large",
        kind: "anchor",
        shell: { lengthMetres: 9, widthMetres: 4 },
      },
    ]);
    expect(
      poolScenarioCatalogue.scenarios.every(
        (scenario) =>
          scenario.version === poolScenarioCatalogue.version &&
          scenario.maximumTestedPlacements === 4_000 &&
          scenario.rotationsDegrees.join(",") === "0,45,90,135",
      ),
    ).toBe(true);
  });

  it("reports a shell range derived only from successfully placed candidates", () => {
    const result = analyze({ parcel: rectangleParcel(0.00022, 0.00016) });

    expect(result.scenarios.map((scenario) => scenario.scenario.id)).toEqual([
      "compact",
      "compact-plus",
      "standard",
      "standard-plus",
      "large",
    ]);
    expect(result.successfulShells).toEqual([
      {
        scenarioId: "compact",
        label: "Compact",
        lengthMetres: 5,
        widthMetres: 3,
        candidateId: expect.any(String),
      },
      {
        scenarioId: "compact-plus",
        label: "Compact Plus",
        lengthMetres: 6,
        widthMetres: 3.25,
        candidateId: expect.any(String),
      },
      {
        scenarioId: "standard",
        label: "Standard",
        lengthMetres: 7,
        widthMetres: 3.5,
        candidateId: expect.any(String),
      },
      {
        scenarioId: "standard-plus",
        label: "Standard Plus",
        lengthMetres: 8,
        widthMetres: 3.75,
        candidateId: expect.any(String),
      },
      {
        scenarioId: "large",
        label: "Large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: expect.any(String),
      },
    ]);
    expect(result.shellRange).toEqual({
      minimum: {
        scenarioId: "compact",
        lengthMetres: 5,
        widthMetres: 3,
        candidateId: expect.any(String),
      },
      maximum: {
        scenarioId: "large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: expect.any(String),
      },
    });
    for (const shell of result.successfulShells) {
      const scenario = result.scenarios.find(
        (item) => item.scenario.id === shell.scenarioId,
      );
      expect(
        scenario?.candidates.some(
          (candidate) => candidate.id === shell.candidateId,
        ),
      ).toBe(true);
    }
  });

  it("uses preferred size and geographic location only as ranking inputs", () => {
    const parcel = rectangleParcel(0.00022, 0.00016);
    const north = analyze({
      parcel,
      preferences: {
        preferredLocation: "north",
        preferredSize: "standard",
      },
    });
    const south = analyze({
      parcel,
      preferences: {
        preferredLocation: "south",
        preferredSize: "standard",
      },
    });
    const centred = analyze({
      parcel,
      preferences: {
        preferredLocation: "centre",
        preferredSize: "standard",
      },
    });

    expect(north.rankedScenarioIds[0]).toBe("standard");
    expect(south.rankedScenarioIds[0]).toBe("standard");
    expect(north.scenarios[0].candidates[0].centre[1]).toBeGreaterThan(
      south.scenarios[0].candidates[0].centre[1],
    );
    const centredCandidates = centred.scenarios[0].candidates;
    const closestDistance = distance(
      point(centredCandidates[0].centre),
      point([...centre]),
      { units: "meters" },
    );
    expect(
      centredCandidates.every(
        (candidate) =>
          closestDistance <=
          distance(point(candidate.centre), point([...centre]), {
            units: "meters",
          }),
      ),
    ).toBe(true);
    expect(north.shellRange).toMatchObject({
      minimum: { lengthMetres: 5, widthMetres: 3 },
      maximum: { lengthMetres: 9, widthMetres: 4 },
    });
    expect(south.shellRange).toMatchObject({
      minimum: { lengthMetres: 5, widthMetres: 3 },
      maximum: { lengthMetres: 9, widthMetres: 4 },
    });
  });

  it("never lets preferences place a candidate through known constraints", () => {
    const parcel = rectangleParcel(0.00022, 0.00016);
    const result = analyze({
      parcel,
      constraints: [evidence("known_constraint", collection([parcel]))],
      preferences: {
        preferredLocation: "north",
        preferredSize: "large",
      },
    });

    expect(
      result.scenarios.every((scenario) => scenario.candidates.length === 0),
    ).toBe(true);
    expect(
      result.scenarios.every(
        (scenario) => scenario.status === "no_clear_candidate",
      ),
    ).toBe(true);
    for (const scenario of result.scenarios) {
      expect(scenario.constraintScreening).toEqual([
        expect.objectContaining({
          evidenceId: "known_constraint",
          status: "measured",
          apparentPlacementCount: expect.any(Number),
          intersectingPlacementCount: expect.any(Number),
          allApparentPlacementsAffected: true,
        }),
      ]);
      expect(
        scenario.constraintScreening[0].apparentPlacementCount,
      ).toBeGreaterThan(0);
      expect(scenario.constraintScreening[0].intersectingPlacementCount).toBe(
        scenario.constraintScreening[0].apparentPlacementCount,
      );
    }
    expect(result.successfulShells).toEqual([]);
    expect(result.shellRange).toBeNull();
  });

  it("returns the documented deterministic status for each evidence outcome", () => {
    const openParcel = rectangleParcel(0.00022, 0.00016);
    const tightParcel = rectangleParcel(0.000055, 0.000045);
    const serviceNorthOfParcel: Geometry = {
      type: "LineString",
      coordinates: [
        [centre[0] - 0.00008, centre[1] + 0.000055],
        [centre[0] + 0.00008, centre[1] + 0.000055],
      ],
    };

    expect(
      analyze({ parcel: openParcel, singleScenario: true }).scenarios[0].status,
    ).toBe("likely");
    expect(
      analyze({
        parcel: tightParcel,
        singleScenario: true,
        mappedServices: [
          evidence("mapped_service", collection([serviceNorthOfParcel])),
        ],
      }).scenarios[0].status,
    ).toBe("possible_with_constraints");
    expect(
      analyze({
        parcel: openParcel,
        singleScenario: true,
        constraints: [evidence("unknown_constraint", undefined)],
      }).scenarios[0].status,
    ).toBe("specialist_review_required");
    expect(
      analyze({
        parcel: openParcel,
        singleScenario: true,
        buildings: evidence("building_footprints", collection([openParcel])),
      }).scenarios[0].status,
    ).toBe("no_clear_candidate");
    expect(
      analyze({
        parcel: openParcel,
        singleScenario: true,
        buildings: evidence("building_footprints", undefined),
      }).scenarios[0].status,
    ).toBe("insufficient_data");
  });

  it("excludes unsuccessful larger shells from the calculated range", () => {
    const result = analyze({ parcel: rectangleParcel(0.000055, 0.000045) });

    expect(
      result.scenarios
        .filter((scenario) => scenario.candidates.length > 0)
        .map((scenario) => scenario.scenario.id),
    ).toEqual(["compact", "compact-plus", "standard", "standard-plus"]);
    expect(result.shellRange).toMatchObject({
      minimum: { scenarioId: "compact", lengthMetres: 5, widthMetres: 3 },
      maximum: {
        scenarioId: "standard-plus",
        lengthMetres: 8,
        widthMetres: 3.75,
      },
    });
    expect(
      result.successfulShells.map((shell) => shell.scenarioId),
    ).not.toContain("large");
  });
});

const centre = [174.6079, -36.8602] as const;

function analyze(input: {
  parcel: Polygon;
  buildings?: SpatialEvidenceInput;
  constraints?: SpatialEvidenceInput[];
  mappedServices?: SpatialEvidenceInput[];
  singleScenario?: boolean;
  preferences?: {
    preferredLocation: "any" | "north" | "centre" | "south";
    preferredSize:
      | "compact"
      | "compact-plus"
      | "standard"
      | "standard-plus"
      | "large"
      | null;
  };
}) {
  return analyzePoolScenarios({
    parcel: input.parcel,
    parcelStatus: "confirmed",
    parcelEvidence: evidence("legal_parcel", collection([input.parcel])),
    buildings:
      input.buildings ?? evidence("building_footprints", collection([])),
    constraints: input.constraints ?? [],
    mappedServices: input.mappedServices ?? [],
    catalogue: input.singleScenario
      ? {
          version: poolScenarioCatalogue.version,
          scenarios: [poolScenarioCatalogue.scenarios[0]],
        }
      : poolScenarioCatalogue,
    preferences: input.preferences ?? {
      preferredLocation: "any",
      preferredSize: null,
    },
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
      retrievedAt: "2026-07-20T00:00:00.000Z",
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

function rectangleParcel(halfLongitude: number, halfLatitude: number): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [centre[0] - halfLongitude, centre[1] - halfLatitude],
        [centre[0] + halfLongitude, centre[1] - halfLatitude],
        [centre[0] + halfLongitude, centre[1] + halfLatitude],
        [centre[0] - halfLongitude, centre[1] + halfLatitude],
        [centre[0] - halfLongitude, centre[1] - halfLatitude],
      ],
    ],
  };
}
