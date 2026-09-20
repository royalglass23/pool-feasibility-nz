import { describe, expect, it } from "vitest";
import {
  calculateExcavationGeometryScenarios,
  EXCAVATION_GEOMETRY_ASSUMPTION_ID,
} from "@/modules/assessment/excavation-geometry";

describe("provisional excavation geometry scenarios", () => {
  it("calculates the approved 300 mm per-side fixture with reproducible metadata", () => {
    expect(
      calculateExcavationGeometryScenarios({
        lengthMetres: 6,
        widthMetres: 3,
        estimatedDepthMetres: 1.5,
        terrainAdjustment: "unavailable",
      }),
    ).toEqual({
      version: 1,
      assumptionId: EXCAVATION_GEOMETRY_ASSUMPTION_ID,
      inputs: {
        lengthMetres: 6,
        widthMetres: 3,
        estimatedDepthMetres: 1.5,
      },
      sideAllowanceMetres: 0.3,
      poolOutlineCubicMetres: 27,
      sideAllowanceCubicMetres: 35.64,
      rounding: { decimalPlaces: 2, method: "half_up" },
      specialistDepthWarning: false,
      terrainAdjustment: "unavailable",
    });
  });

  it("rounds exact decimal halfway volumes up at the persisted precision", () => {
    expect(
      calculateExcavationGeometryScenarios({
        lengthMetres: 5.0375,
        widthMetres: 1,
        estimatedDepthMetres: 2,
        terrainAdjustment: "unavailable",
      }),
    ).toMatchObject({
      poolOutlineCubicMetres: 10.08,
      rounding: {
        decimalPlaces: 2,
        method: "half_up",
      },
    });
  });

  it("retains the specialist warning above 1.8 m through the 2.0 m scope ceiling", () => {
    expect(
      calculateExcavationGeometryScenarios({
        lengthMetres: 6,
        widthMetres: 3,
        estimatedDepthMetres: 1.8,
        terrainAdjustment: "available_separate",
      }).specialistDepthWarning,
    ).toBe(false);
    expect(
      calculateExcavationGeometryScenarios({
        lengthMetres: 6,
        widthMetres: 3,
        estimatedDepthMetres: 1.81,
        terrainAdjustment: "available_separate",
      }).specialistDepthWarning,
    ).toBe(true);
    expect(
      calculateExcavationGeometryScenarios({
        lengthMetres: 6,
        widthMetres: 3,
        estimatedDepthMetres: 2,
        terrainAdjustment: "available_separate",
      }).sideAllowanceCubicMetres,
    ).toBe(47.52);
  });

  it.each([
    [Number.NaN, 3, 1.5],
    [6, Number.POSITIVE_INFINITY, 1.5],
    [0, 3, 1.5],
    [6, -1, 1.5],
    [6, 3, 0],
    [6, 3, 2.01],
  ])(
    "withholds the calculation for invalid or out-of-scope inputs",
    (lengthMetres, widthMetres, estimatedDepthMetres) => {
      expect(() =>
        calculateExcavationGeometryScenarios({
          lengthMetres,
          widthMetres,
          estimatedDepthMetres,
          terrainAdjustment: "unavailable",
        }),
      ).toThrow("INVALID_EXCAVATION_GEOMETRY_INPUT");
    },
  );
});
