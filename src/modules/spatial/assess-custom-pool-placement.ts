import {
  booleanIntersects,
  booleanWithin,
  destination,
  feature,
  point,
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  Polygon,
  Position,
} from "geojson";

const MIN_DIMENSION_METRES = 0.1;
const MAX_DIMENSION_METRES = 30;
const CONSTRUCTION_ALLOWANCE_METRES = 1;
const BARRIER_CLEARANCE_METRES = 1.2;
const ACCESS_CLEARANCE_METRES = 1.5;

export interface CustomPoolPlacementEvidence {
  id: string;
  label: string;
  status: "available" | "unavailable";
  geometry?: FeatureCollection<Geometry>;
}

export type CustomPoolPlacementConflictType =
  | "outside_confirmed_parcel"
  | "building_overlap"
  | "measured_constraint_intersection";

export interface CustomPoolPlacementConflict {
  type: CustomPoolPlacementConflictType;
  evidenceId: string;
  message: string;
}

export interface CustomPoolPlacementUnknownEvidence {
  evidenceId: string;
  message: string;
}

export interface CustomPoolPlacementAssessment {
  classification: "clear" | "hard_conflict" | "unknown";
  position: readonly [number, number];
  rotationDegrees: number;
  dimensions: { lengthMetres: number; widthMetres: number };
  shell: Feature<Polygon>;
  envelopes: {
    constructionAllowance: Feature<Polygon>;
    barrier: Feature<Polygon>;
    access: Feature<Polygon>;
  };
  hardConflicts: CustomPoolPlacementConflict[];
  unknownEvidence: CustomPoolPlacementUnknownEvidence[];
}

export class CustomPoolPlacementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomPoolPlacementValidationError";
  }
}

export function assessCustomPoolPlacement(input: {
  parcel: Polygon;
  parcelStatus: "confirmed" | "unconfirmed";
  position: readonly [number, number];
  rotationDegrees: number;
  lengthMetres: number | undefined;
  widthMetres: number | undefined;
  parcelEvidence: CustomPoolPlacementEvidence;
  buildings: CustomPoolPlacementEvidence;
  constraints: CustomPoolPlacementEvidence[];
}): CustomPoolPlacementAssessment {
  const lengthMetres = validateDimension("length", input.lengthMetres);
  const widthMetres = validateDimension("width", input.widthMetres);
  const position = validatePosition(input.position);
  const rotationDegrees = validateRotation(input.rotationDegrees);

  const shell = rectangleAt(
    position,
    lengthMetres,
    widthMetres,
    rotationDegrees,
  );
  const envelopes = {
    constructionAllowance: rectangleAt(
      position,
      lengthMetres + CONSTRUCTION_ALLOWANCE_METRES * 2,
      widthMetres + CONSTRUCTION_ALLOWANCE_METRES * 2,
      rotationDegrees,
    ),
    barrier: rectangleAt(
      position,
      lengthMetres + BARRIER_CLEARANCE_METRES * 2,
      widthMetres + BARRIER_CLEARANCE_METRES * 2,
      rotationDegrees,
    ),
    access: rectangleAt(
      position,
      lengthMetres + ACCESS_CLEARANCE_METRES * 2,
      widthMetres + ACCESS_CLEARANCE_METRES * 2,
      rotationDegrees,
    ),
  };
  const hardConflicts: CustomPoolPlacementConflict[] = [];
  const unknownEvidence: CustomPoolPlacementUnknownEvidence[] = [];
  const screeningEnvelope = envelopes.constructionAllowance;
  const parcelFeature = feature(input.parcel);

  if (
    input.parcelStatus !== "confirmed" ||
    input.parcelEvidence.status !== "available"
  ) {
    unknownEvidence.push({
      evidenceId: input.parcelEvidence.id,
      message:
        "The legal parcel is not confirmed and cannot establish a clear placement boundary.",
    });
  } else if (!booleanWithin(screeningEnvelope, parcelFeature)) {
    hardConflicts.push({
      type: "outside_confirmed_parcel",
      evidenceId: input.parcelEvidence.id,
      message: "The construction allowance leaves the confirmed parcel.",
    });
  }

  if (input.buildings.status !== "available" || !input.buildings.geometry) {
    unknownEvidence.push({
      evidenceId: input.buildings.id,
      message:
        "Building footprint evidence is unavailable, so building clearance is unknown.",
    });
  } else if (
    input.buildings.geometry.features.some((building) =>
      booleanIntersects(screeningEnvelope, building),
    )
  ) {
    hardConflicts.push({
      type: "building_overlap",
      evidenceId: input.buildings.id,
      message:
        "The construction allowance overlaps a mapped building footprint.",
    });
  }

  for (const constraint of input.constraints) {
    if (constraint.status !== "available" || !constraint.geometry) {
      unknownEvidence.push({
        evidenceId: constraint.id,
        message: `${constraint.label} evidence is unavailable, so exclusion clearance is unknown.`,
      });
      continue;
    }
    if (
      constraint.geometry.features.some((mappedConstraint) =>
        booleanIntersects(screeningEnvelope, mappedConstraint),
      )
    ) {
      hardConflicts.push({
        type: "measured_constraint_intersection",
        evidenceId: constraint.id,
        message: `The construction allowance intersects the measured ${constraint.label} exclusion.`,
      });
    }
  }

  return {
    classification:
      hardConflicts.length > 0
        ? "hard_conflict"
        : unknownEvidence.length > 0
          ? "unknown"
          : "clear",
    position,
    rotationDegrees,
    dimensions: { lengthMetres, widthMetres },
    shell,
    envelopes,
    hardConflicts,
    unknownEvidence,
  };
}

function validateDimension(name: string, value: number | undefined): number {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value < MIN_DIMENSION_METRES ||
    value > MAX_DIMENSION_METRES
  ) {
    throw new CustomPoolPlacementValidationError(
      `${name} must be between ${MIN_DIMENSION_METRES} and ${MAX_DIMENSION_METRES} metres.`,
    );
  }
  return value;
}

function validatePosition(
  position: readonly [number, number],
): [number, number] {
  if (
    position.length < 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    position[0] < -180 ||
    position[0] > 180 ||
    position[1] < -90 ||
    position[1] > 90
  ) {
    throw new CustomPoolPlacementValidationError(
      "position must contain a valid longitude and latitude.",
    );
  }
  return [position[0], position[1]];
}

function validateRotation(rotationDegrees: number): number {
  if (!Number.isFinite(rotationDegrees)) {
    throw new CustomPoolPlacementValidationError(
      "rotation must be a finite number of degrees.",
    );
  }
  return ((rotationDegrees % 360) + 360) % 360;
}

function rectangleAt(
  centre: Position,
  lengthMetres: number,
  widthMetres: number,
  rotationDegrees: number,
): Feature<Polygon> {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners: Array<[number, number]> = [
    [-lengthMetres / 2, -widthMetres / 2],
    [lengthMetres / 2, -widthMetres / 2],
    [lengthMetres / 2, widthMetres / 2],
    [-lengthMetres / 2, widthMetres / 2],
  ];
  const coordinates = corners.map(([x, y]) =>
    positionFromOffset(centre, x * cos - y * sin, x * sin + y * cos),
  );
  coordinates.push(coordinates[0]);
  return feature({ type: "Polygon", coordinates: [coordinates] });
}

function positionFromOffset(
  origin: Position,
  eastMetres: number,
  northMetres: number,
): Position {
  const eastWest = destination(
    point(origin),
    Math.abs(eastMetres),
    eastMetres >= 0 ? 90 : -90,
    { units: "meters" },
  );
  return destination(
    eastWest,
    Math.abs(northMetres),
    northMetres >= 0 ? 0 : 180,
    { units: "meters" },
  ).geometry.coordinates;
}
