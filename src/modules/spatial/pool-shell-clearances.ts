import {
  bearing,
  destination,
  distance,
  feature,
  lineIntersect,
  lineString,
  point,
} from "@turf/turf";
import type { Polygon, Position } from "geojson";

export type PoolShellClearance = {
  id: `pool-shell-side-${number}`;
  start: [number, number];
  end: [number, number];
  labelPosition: [number, number];
  metres: number;
  label: string;
};

/**
 * Measures from the centre of each pool-shell side along that side's outward
 * normal. These are indicative mapped distances, not corner clearances or
 * construction-envelope measurements.
 */
export function calculatePoolShellClearances(input: {
  shellGeometry: Polygon;
  boundaryGeometry: Polygon;
}): PoolShellClearance[] {
  const corners = input.shellGeometry.coordinates[0]?.slice(0, -1);
  if (!corners || corners.length !== 4) return [];

  const centre = averagePosition(corners);
  return corners.flatMap((corner, index) => {
    const nextCorner = corners[(index + 1) % corners.length];
    const start = midpoint(corner, nextCorner);
    const inwardBearing = bearing(point(start), point(centre));
    const rayEnd = destination(point(start), 50, inwardBearing + 180, {
      units: "kilometers",
    }).geometry.coordinates as [number, number];
    const intersections = lineIntersect(
      lineString([start, rayEnd]),
      feature(input.boundaryGeometry),
    ).features
      .map((intersection) => intersection.geometry.coordinates as [number, number])
      .map((candidate) => ({
        candidate,
        metres: distance(point(start), point(candidate), { units: "meters" }),
      }))
      .filter(({ metres }) => metres > 0.001)
      .sort((left, right) => left.metres - right.metres);
    const nearestBoundary = intersections[0];
    if (!nearestBoundary) return [];

    const metres = Math.round(nearestBoundary.metres * 10) / 10;
    return [
      {
        id: `pool-shell-side-${index}`,
        start,
        end: nearestBoundary.candidate,
        labelPosition: midpoint(start, nearestBoundary.candidate),
        metres,
        label: `${metres.toFixed(1)} m`,
      },
    ];
  });
}

function averagePosition(positions: Position[]): [number, number] {
  const [longitude, latitude] = positions.reduce(
    ([longitudeTotal, latitudeTotal], [longitude, latitude]) => [
      longitudeTotal + longitude,
      latitudeTotal + latitude,
    ],
    [0, 0],
  );
  return [longitude / positions.length, latitude / positions.length];
}

function midpoint(
  [startLongitude, startLatitude]: Position,
  [endLongitude, endLatitude]: Position,
): [number, number] {
  return [
    (startLongitude + endLongitude) / 2,
    (startLatitude + endLatitude) / 2,
  ];
}
