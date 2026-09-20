import { describe, expect, it } from "vitest";
import { analyseAccessRoute } from "@/modules/spatial/analyse-access-route";

const route = {
  type: "LineString" as const,
  coordinates: [
    [174.76, -36.85],
    [174.7601, -36.85],
  ] as [number, number][],
};
const parcel = {
  type: "Polygon" as const,
  coordinates: [
    [
      [174.7599, -36.8501],
      [174.7602, -36.8501],
      [174.7602, -36.8499],
      [174.7599, -36.8499],
      [174.7599, -36.8501],
    ],
  ],
};

describe("access route facts", () => {
  it("calculates length and mapped intersections but marks missing terrain and services unassessed", () => {
    const facts = analyseAccessRoute({
      route,
      parcel,
      buildings: { state: "verified_empty", geometry: null },
      services: [],
      terrain: null,
    });
    expect(facts.length).toMatchObject({ status: "assessed" });
    expect(facts.length).toMatchObject({ value: expect.any(Number) });
    expect(facts.parcelDeparture).toEqual({ status: "assessed", value: false });
    expect(facts.buildings).toEqual({ status: "assessed", value: false });
    expect(facts.services).toEqual({
      status: "not_assessed",
      reason: "data_unavailable",
    });
    expect(facts.elevationChange).toEqual({
      status: "not_assessed",
      reason: "data_unavailable",
    });
  });

  it("rejects invalid route geometry without inventing clear findings", () => {
    const facts = analyseAccessRoute({
      route: {
        type: "LineString",
        coordinates: [route.coordinates[0]!, route.coordinates[0]!],
      },
      parcel,
      buildings: { state: "verified_empty", geometry: null },
      services: [],
      terrain: null,
    });
    expect(facts.valid).toBe(false);
    expect(facts.length).toEqual({
      status: "not_assessed",
      reason: "invalid_geometry",
    });
    expect(facts.buildings).toEqual({
      status: "not_assessed",
      reason: "invalid_geometry",
    });
  });
  it("uses saved elevation samples and detects mapped services and parcel departure", () => {
    const facts = analyseAccessRoute({
      route: {
        type: "LineString",
        coordinates: [route.coordinates[0]!, [174.7603, -36.85]],
      },
      parcel,
      buildings: { state: "verified_empty", geometry: null },
      services: [
        {
          state: "returned",
          geometry: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [174.76015, -36.85] },
              },
            ],
          },
        },
        { state: "unavailable", geometry: null },
      ],
      terrain: {
        status: "measured",
        samples: Array.from({ length: 7 }, (_, index) => ({
          position: [174.76 + index * 0.00005, -36.85] as [number, number],
          slopeDegrees: 7,
          eastGradient: index === 6 ? 0.1 : 0.05,
          northGradient: 0,
          elevationMetres: 20 + index * 0.2,
        })),
      },
    });
    expect(facts.elevationChange).toEqual({ status: "assessed", value: 1.2 });
    expect(facts.steepestGradient).toEqual({ status: "assessed", value: 5.7 });
    expect(facts.parcelDeparture).toEqual({ status: "assessed", value: true });
    expect(facts.services).toEqual({ status: "assessed", value: true });
  });

  it("measures gradient along the route and requires terrain coverage", () => {
    const samples = Array.from({ length: 3 }, (_, index) => ({
      position: [174.76 + index * 0.00005, -36.85] as [number, number],
      slopeDegrees: 11.3,
      eastGradient: 0,
      northGradient: 0.2,
      elevationMetres: 20,
    }));
    const complete = analyseAccessRoute({
      route,
      parcel,
      buildings: { state: "verified_empty", geometry: null },
      services: [],
      terrain: { status: "measured", samples },
    });
    expect(complete.steepestGradient).toEqual({ status: "assessed", value: 0 });
    const partial = analyseAccessRoute({
      route,
      parcel,
      buildings: { state: "verified_empty", geometry: null },
      services: [],
      terrain: { status: "measured", samples: samples.slice(0, 1) },
    });
    expect(partial.steepestGradient).toEqual({
      status: "not_assessed",
      reason: "data_unavailable",
    });
  });
});
