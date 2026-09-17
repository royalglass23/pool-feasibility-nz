import { describe, expect, it } from "vitest";
import type { Polygon } from "geojson";
import { assessSelectedPoolTerrain } from "@/modules/terrain/assess-selected-pool-terrain";

describe("selected pool terrain", () => {
  it("calculates local height change in metre-based NZTM coordinates", () => {
    const footprint: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.607906917203, -36.8602038189915],
          [174.607918132, -36.860203668],
          [174.607906729, -36.860194809],
          [174.607906917203, -36.8602038189915],
        ],
      ],
    };

    const result = assessSelectedPoolTerrain({
      footprint,
      samples: [
        [174.607906917203, -36.8602038189915],
        [174.607918132, -36.860203668],
        [174.607906729, -36.860194809],
        [174.607910594735, -36.860200815997],
      ].map((position, index) => ({
        position: position as [number, number],
        slopeDegrees: 2 + index * 2,
        eastGradient: 1,
        northGradient: 0,
      })),
    });

    expect(result).not.toBeNull();
    expect(result?.averageSlopeDegrees).toBe(5);
    expect(result?.estimatedFallMetres).toBeCloseTo(1, 3);
    expect(result?.sampleCount).toBe(4);
  });
});
