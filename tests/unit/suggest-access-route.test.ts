import { describe, expect, it } from "vitest";
import {
  suggestAccessRoute,
  suggestAccessRouteFromProperty,
} from "@/modules/spatial/suggest-access-route";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const parcel = {
  type: "Polygon" as const,
  coordinates: [
    [
      [174.76, -36.85],
      [174.7603, -36.85],
      [174.7603, -36.8498],
      [174.76, -36.8498],
      [174.76, -36.85],
    ],
  ],
};
const pool = {
  position: [174.76015, -36.8499] as [number, number],
  lengthMetres: 4,
  widthMetres: 2.4,
  rotationDegrees: 0,
};
const base = {
  parcel,
  address: [174.76015, -36.850005] as [number, number],
  pool,
  buildingLayer: { state: "verified_empty" as const, geometry: null },
  terrainAvailable: true,
  terrainUpperSlopeDegrees: 2,
};

describe("preliminary construction access suggestion", () => {
  it("reproduces a direct route from a distinct street-facing edge to the selected pool", () => {
    const first = suggestAccessRoute(base);
    expect(first.confidence).toBe("credible");
    expect(first.geometry?.type).toBe("LineString");
    expect(first.geometry?.coordinates).toHaveLength(2);
    expect(suggestAccessRoute(base)).toEqual(first);
  });

  it("draws no route for a mapped building across the corridor", () => {
    const result = suggestAccessRoute({
      ...base,
      buildingLayer: {
        state: "returned" as const,
        geometry: {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Polygon" as const,
                coordinates: [
                  [
                    [174.7601, -36.84997],
                    [174.7602, -36.84997],
                    [174.7602, -36.84994],
                    [174.7601, -36.84994],
                    [174.7601, -36.84997],
                  ],
                ],
              },
            },
          ],
        },
      },
    });
    expect(result).toMatchObject({ confidence: "uncertain", geometry: null });
  });

  it("keeps ambiguous street edges, missing terrain and missing buildings uncertain", () => {
    expect(
      suggestAccessRoute({ ...base, address: [174.76015, -36.8499] }),
    ).toMatchObject({ confidence: "uncertain", geometry: null });
    expect(
      suggestAccessRoute({ ...base, terrainAvailable: false }),
    ).toMatchObject({ confidence: "uncertain", geometry: null });
    expect(
      suggestAccessRoute({ ...base, terrainUpperSlopeDegrees: undefined }),
    ).toMatchObject({ confidence: "uncertain", geometry: null });
    expect(suggestAccessRoute({ ...base, buildingLayer: null })).toMatchObject({
      confidence: "uncertain",
      geometry: null,
    });
    expect(
      suggestAccessRoute({
        ...base,
        parcel: { type: "Polygon", coordinates: [] },
      }),
    ).toMatchObject({ confidence: "uncertain", geometry: null });
  });

  it.each(["provisional", "multiple"] as const)(
    "does not suggest a route from a %s parcel match",
    (state) => {
      const property = {
        boundary: { state, geometry: parcel },
        resolvedAddress: { coordinates: base.address },
        detailedChecks: {
          layers: [
            {
              key: "building_footprints",
              state: "verified_empty",
              geometry: null,
            },
          ],
          terrain: {
            status: "measured",
            upperSlopeDegrees: 2,
            source: { evidenceUse: "report_allowed" },
          },
        },
      } as FastPropertyViewResult;
      expect(suggestAccessRouteFromProperty(property, pool)).toMatchObject({
        confidence: "uncertain",
        geometry: null,
      });
    },
  );
});
