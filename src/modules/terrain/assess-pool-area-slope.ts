import { booleanPointInPolygon, point } from "@turf/turf";
import type { Polygon } from "geojson";

export type TerrainGrid = {
  width: number;
  height: number;
  originEastMetres: number;
  originNorthMetres: number;
  cellSizeMetres: number;
  elevationsMetres: number[];
};

export type PoolAreaSlopeAssessment =
  | {
      status: "measured";
      averageSlopeDegrees: number;
      upperSlopeDegrees: number;
      estimatedFallMetres: number;
      downhillBearingDegrees: number | null;
      downhillDirection: string | null;
      confidence: "indicative";
    }
  | {
      status: "needs_checking";
      reasons: string[];
    };

export function assessPoolAreaSlope(input: {
  grid: TerrainGrid;
  footprint: Polygon;
}): PoolAreaSlopeAssessment {
  const { grid, footprint } = input;
  if (
    !Number.isInteger(grid.width) ||
    !Number.isInteger(grid.height) ||
    grid.width < 3 ||
    grid.height < 3 ||
    !Number.isFinite(grid.cellSizeMetres) ||
    grid.cellSizeMetres <= 0 ||
    !Number.isFinite(grid.originEastMetres) ||
    !Number.isFinite(grid.originNorthMetres) ||
    grid.elevationsMetres.length !== grid.width * grid.height
  ) {
    return {
      status: "needs_checking",
      reasons: ["The elevation grid dimensions are invalid."],
    };
  }
  const gradients: Array<{ east: number; north: number; slope: number }> = [];
  let coveredNeighbourhoodCount = 0;

  for (let row = 0; row < grid.height - 1; row += 1) {
    for (let column = 0; column < grid.width - 1; column += 1) {
      const east = grid.originEastMetres + (column + 0.5) * grid.cellSizeMetres;
      const north = grid.originNorthMetres + (row + 0.5) * grid.cellSizeMetres;
      if (!booleanPointInPolygon(point([east, north]), footprint)) continue;
      coveredNeighbourhoodCount += 1;

      const current = elevationAt(grid, column, row);
      const eastNeighbour = elevationAt(grid, column + 1, row);
      const northNeighbour = elevationAt(grid, column, row + 1);
      if (
        !Number.isFinite(current) ||
        !Number.isFinite(eastNeighbour) ||
        !Number.isFinite(northNeighbour)
      ) {
        continue;
      }

      const eastGradient = (eastNeighbour - current) / grid.cellSizeMetres;
      const northGradient = (northNeighbour - current) / grid.cellSizeMetres;
      const slopeDegrees = radiansToDegrees(
        Math.atan(Math.hypot(eastGradient, northGradient)),
      );
      gradients.push({
        east: eastGradient,
        north: northGradient,
        slope: slopeDegrees,
      });
    }
  }

  if (gradients.length === 0) {
    return {
      status: "needs_checking",
      reasons: ["No valid elevation neighbourhoods cover the pool area."],
    };
  }
  if (
    gradients.length < 4 ||
    gradients.length / coveredNeighbourhoodCount < 0.75
  ) {
    return {
      status: "needs_checking",
      reasons: ["Insufficient valid elevation coverage across the pool area."],
    };
  }

  const averageSlopeDegrees = average(gradients.map(({ slope }) => slope));
  const upperSlopeDegrees = percentile(
    gradients.map(({ slope }) => slope),
    0.9,
  );
  const averageEastGradient = average(gradients.map(({ east }) => east));
  const averageNorthGradient = average(gradients.map(({ north }) => north));
  const isFlat = Math.hypot(averageEastGradient, averageNorthGradient) < 1e-9;
  const downhillBearingDegrees = isFlat
    ? null
    : normalizeBearing(
        radiansToDegrees(
          Math.atan2(-averageEastGradient, -averageNorthGradient),
        ),
      );
  const relativeFootprintElevations = footprint.coordinates.flatMap((ring) =>
    ring.map(
      ([east, north]) =>
        east * averageEastGradient + north * averageNorthGradient,
    ),
  );
  const estimatedFallMetres =
    Math.max(...relativeFootprintElevations) -
    Math.min(...relativeFootprintElevations);

  return {
    status: "measured",
    averageSlopeDegrees,
    upperSlopeDegrees,
    estimatedFallMetres,
    downhillBearingDegrees,
    downhillDirection:
      downhillBearingDegrees === null
        ? null
        : compassDirection(downhillBearingDegrees),
    confidence: "indicative",
  };
}

function elevationAt(grid: TerrainGrid, column: number, row: number): number {
  return grid.elevationsMetres[row * grid.width + column];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * quantile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const fraction = index - lowerIndex;
  return (
    sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction
  );
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360;
}

function compassDirection(bearingDegrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(bearingDegrees / 45) % directions.length];
}
