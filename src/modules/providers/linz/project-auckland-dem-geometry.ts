import "server-only";

import type { Polygon, Position } from "geojson";
import proj4 from "proj4";

const WGS84 = "EPSG:4326";
const NZTM2000 =
  "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs";

export function projectWgs84PolygonToNztm(polygon: Polygon): Polygon {
  assertValidPolygonStructure(polygon);

  return {
    type: "Polygon",
    coordinates: polygon.coordinates.map((ring) =>
      ring.map((position) => projectWgs84PositionToNztm(position)),
    ),
  };
}

export function projectNztmPolygonToWgs84(polygon: Polygon): Polygon {
  assertValidNztmPolygonStructure(polygon);

  return {
    type: "Polygon",
    coordinates: polygon.coordinates.map((ring) =>
      ring.map(([east, north]) => proj4(NZTM2000, WGS84, [east, north])),
    ),
  };
}

function assertValidNztmPolygonStructure(polygon: Polygon): void {
  assertPolygonStructure({
    polygon,
    coordinateSystem: "NZTM",
    invalidPositionMessage: "positions require finite eastings and northings.",
    isValidPosition: (position) =>
      Array.isArray(position) &&
      position.length >= 2 &&
      Number.isFinite(position[0]) &&
      Number.isFinite(position[1]),
  });
}

function assertValidPolygonStructure(polygon: Polygon): void {
  assertPolygonStructure({
    polygon,
    coordinateSystem: "WGS84",
    invalidPositionMessage:
      "positions require finite longitude and latitude within WGS84 bounds.",
    isValidPosition: positionIsWithinWgs84Bounds,
  });
}

function assertPolygonStructure(input: {
  polygon: Polygon;
  coordinateSystem: "WGS84" | "NZTM";
  invalidPositionMessage: string;
  isValidPosition: (position: Position) => boolean;
}): void {
  const prefix = `Invalid ${input.coordinateSystem} polygon`;
  const polygon = input.polygon;
  if (
    polygon.type !== "Polygon" ||
    !Array.isArray(polygon.coordinates) ||
    polygon.coordinates.length === 0
  ) {
    throw new TypeError(`${prefix}: coordinates are required.`);
  }

  for (const ring of polygon.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new TypeError(
        `${prefix}: every linear ring needs at least four positions.`,
      );
    }

    for (let positionIndex = 0; positionIndex < ring.length; positionIndex++) {
      if (!(positionIndex in ring)) {
        throw new TypeError(
          `${prefix}: every linear ring position must be present.`,
        );
      }

      if (!input.isValidPosition(ring[positionIndex])) {
        throw new TypeError(`${prefix}: ${input.invalidPositionMessage}`);
      }
    }

    const first = ring[0];
    const last = ring.at(-1);
    if (first[0] !== last?.[0] || first[1] !== last?.[1]) {
      throw new TypeError(`${prefix}: every linear ring must be closed.`);
    }
  }
}

function positionIsWithinWgs84Bounds(position: Position): boolean {
  if (!Array.isArray(position) || position.length < 2) return false;

  const [longitude, latitude] = position;
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function projectWgs84PositionToNztm([longitude, latitude]: Position): Position {
  const [east, north] = proj4(WGS84, NZTM2000, [longitude, latitude]);
  return [east, north];
}
