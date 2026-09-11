import { describe, expect, it } from "vitest";
import { assessPoolAreaSlope } from "@/modules/terrain/assess-pool-area-slope";

describe("assessPoolAreaSlope", () => {
  it.each([
    {
      expectedDegrees: 5,
      row: [10, 9.912511, 9.825022, 9.737533, 9.650044],
    },
    {
      expectedDegrees: 20,
      row: [10, 9.63603, 9.272059, 8.908089, 8.544119],
    },
  ])(
    "measures a known $expectedDegrees-degree planar grid within 0.1 degrees",
    ({ expectedDegrees, row }) => {
      const result = assessPoolAreaSlope({
        grid: {
          width: 5,
          height: 5,
          originEastMetres: 0,
          originNorthMetres: 0,
          cellSizeMetres: 1,
          elevationsMetres: Array.from({ length: 5 }, () => row).flat(),
        },
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [5, 0],
              [5, 5],
              [0, 5],
              [0, 0],
            ],
          ],
        },
      });

      expect(result).toMatchObject({
        status: "measured",
        averageSlopeDegrees: expect.closeTo(expectedDegrees, 1),
      });
    },
  );

  it("reports the slope and downhill direction of a known planar grid", () => {
    const result = assessPoolAreaSlope({
      grid: {
        width: 5,
        height: 5,
        originEastMetres: 0,
        originNorthMetres: 0,
        cellSizeMetres: 1,
        elevationsMetres: Array.from({ length: 5 }, () => [
          10, 9.823673, 9.647346, 9.471019, 9.294692,
        ]).flat(),
      },
      footprint: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [5, 0],
            [5, 5],
            [0, 5],
            [0, 0],
          ],
        ],
      },
    });

    expect(result).toMatchObject({
      status: "measured",
      averageSlopeDegrees: expect.closeTo(10, 1),
      estimatedFallMetres: expect.closeTo(0.882, 2),
      downhillBearingDegrees: expect.closeTo(90, 1),
      downhillDirection: "E",
      confidence: "indicative",
    });
  });

  it("interpolates the upper slope instead of reporting a small sample's raw maximum", () => {
    const result = assessPoolAreaSlope({
      grid: {
        width: 3,
        height: 3,
        originEastMetres: 0,
        originNorthMetres: 0,
        cellSizeMetres: 1,
        elevationsMetres: [0, 0, 0, 0, 0, 0, 0, 1, 0],
      },
      footprint: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [3, 0],
            [3, 3],
            [0, 3],
            [0, 0],
          ],
        ],
      },
    });

    expect(result).toMatchObject({
      status: "measured",
      upperSlopeDegrees: expect.closeTo(31.5, 5),
    });
  });

  it("returns Needs Checking when valid elevation coverage is too sparse", () => {
    const result = assessPoolAreaSlope({
      grid: {
        width: 3,
        height: 3,
        originEastMetres: 0,
        originNorthMetres: 0,
        cellSizeMetres: 1,
        elevationsMetres: [
          10,
          9.8,
          Number.NaN,
          10,
          9.8,
          Number.NaN,
          Number.NaN,
          Number.NaN,
          Number.NaN,
        ],
      },
      footprint: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [3, 0],
            [3, 3],
            [0, 3],
            [0, 0],
          ],
        ],
      },
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["Insufficient valid elevation coverage across the pool area."],
    });
  });

  it("reports flat ground without inventing a downhill direction", () => {
    const result = assessPoolAreaSlope({
      grid: {
        width: 3,
        height: 3,
        originEastMetres: 0,
        originNorthMetres: 0,
        cellSizeMetres: 1,
        elevationsMetres: Array.from({ length: 9 }, () => 12),
      },
      footprint: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [3, 0],
            [3, 3],
            [0, 3],
            [0, 0],
          ],
        ],
      },
    });

    expect(result).toMatchObject({
      status: "measured",
      averageSlopeDegrees: 0,
      estimatedFallMetres: 0,
      downhillBearingDegrees: null,
      downhillDirection: null,
    });
  });

  it("returns Needs Checking for malformed grid dimensions", () => {
    const result = assessPoolAreaSlope({
      grid: {
        width: 4,
        height: 4,
        originEastMetres: 0,
        originNorthMetres: 0,
        cellSizeMetres: 1,
        elevationsMetres: Array.from({ length: 15 }, () => 12),
      },
      footprint: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
        ],
      },
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The elevation grid dimensions are invalid."],
    });
  });
});
