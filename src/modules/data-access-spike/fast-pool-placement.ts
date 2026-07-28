import {
  bbox,
  booleanWithin,
  centroid,
  feature,
  pointOnFeature,
} from "@turf/turf";
import type { Feature, Polygon, Position } from "geojson";
import { destination } from "@turf/turf";

export const FAST_POOL_CATALOGUE = [
  { id: "plunge", label: "Plunge", lengthMetres: 4, widthMetres: 2.4 },
  { id: "compact", label: "Compact", lengthMetres: 6.5, widthMetres: 3 },
  { id: "slimline", label: "Slimline", lengthMetres: 8, widthMetres: 3 },
  { id: "family", label: "Family", lengthMetres: 8, widthMetres: 4 },
  { id: "large", label: "Large", lengthMetres: 10, widthMetres: 4.4 },
  { id: "custom", label: "Custom", lengthMetres: 6.5, widthMetres: 3 },
] as const;

export type FastPoolId = (typeof FAST_POOL_CATALOGUE)[number]["id"];

export const FAST_CUSTOM_POOL_LIMITS = {
  length: { min: 2, max: 20 },
  width: { min: 1.5, max: 10 },
  step: 0.1,
} as const;

export function validateFastCustomDimensions(
  lengthMetres: number,
  widthMetres: number,
): { lengthMetres: number; widthMetres: number } | null {
  if (
    !isStepValue(lengthMetres, FAST_CUSTOM_POOL_LIMITS.step) ||
    !isStepValue(widthMetres, FAST_CUSTOM_POOL_LIMITS.step) ||
    lengthMetres < FAST_CUSTOM_POOL_LIMITS.length.min ||
    lengthMetres > FAST_CUSTOM_POOL_LIMITS.length.max ||
    widthMetres < FAST_CUSTOM_POOL_LIMITS.width.min ||
    widthMetres > FAST_CUSTOM_POOL_LIMITS.width.max
  ) {
    return null;
  }
  return { lengthMetres, widthMetres };
}

export function buildFastPoolGeometry(
  center: Position,
  lengthMetres: number,
  widthMetres: number,
  rotationDegrees = 0,
): Feature<Polygon> {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    [-lengthMetres / 2, -widthMetres / 2],
    [lengthMetres / 2, -widthMetres / 2],
    [lengthMetres / 2, widthMetres / 2],
    [-lengthMetres / 2, widthMetres / 2],
  ].map(([east, north]) =>
    offsetPosition(center, east * cos - north * sin, east * sin + north * cos),
  );
  corners.push(corners[0]);
  return feature({ type: "Polygon", coordinates: [corners] });
}

export function isFastPoolWithinMappedArea(
  center: Position,
  dimensions: { lengthMetres: number; widthMetres: number },
  rotationDegrees: number,
  mappedArea: Polygon,
): boolean {
  return booleanWithin(
    buildFastPoolGeometry(
      center,
      dimensions.lengthMetres,
      dimensions.widthMetres,
      rotationDegrees,
    ),
    feature(mappedArea),
  );
}

export function findFastPoolDefaultPosition(
  mappedArea: Polygon,
  dimensions: { lengthMetres: number; widthMetres: number },
  rotationDegrees = 0,
): Position | null {
  const candidates: Position[] = [
    centroid(feature(mappedArea)).geometry.coordinates,
    pointOnFeature(feature(mappedArea)).geometry.coordinates,
  ];
  const [minX, minY, maxX, maxY] = bbox(feature(mappedArea));
  for (const xRatio of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    for (const yRatio of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      candidates.push([
        minX + (maxX - minX) * xRatio,
        minY + (maxY - minY) * yRatio,
      ]);
    }
  }
  return (
    candidates.find((candidate) =>
      isFastPoolWithinMappedArea(
        candidate,
        dimensions,
        rotationDegrees,
        mappedArea,
      ),
    ) ?? null
  );
}

function isStepValue(value: number, step: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.abs(value / step - Math.round(value / step)) < 1e-8
  );
}

function offsetPosition(
  origin: Position,
  eastMetres: number,
  northMetres: number,
): [number, number] {
  const eastWest = destination(
    feature({ type: "Point", coordinates: origin }),
    Math.abs(eastMetres),
    eastMetres >= 0 ? 90 : -90,
    { units: "meters" },
  );
  return destination(
    eastWest,
    Math.abs(northMetres),
    northMetres >= 0 ? 0 : 180,
    { units: "meters" },
  ).geometry.coordinates as [number, number];
}
