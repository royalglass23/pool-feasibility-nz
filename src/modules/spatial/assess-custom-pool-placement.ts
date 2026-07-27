import {
  booleanIntersects,
  booleanWithin,
  destination,
  feature,
  pointToLineDistance,
  point,
  polygonToLine,
  lineString,
  distance,
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
  technicalLabel: string;
  customerMessage: string;
  message: string;
}

export interface CustomPoolPlacementUnknownEvidence {
  evidenceId: string;
  technicalLabel: string;
  customerMessage: string;
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
  distances: {
    parcelBoundaryMetres: number | null;
    buildingsMetres: number | null;
    mappedServicesMetres: number | null;
    manholesMetres: number | null;
    catchpitsMetres: number | null;
  };
  confidence: number;
  confidenceLabel: "High confidence" | "Preliminary result — review required";
  nextAction: string;
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
  services?: CustomPoolPlacementEvidence[];
  manholes?: CustomPoolPlacementEvidence[];
  catchpits?: CustomPoolPlacementEvidence[];
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
  const services = input.services ?? [];
  const manholes = input.manholes ?? [];
  const catchpits = input.catchpits ?? [];

  if (
    input.parcelStatus !== "confirmed" ||
    input.parcelEvidence.status !== "available"
  ) {
    unknownEvidence.push({
      evidenceId: input.parcelEvidence.id,
      technicalLabel: "Legal parcel confirmation",
      customerMessage: "The legal parcel still needs to be confirmed.",
      message:
        "The legal parcel is not confirmed and cannot establish a clear placement boundary.",
    });
  } else if (!booleanWithin(screeningEnvelope, parcelFeature)) {
    hardConflicts.push({
      type: "outside_confirmed_parcel",
      evidenceId: input.parcelEvidence.id,
      technicalLabel: "Outside confirmed parcel",
      customerMessage:
        "This pool layout extends beyond the confirmed property boundary.",
      message: "The construction allowance leaves the confirmed parcel.",
    });
  }

  const buildingGeometry = input.buildings.geometry;
  if (!hasUsableGeometry(input.buildings) || !buildingGeometry) {
    unknownEvidence.push({
      evidenceId: input.buildings.id,
      technicalLabel: "Building footprint evidence",
      customerMessage:
        "Building clearance could not be checked from the available mapped evidence.",
      message:
        "Building footprint evidence is unavailable, so building clearance is unknown.",
    });
  } else if (
    buildingGeometry.features.some((building) =>
      booleanIntersects(screeningEnvelope, building),
    )
  ) {
    hardConflicts.push({
      type: "building_overlap",
      evidenceId: input.buildings.id,
      technicalLabel: "Mapped building overlap",
      customerMessage: "This pool layout overlaps a mapped building.",
      message:
        "The construction allowance overlaps a mapped building footprint.",
    });
  }

  for (const constraint of input.constraints) {
    const constraintGeometry = constraint.geometry;
    if (!hasUsableGeometry(constraint) || !constraintGeometry) {
      unknownEvidence.push({
        evidenceId: constraint.id,
        technicalLabel: `${constraint.label} evidence`,
        customerMessage: `${constraint.label} clearance could not be checked from the available mapped evidence.`,
        message: `${constraint.label} evidence is unavailable, so exclusion clearance is unknown.`,
      });
      continue;
    }
    if (
      constraintGeometry.features.some((mappedConstraint) =>
        booleanIntersects(screeningEnvelope, mappedConstraint),
      )
    ) {
      hardConflicts.push({
        type: "measured_constraint_intersection",
        evidenceId: constraint.id,
        technicalLabel: "Measured constraint intersection",
        customerMessage: `This pool layout intersects a mapped ${constraint.label} exclusion.`,
        message: `The construction allowance intersects the measured ${constraint.label} exclusion.`,
      });
    }
  }

  const assetGroups = [
    {
      evidence: services,
      id: "mapped_services",
      label: "Mapped service",
      unknownMessage:
        "Mapped service clearance could not be checked from the available evidence.",
      distanceKey: "mappedServicesMetres" as const,
    },
    {
      evidence: manholes,
      id: "manholes",
      label: "manhole",
      unknownMessage:
        "Manhole clearance could not be checked from the available evidence.",
      distanceKey: "manholesMetres" as const,
    },
    {
      evidence: catchpits,
      id: "catchpits",
      label: "catchpit",
      unknownMessage:
        "Catchpit clearance could not be checked from the available evidence.",
      distanceKey: "catchpitsMetres" as const,
    },
  ];
  const distances = {
    parcelBoundaryMetres: distanceToPolygonBoundary(
      screeningEnvelope,
      input.parcel,
    ),
    buildingsMetres: distanceToEvidence(screeningEnvelope, input.buildings),
    mappedServicesMetres: null as number | null,
    manholesMetres: null as number | null,
    catchpitsMetres: null as number | null,
  };
  for (const group of assetGroups) {
    if (group.evidence.length === 0) continue;
    const available = group.evidence.filter(hasUsableGeometry);
    if (available.length === 0) {
      unknownEvidence.push({
        evidenceId: group.id,
        technicalLabel: `${group.label.charAt(0).toUpperCase()}${group.label.slice(1)} evidence`,
        customerMessage: group.unknownMessage,
        message: group.unknownMessage,
      });
      continue;
    }
    const measuredDistances = available
      .map((item) => distanceToEvidence(screeningEnvelope, item))
      .filter(isNumber);
    distances[group.distanceKey] =
      measuredDistances.length > 0 ? Math.min(...measuredDistances) : null;
    if (group.evidence.some((item) => item.status === "unavailable")) {
      unknownEvidence.push({
        evidenceId: group.id,
        technicalLabel: `${group.label.charAt(0).toUpperCase()}${group.label.slice(1)} coverage`,
        customerMessage: `${group.label} coverage is incomplete, so the result needs review.`,
        message: `${group.label} coverage is incomplete, so unmapped assets cannot be ruled out.`,
      });
    }
    for (const item of available) {
      if (
        !item.geometry?.features.some((mappedAsset) =>
          booleanIntersects(screeningEnvelope, mappedAsset),
        )
      )
        continue;
      hardConflicts.push({
        type: "measured_constraint_intersection",
        evidenceId: item.id,
        technicalLabel: `${group.label} overlap`,
        customerMessage: `This pool layout overlaps a mapped ${group.label}.`,
        message: `The construction allowance overlaps a mapped ${group.label}.`,
      });
    }
  }

  const confidence = Math.max(0, 100 - unknownEvidence.length * 20);
  const confidenceLabel =
    confidence >= 80
      ? "High confidence"
      : "Preliminary result — review required";
  const nextAction =
    confidence < 80
      ? "Preliminary result — review required"
      : hardConflicts.length > 0
        ? "Do not proceed with this layout until the hard GIS conflict is resolved."
        : "No measured GIS conflict; continue to review the preliminary result.";

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
    distances,
    confidence,
    confidenceLabel,
    nextAction,
  };
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function hasUsableGeometry(evidence: CustomPoolPlacementEvidence): boolean {
  return (
    evidence.status === "available" &&
    Boolean(evidence.geometry && evidence.geometry.features.length > 0)
  );
}

function distanceToPolygonBoundary(
  source: Feature<Polygon>,
  target: Polygon,
): number {
  const boundary = polygonToLine(feature(target));
  return Math.min(
    ...source.geometry.coordinates[0].map((coordinate) =>
      distanceToBoundary(point(coordinate), boundary),
    ),
  );
}

function distanceToBoundary(
  candidate: ReturnType<typeof point>,
  boundary: ReturnType<typeof polygonToLine>,
): number {
  const lines =
    boundary.type === "FeatureCollection" ? boundary.features : [boundary];
  return Math.min(
    ...lines.flatMap((line) => {
      if (line.geometry.type === "LineString") {
        return pointToLineDistance(
          candidate,
          lineString(line.geometry.coordinates),
          { units: "meters" },
        );
      }
      return line.geometry.coordinates.map((coordinates) =>
        pointToLineDistance(candidate, lineString(coordinates), {
          units: "meters",
        }),
      );
    }),
  );
}

function distanceToEvidence(
  source: Feature<Polygon>,
  evidence: CustomPoolPlacementEvidence,
): number | null {
  if (!hasUsableGeometry(evidence) || !evidence.geometry) return null;
  return Math.min(
    ...evidence.geometry.features.map((item) =>
      distanceToGeometry(source, item.geometry),
    ),
  );
}

function distanceToGeometry(
  source: Feature<Polygon>,
  geometry: Geometry,
): number {
  const sourcePoints = source.geometry.coordinates[0].map((coordinate) =>
    point(coordinate),
  );
  if (geometry.type === "Point") {
    return Math.min(
      ...sourcePoints.map((candidate) =>
        distance(candidate, point(geometry.coordinates), { units: "meters" }),
      ),
    );
  }
  if (geometry.type === "LineString") {
    const line = lineString(geometry.coordinates);
    return Math.min(
      ...sourcePoints.map((candidate) =>
        pointToLineDistance(candidate, line, { units: "meters" }),
      ),
    );
  }
  if (geometry.type === "MultiLineString") {
    return Math.min(
      ...geometry.coordinates.map((coordinates) =>
        distanceToGeometry(source, lineString(coordinates).geometry),
      ),
    );
  }
  if (geometry.type === "Polygon") {
    const boundary = polygonToLine(feature(geometry));
    return Math.min(
      ...sourcePoints.map((candidate) =>
        distanceToBoundary(candidate, boundary),
      ),
    );
  }
  if (geometry.type === "MultiPolygon") {
    return Math.min(
      ...geometry.coordinates.map((coordinates) =>
        distanceToGeometry(source, { type: "Polygon", coordinates }),
      ),
    );
  }
  if (geometry.type === "GeometryCollection") {
    return Math.min(
      ...geometry.geometries.map((child) => distanceToGeometry(source, child)),
    );
  }
  const positions = positionsOf(geometry);
  return Math.min(
    ...sourcePoints.flatMap((candidate) =>
      positions.map((target) =>
        distance(candidate, point(target), { units: "meters" }),
      ),
    ),
  );
}

function positionsOf(geometry: Geometry): Position[] {
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap(positionsOf);
  }
  const positions: Position[] = [];
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number") {
      positions.push(value as Position);
      return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
  return positions;
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
