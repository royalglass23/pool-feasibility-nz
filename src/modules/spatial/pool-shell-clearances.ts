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
  metres: number;
  label: string;
};

export function formatPoolShellClearanceLabel(
  clearance: PoolShellClearance,
  index: number,
) {
  return `Side ${index + 1} · ${clearance.label}`;
}

/**
 * Measures from the centre of each pool-shell side along that side's outward
 * normal. These are indicative mapped distances, not corner clearances or
 * construction-envelope measurements.
 */
export function calculatePoolShellClearances(input: {
  shellGeometry: Polygon;
  boundaryGeometry: Polygon;
}): PoolShellClearance[] {
  if (
    !hasValidPolygonRing(input.shellGeometry) ||
    !hasValidPolygonRing(input.boundaryGeometry)
  ) {
    return [];
  }
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
        metres,
        label: `${metres.toFixed(1)} m`,
      },
    ];
  });
}

export function hasValidPolygonRing(geometry: unknown): geometry is Polygon {
  if (
    typeof geometry !== "object" ||
    geometry === null ||
    !("type" in geometry) ||
    geometry.type !== "Polygon" ||
    !("coordinates" in geometry) ||
    !Array.isArray(geometry.coordinates)
  ) {
    return false;
  }

  return (
    geometry.coordinates.length > 0 &&
    geometry.coordinates.every((ring) => {
      if (!Array.isArray(ring) || ring.length < 4) return false;
      if (
        !ring.every(
          (position) =>
            Array.isArray(position) &&
            position.length >= 2 &&
            Number.isFinite(position[0]) &&
            Number.isFinite(position[1]),
        )
      ) {
        return false;
      }

      const first = ring[0] as Position;
      const last = ring[ring.length - 1] as Position;
      return first[0] === last[0] && first[1] === last[1];
    })
  );
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
