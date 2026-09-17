import type { Polygon } from "geojson";
import { booleanPointInPolygon, point } from "@turf/turf";
import { projectWgs84PolygonToNztm } from "@/modules/spatial/project-nztm-geometry";
import type { TerrainSlopeSample } from "@/modules/terrain/property-terrain";

export type SelectedPoolTerrain = {
  averageSlopeDegrees: number;
  estimatedFallMetres: number;
  sampleCount: number;
};

export function assessSelectedPoolTerrain(input: {
  samples: TerrainSlopeSample[];
  footprint: Polygon;
}): SelectedPoolTerrain | null {
  const samples = input.samples.filter((sample) =>
    booleanPointInPolygon(point(sample.position), input.footprint),
  );
  if (samples.length < 4) return null;

  const averageSlopeDegrees = averageNumber(
    samples.map(({ slopeDegrees }) => slopeDegrees),
  );
  const averageEastGradient = averageNumber(
    samples.map(({ eastGradient }) => eastGradient),
  );
  const averageNorthGradient = averageNumber(
    samples.map(({ northGradient }) => northGradient),
  );
  const positions = projectWgs84PolygonToNztm(
    input.footprint,
  ).coordinates.flat();
  const origin = positions[0];
  const relativeElevations = positions.map(
    ([eastMetres, northMetres]) =>
      (eastMetres - origin[0]) * averageEastGradient +
      (northMetres - origin[1]) * averageNorthGradient,
  );

  return {
    averageSlopeDegrees,
    estimatedFallMetres:
      Math.max(...relativeElevations) - Math.min(...relativeElevations),
    sampleCount: samples.length,
  };
}

function averageNumber(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
