import {
  area,
  bbox,
  booleanDisjoint,
  booleanIntersects,
  booleanWithin,
  coordAll,
  destination,
  difference,
  distance,
  feature,
  featureCollection,
  intersect,
  lineString,
  point,
  pointToLineDistance,
  polygonToLine,
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { PoolScenarioConfig } from "@/config/pool-scenarios";

export interface SpatialEvidenceProvenance {
  provider: string;
  dataset: string;
  datasetIdentifier: string;
  retrievedAt: string;
  datasetDate: string | null;
  licence: string;
  attribution: { text: string; url: string } | null;
  geometryUsed: string | null;
  attributesUsed: string[];
  evidenceType: string;
  confidence: "high" | "limited" | "unavailable";
}

export interface SpatialEvidenceInput {
  id: string;
  label: string;
  status: "available" | "unavailable";
  geometry?: FeatureCollection<Geometry>;
  provenance: SpatialEvidenceProvenance;
}

export interface ConstraintIntersection {
  evidence: SpatialEvidenceInput;
  status: "measured" | "unavailable";
  intersects: boolean | null;
  affectedEnvelopePercent: number | null;
}

export interface MappedServiceDistance {
  evidence: SpatialEvidenceInput;
  status: "measured" | "no_mapped_feature" | "unknown";
  distanceMetres: number | null;
}

export interface CompactCandidate {
  id: string;
  rank: number;
  centre: Position;
  rotationDegrees: number;
  shell: Feature<Polygon>;
  envelope: Feature<Polygon>;
  placementEvidence: {
    parcel: SpatialEvidenceInput;
    buildings: SpatialEvidenceInput;
  };
  constraintIntersections: ConstraintIntersection[];
  mappedServiceDistances: MappedServiceDistance[];
  rankingEvidence: string[];
}

export interface CompactCandidateAnalysis {
  scenario: {
    id: "compact";
    label: "Compact";
    version: string;
    shellLengthMetres: number;
    shellWidthMetres: number;
    constructionAllowanceMetres: number;
    rotationsDegrees: number[];
    placementSpacingMetres: number;
    maximumTestedPlacements: number;
    maximumCandidates: number;
  };
  status: "candidates_found" | "no_clear_candidate" | "insufficient_data";
  resultWording: string;
  testedPlacementCount: number;
  testedRotationsDegrees: number[];
  usableAreaSquareMetres: number | null;
  analysisEvidence: {
    parcel: SpatialEvidenceInput;
    buildings: SpatialEvidenceInput;
  };
  candidates: CompactCandidate[];
  missingRequiredEvidence: string[];
}

export function analyzeCompactCandidates(input: {
  parcel: Polygon;
  parcelStatus: "confirmed" | "unconfirmed";
  parcelEvidence: SpatialEvidenceInput;
  buildings: SpatialEvidenceInput;
  constraints: SpatialEvidenceInput[];
  mappedServices: SpatialEvidenceInput[];
  config: PoolScenarioConfig;
}): CompactCandidateAnalysis {
  if (input.parcelStatus !== "confirmed") {
    return insufficientData(input, ["legal_parcel"]);
  }
  if (input.buildings.status !== "available" || !input.buildings.geometry) {
    return insufficientData(input, [input.buildings.id]);
  }

  const buildings = input.buildings.geometry.features.flatMap((item) =>
    item.geometry.type === "Polygon" || item.geometry.type === "MultiPolygon"
      ? [item as Feature<Polygon | MultiPolygon>]
      : [],
  );
  const parcelFeature = feature(input.parcel);
  const usableGeometry = subtractBuildings(parcelFeature, buildings);
  const usableAreaSquareMetres = usableGeometry ? area(usableGeometry) : 0;
  const rotations = [...input.config.rotationsDegrees];
  const [west, south, east, north] = bbox(parcelFeature);
  const origin: Position = [(west + east) / 2, (south + north) / 2];
  const widthMetres = distance(
    point([west, origin[1]]),
    point([east, origin[1]]),
    { units: "meters" },
  );
  const heightMetres = distance(
    point([origin[0], south]),
    point([origin[0], north]),
    { units: "meters" },
  );
  const { xPositions, yPositions } = boundedPlacementGrid(
    widthMetres,
    heightMetres,
    rotations.length,
    input.config,
  );
  const candidates: CompactCandidate[] = [];
  let testedPlacementCount = 0;

  for (const x of xPositions) {
    for (const y of yPositions) {
      const centre = positionFromOffset(origin, x, y);
      for (const rotationDegrees of rotations) {
        testedPlacementCount += 1;
        const shell = rectangleAt(
          centre,
          input.config.shell.lengthMetres,
          input.config.shell.widthMetres,
          rotationDegrees,
        );
        const envelope = rectangleAt(
          centre,
          input.config.shell.lengthMetres +
            input.config.constructionAllowanceMetres * 2,
          input.config.shell.widthMetres +
            input.config.constructionAllowanceMetres * 2,
          rotationDegrees,
        );

        if (!booleanWithin(envelope, parcelFeature)) continue;
        if (buildings.some((building) => !booleanDisjoint(envelope, building)))
          continue;

        const constraintIntersections = input.constraints.map((evidence) =>
          measureConstraintIntersection(envelope, evidence),
        );
        const mappedServiceDistances = input.mappedServices.map((evidence) =>
          measureMappedServiceDistance(envelope, evidence),
        );
        candidates.push({
          id: `compact-${candidates.length + 1}`,
          rank: 0,
          centre,
          rotationDegrees,
          shell,
          envelope,
          placementEvidence: {
            parcel: input.parcelEvidence,
            buildings: input.buildings,
          },
          constraintIntersections,
          mappedServiceDistances,
          rankingEvidence: rankingEvidence(
            constraintIntersections,
            mappedServiceDistances,
          ),
        });
      }
    }
  }

  const ranked = candidates
    .sort(compareCandidates)
    .slice(0, input.config.maximumCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return {
    scenario: scenarioResult(input.config),
    status: ranked.length > 0 ? "candidates_found" : "no_clear_candidate",
    resultWording:
      ranked.length > 0
        ? "Indicative Compact screening candidates were identified from deterministic mapped geometry. These are not approved pool positions."
        : "No clear candidate area was identified using the tested screening scenarios.",
    testedPlacementCount,
    testedRotationsDegrees: rotations,
    usableAreaSquareMetres,
    analysisEvidence: {
      parcel: input.parcelEvidence,
      buildings: input.buildings,
    },
    candidates: ranked,
    missingRequiredEvidence: [],
  };
}

function scenarioResult(config: PoolScenarioConfig) {
  return {
    id: config.id,
    label: config.label,
    version: config.version,
    shellLengthMetres: config.shell.lengthMetres,
    shellWidthMetres: config.shell.widthMetres,
    constructionAllowanceMetres: config.constructionAllowanceMetres,
    rotationsDegrees: [...config.rotationsDegrees],
    placementSpacingMetres: config.placementGridMetres,
    maximumTestedPlacements: config.maximumTestedPlacements,
    maximumCandidates: config.maximumCandidates,
  };
}

function insufficientData(
  input: Parameters<typeof analyzeCompactCandidates>[0],
  missingRequiredEvidence: string[],
): CompactCandidateAnalysis {
  return {
    scenario: scenarioResult(input.config),
    status: "insufficient_data",
    resultWording:
      "Insufficient verified mapped data is available to test Compact screening candidates safely.",
    testedPlacementCount: 0,
    testedRotationsDegrees: [...input.config.rotationsDegrees],
    usableAreaSquareMetres: null,
    analysisEvidence: {
      parcel: input.parcelEvidence,
      buildings: input.buildings,
    },
    candidates: [],
    missingRequiredEvidence,
  };
}

function subtractBuildings(
  parcel: Feature<Polygon | MultiPolygon>,
  buildings: Array<Feature<Polygon | MultiPolygon>>,
): Feature<Polygon | MultiPolygon> | null {
  return buildings.reduce<Feature<Polygon | MultiPolygon> | null>(
    (usable, building) =>
      usable ? difference(featureCollection([usable, building])) : null,
    parcel,
  );
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
  const coordinates = corners.map(([x, y]) => {
    const eastMetres = x * cos - y * sin;
    const northMetres = x * sin + y * cos;
    return positionFromOffset(centre, eastMetres, northMetres);
  });
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

function measureConstraintIntersection(
  envelope: Feature<Polygon>,
  evidence: SpatialEvidenceInput,
): ConstraintIntersection {
  if (evidence.status !== "available" || !evidence.geometry) {
    return {
      evidence,
      status: "unavailable",
      intersects: null,
      affectedEnvelopePercent: null,
    };
  }

  let intersects = false;
  let affectedAreaSquareMetres = 0;
  for (const constraint of evidence.geometry.features) {
    if (!booleanIntersects(envelope, constraint)) continue;
    intersects = true;
    if (
      constraint.geometry.type === "Polygon" ||
      constraint.geometry.type === "MultiPolygon"
    ) {
      const overlap = intersect(
        featureCollection([
          envelope,
          constraint as Feature<Polygon | MultiPolygon>,
        ]),
      );
      if (overlap) affectedAreaSquareMetres += area(overlap);
    }
  }
  return {
    evidence,
    status: "measured",
    intersects,
    affectedEnvelopePercent:
      affectedAreaSquareMetres === 0
        ? null
        : roundTo(
            Math.min(100, (affectedAreaSquareMetres / area(envelope)) * 100),
            1,
          ),
  };
}

function measureMappedServiceDistance(
  envelope: Feature<Polygon>,
  evidence: SpatialEvidenceInput,
): MappedServiceDistance {
  if (evidence.status !== "available" || !evidence.geometry) {
    return { evidence, status: "unknown", distanceMetres: null };
  }
  if (evidence.geometry.features.length === 0) {
    return { evidence, status: "no_mapped_feature", distanceMetres: null };
  }

  const distances = evidence.geometry.features.flatMap((mappedFeature) => {
    const measured = distanceFromEnvelope(envelope, mappedFeature);
    return Number.isFinite(measured) ? [measured] : [];
  });
  return distances.length === 0
    ? { evidence, status: "unknown", distanceMetres: null }
    : {
        evidence,
        status: "measured",
        distanceMetres: roundTo(Math.min(...distances), 1),
      };
}

function rankingEvidence(
  constraints: ConstraintIntersection[],
  services: MappedServiceDistance[],
): string[] {
  const measuredConstraints = constraints.filter(
    (measurement) => measurement.status === "measured",
  );
  const intersections = measuredConstraints.filter(
    (measurement) => measurement.intersects,
  ).length;
  const unavailableConstraints =
    constraints.length - measuredConstraints.length;
  const measuredDistances = services.flatMap((measurement) =>
    measurement.distanceMetres === null ? [] : [measurement.distanceMetres],
  );
  const unavailableServices = services.filter(
    (measurement) => measurement.status === "unknown",
  ).length;
  const nearestService =
    measuredDistances.length === 0 ? null : Math.min(...measuredDistances);

  return [
    "Entire indicative construction envelope is inside the mapped parcel.",
    "Envelope does not intersect a known building footprint.",
    intersections === 0
      ? `No intersection was measured across ${measuredConstraints.length} available mapped constraint layer${measuredConstraints.length === 1 ? "" : "s"}.`
      : `${intersections} mapped constraint intersection${intersections === 1 ? " was" : "s were"} recorded across ${measuredConstraints.length} available layer${measuredConstraints.length === 1 ? "" : "s"}.`,
    unavailableConstraints === 0
      ? "All configured mapped constraint layers were available for this ranking."
      : `${unavailableConstraints} configured mapped constraint layer${unavailableConstraints === 1 ? " remains" : "s remain"} unknown.`,
    nearestService === null
      ? "No mapped-service distance was available; missing service evidence remains unknown, not absent."
      : `Nearest mapped service is approximately ${nearestService.toFixed(1)} m from the indicative construction envelope.`,
    unavailableServices === 0
      ? "All configured mapped-service layers returned a measured or verified-empty result."
      : `${unavailableServices} configured mapped-service layer${unavailableServices === 1 ? " remains" : "s remain"} unknown.`,
  ];
}

function compareCandidates(left: CompactCandidate, right: CompactCandidate) {
  const leftIntersections = left.constraintIntersections.filter(
    (measurement) => measurement.intersects,
  ).length;
  const rightIntersections = right.constraintIntersections.filter(
    (measurement) => measurement.intersects,
  ).length;
  const leftUnknown = unknownEvidenceCount(left);
  const rightUnknown = unknownEvidenceCount(right);
  const leftDistance = nearestMappedServiceDistance(left) ?? -1;
  const rightDistance = nearestMappedServiceDistance(right) ?? -1;
  return (
    leftIntersections - rightIntersections ||
    leftUnknown - rightUnknown ||
    rightDistance - leftDistance ||
    left.centre[1] - right.centre[1] ||
    left.centre[0] - right.centre[0] ||
    left.rotationDegrees - right.rotationDegrees
  );
}

function unknownEvidenceCount(candidate: CompactCandidate) {
  return (
    candidate.constraintIntersections.filter(
      (measurement) => measurement.status === "unavailable",
    ).length +
    candidate.mappedServiceDistances.filter(
      (measurement) => measurement.status === "unknown",
    ).length
  );
}

function nearestMappedServiceDistance(candidate: CompactCandidate) {
  const distances = candidate.mappedServiceDistances.flatMap((measurement) =>
    measurement.distanceMetres === null ? [] : [measurement.distanceMetres],
  );
  return distances.length === 0 ? null : Math.min(...distances);
}

function distanceFromEnvelope(
  envelope: Feature<Polygon>,
  mappedFeature: Feature<Geometry>,
): number {
  if (booleanIntersects(envelope, mappedFeature)) return 0;
  const boundary = polygonToLine(envelope) as Feature<LineString>;
  const envelopePoints = coordAll(envelope).map((coordinate) =>
    point(coordinate),
  );
  const distances = distancesToGeometry(
    mappedFeature.geometry,
    boundary,
    envelopePoints,
  );
  return distances.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...distances);
}

function distancesToGeometry(
  geometry: Geometry,
  boundary: Feature<LineString>,
  envelopePoints: ReturnType<typeof point>[],
): number[] {
  switch (geometry.type) {
    case "Point":
      return [
        pointToLineDistance(point(geometry.coordinates), boundary, {
          units: "meters",
        }),
      ];
    case "MultiPoint":
      return geometry.coordinates.map((coordinate) =>
        pointToLineDistance(point(coordinate), boundary, { units: "meters" }),
      );
    case "LineString":
      return distancesToLine(geometry.coordinates, boundary, envelopePoints);
    case "MultiLineString":
      return geometry.coordinates.flatMap((coordinates) =>
        distancesToLine(coordinates, boundary, envelopePoints),
      );
    case "Polygon":
      return geometry.coordinates.flatMap((coordinates) =>
        distancesToLine(coordinates, boundary, envelopePoints),
      );
    case "MultiPolygon":
      return geometry.coordinates.flatMap((polygonCoordinates) =>
        polygonCoordinates.flatMap((coordinates) =>
          distancesToLine(coordinates, boundary, envelopePoints),
        ),
      );
    case "GeometryCollection":
      return geometry.geometries.flatMap((child) =>
        distancesToGeometry(child, boundary, envelopePoints),
      );
  }
}

function distancesToLine(
  coordinates: Position[],
  boundary: Feature<LineString>,
  envelopePoints: ReturnType<typeof point>[],
) {
  const line = lineString(coordinates);
  return [
    ...envelopePoints.map((envelopePoint) =>
      pointToLineDistance(envelopePoint, line, { units: "meters" }),
    ),
    ...coordinates.map((coordinate) =>
      pointToLineDistance(point(coordinate), boundary, { units: "meters" }),
    ),
  ];
}

function boundedPlacementGrid(
  widthMetres: number,
  heightMetres: number,
  rotationCount: number,
  config: PoolScenarioConfig,
) {
  let spacing = Math.max(
    config.placementGridMetres,
    Math.sqrt(
      (widthMetres * heightMetres * rotationCount) /
        config.maximumTestedPlacements,
    ),
  );
  while (true) {
    const xPositions = centredAxisPositions(widthMetres / 2, spacing);
    const yPositions = centredAxisPositions(heightMetres / 2, spacing);
    if (
      xPositions.length * yPositions.length * rotationCount <=
      config.maximumTestedPlacements
    ) {
      return { xPositions, yPositions };
    }
    spacing *= 1.05;
  }
}

function centredAxisPositions(halfExtent: number, spacing: number) {
  const positions = [0];
  for (let offset = spacing; offset <= halfExtent; offset += spacing) {
    positions.push(offset, -offset);
  }
  return positions.sort((left, right) => left - right);
}

function roundTo(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}
