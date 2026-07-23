import { bbox, coordAll, destination, distance, point } from "@turf/turf";
import type { Feature, Polygon, Position } from "geojson";
import type { AerialConflictFinding } from "@/modules/spatial/assess-aerial-imagery-conflicts";
import {
  assessCustomPoolPlacement,
  type CustomPoolPlacementConflict,
  type CustomPoolPlacementEvidence,
  type CustomPoolPlacementUnknownEvidence,
} from "./assess-custom-pool-placement";
import type { SpatialEvidenceProvenance } from "./analyze-pool-candidates";

const DEFAULT_GRID_METRES = 0.5;
const MAX_TESTED_PLACEMENTS = 4_000;

export type AssistedPlacementEvidence = CustomPoolPlacementEvidence & {
  provenance: SpatialEvidenceProvenance;
};

export type AssistedPlacementRole =
  "best_overall" | "access_constructability" | "smaller_or_rotated_fallback";

export interface AssistedPlacementCandidate {
  id: string;
  rank: number;
  role: AssistedPlacementRole;
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
  imageryFindings: AerialConflictFinding[];
  placementEvidence: {
    parcel: AssistedPlacementEvidence;
    buildings: AssistedPlacementEvidence;
    constraints: AssistedPlacementEvidence[];
    mappedServices: AssistedPlacementEvidence[];
  };
  nearestMappedServiceDistanceMetres: number | null;
  rankingEvidence: string[];
  explanation: string;
}

export type AssistedPlacementSearchStatus =
  | "candidates_found"
  | "no_clear_candidate"
  | "inspection_required"
  | "provider_failure"
  | "invalid_request";

export interface AssistedPlacementSearchResult {
  status: AssistedPlacementSearchStatus;
  message: string;
  testedPlacementCount: number;
  testedRotationsDegrees: number[];
  candidates: AssistedPlacementCandidate[];
}

export function rankAssistedPoolPlacements(
  result: AssistedPlacementSearchResult,
  imageryFindingsByCandidateId: ReadonlyMap<
    string,
    readonly AerialConflictFinding[]
  >,
): AssistedPlacementSearchResult {
  if (result.candidates.length === 0) return result;

  const origin = result.candidates.reduce(
    (centre, candidate) => [
      centre[0] + candidate.position[0] / result.candidates.length,
      centre[1] + candidate.position[1] / result.candidates.length,
    ],
    [0, 0] as Position,
  );
  const updated = result.candidates.map((candidate) => {
    const imageryFindings = [
      ...(imageryFindingsByCandidateId.get(candidate.id) ??
        candidate.imageryFindings),
    ];
    return {
      ...candidate,
      imageryFindings,
      rankingEvidence: rankingEvidence({
        origin,
        candidate,
        imageryFindings,
        mappedServices: candidate.placementEvidence.mappedServices,
        nearestMappedServiceDistanceMetres:
          candidate.nearestMappedServiceDistanceMetres,
      }),
    };
  });
  const ranked = updated
    .sort((left, right) => compareCandidates(left, right, origin))
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      role: roleForRank(index),
      explanation: explanationForRank(index, candidate),
    }));

  return {
    ...result,
    status: ranked.some((candidate) =>
      candidate.imageryFindings.some(
        (finding) => finding.evidenceStatus === "unavailable",
      ),
    )
      ? "provider_failure"
      : result.status,
    message: ranked.some((candidate) =>
      candidate.imageryFindings.some(
        (finding) => finding.evidenceStatus === "unavailable",
      ),
    )
      ? "Clear GIS candidates were found, but the advisory imagery provider failed; onsite inspection is required."
      : ranked.some((candidate) => candidate.imageryFindings.length > 0)
        ? "Up to three clear GIS candidates were ranked with advisory aerial findings; onsite inspection remains required for uncertain imagery evidence."
        : result.message,
    candidates: ranked,
  };
}

export function findAssistedPoolPlacements(input: {
  parcel: Polygon;
  parcelStatus: "confirmed" | "unconfirmed";
  parcelEvidence: AssistedPlacementEvidence;
  buildings: AssistedPlacementEvidence;
  constraints: AssistedPlacementEvidence[];
  mappedServices: AssistedPlacementEvidence[];
  dimensions: { lengthMetres: number; widthMetres: number };
  rotationsDegrees: readonly number[];
  gridSpacingMetres?: number;
  imageryAssessment?: (candidate: {
    shell: Feature<Polygon>;
    dimensions: { lengthMetres: number; widthMetres: number };
    rotationDegrees: number;
  }) => readonly AerialConflictFinding[];
}): AssistedPlacementSearchResult {
  const rotations = [...new Set(input.rotationsDegrees)].map(normalizeRotation);
  if (
    rotations.length === 0 ||
    !Number.isFinite(input.gridSpacingMetres ?? DEFAULT_GRID_METRES) ||
    (input.gridSpacingMetres ?? DEFAULT_GRID_METRES) <= 0
  ) {
    return invalidRequest(
      "At least one valid orientation and grid spacing are required.",
    );
  }

  if (input.parcelStatus !== "confirmed") {
    return inspectionRequired(
      "The legal parcel is not confirmed, so assisted placement cannot establish a safe boundary.",
      ["legal_parcel"],
      rotations,
    );
  }

  if (input.buildings.status !== "available" || !input.buildings.geometry) {
    return inspectionRequired(
      "Building footprint evidence is unavailable, so every apparent position requires inspection.",
      [input.buildings.id],
      rotations,
    );
  }

  const [west, south, east, north] = bbox(input.parcel);
  const origin: Position = [(west + east) / 2, (south + north) / 2];
  const parcelWidthMetres = distance(
    point([west, origin[1]]),
    point([east, origin[1]]),
    { units: "meters" },
  );
  const parcelHeightMetres = distance(
    point([origin[0], south]),
    point([origin[0], north]),
    { units: "meters" },
  );
  const length = input.dimensions.lengthMetres;
  const width = input.dimensions.widthMetres;
  if (
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    length <= 0 ||
    width <= 0
  ) {
    return invalidRequest(
      "Length and width must be positive finite dimensions.",
    );
  }

  const spacing = input.gridSpacingMetres ?? DEFAULT_GRID_METRES;
  const xPositions = boundedOffsets(parcelWidthMetres, length + 2, spacing);
  const yPositions = boundedOffsets(parcelHeightMetres, width + 2, spacing);
  const candidates: AssistedPlacementCandidate[] = [];
  let testedPlacementCount = 0;
  let imageryProviderFailure = false;

  outer: for (const x of xPositions) {
    for (const y of yPositions) {
      for (const rotationDegrees of rotations) {
        if (testedPlacementCount >= MAX_TESTED_PLACEMENTS) break outer;
        testedPlacementCount += 1;
        const position = positionFromOffset(origin, x, y);
        let assessment;
        try {
          assessment = assessCustomPoolPlacement({
            parcel: input.parcel,
            parcelStatus: "confirmed",
            position,
            rotationDegrees,
            lengthMetres: length,
            widthMetres: width,
            parcelEvidence: input.parcelEvidence,
            buildings: input.buildings,
            constraints: input.constraints,
          });
        } catch {
          continue;
        }
        if (assessment.classification !== "clear") continue;

        let imageryFindings: AerialConflictFinding[] = [];
        try {
          imageryFindings = [
            ...(input.imageryAssessment?.({
              shell: assessment.shell,
              dimensions: assessment.dimensions,
              rotationDegrees: assessment.rotationDegrees,
            }) ?? []),
          ];
        } catch {
          imageryProviderFailure = true;
          imageryFindings = [
            unavailableImageryFinding(
              assessment.shell,
              "The advisory imagery provider failed; onsite inspection is required.",
            ),
          ];
        }
        candidates.push({
          id: `assisted-${candidates.length + 1}`,
          rank: 0,
          role: "best_overall",
          position: assessment.position,
          rotationDegrees: assessment.rotationDegrees,
          dimensions: assessment.dimensions,
          shell: assessment.shell,
          envelopes: assessment.envelopes,
          hardConflicts: assessment.hardConflicts,
          unknownEvidence: assessment.unknownEvidence,
          imageryFindings,
          placementEvidence: {
            parcel: input.parcelEvidence,
            buildings: input.buildings,
            constraints: input.constraints,
            mappedServices: input.mappedServices,
          },
          nearestMappedServiceDistanceMetres: nearestMappedServiceDistance(
            assessment.position,
            input.mappedServices,
          ),
          rankingEvidence: rankingEvidence({
            origin,
            candidate: assessment,
            imageryFindings,
            mappedServices: input.mappedServices,
            nearestMappedServiceDistanceMetres: nearestMappedServiceDistance(
              assessment.position,
              input.mappedServices,
            ),
          }),
          explanation:
            "This candidate passed the measured parcel, building, and constraint checks.",
        });
      }
    }
  }

  const sortedCandidates = candidates.sort((left, right) =>
    compareCandidates(left, right, origin),
  );
  const distinctRotationCandidates = rotations
    .flatMap((rotation) => {
      const candidate = sortedCandidates.find(
        (item) => item.rotationDegrees === rotation,
      );
      return candidate ? [candidate] : [];
    })
    .sort((left, right) => compareCandidates(left, right, origin));
  const ranked = [...distinctRotationCandidates, ...sortedCandidates]
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .slice(0, 3)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      role: roleForRank(index),
      explanation: explanationForRank(index, candidate),
    }));

  return ranked.length > 0
    ? {
        status: imageryProviderFailure
          ? "provider_failure"
          : "candidates_found",
        message: imageryProviderFailure
          ? "Clear GIS candidates were found, but advisory imagery review failed; onsite inspection is required."
          : "Up to three clear assisted placement candidates were found using measured GIS evidence.",
        testedPlacementCount,
        testedRotationsDegrees: rotations,
        candidates: ranked,
      }
    : {
        status: "no_clear_candidate",
        message:
          "No clear assisted placement candidate was found using the available measured GIS evidence.",
        testedPlacementCount,
        testedRotationsDegrees: rotations,
        candidates: [],
      };
}

function unavailableImageryFinding(
  shell: Feature<Polygon>,
  explanation: string,
): AerialConflictFinding {
  return {
    type: "image_resolution_uncertainty",
    affectedArea: shell,
    confidence: "low",
    explanation,
    evidenceStatus: "unavailable",
    inspectionRequirement: "required",
  };
}

function boundedOffsets(
  sizeMetres: number,
  requiredMetres: number,
  spacing: number,
) {
  const half = (sizeMetres - requiredMetres) / 2;
  if (half < 0) return [] as number[];
  const offsets: number[] = [];
  for (let value = -half; value <= half + spacing / 2; value += spacing) {
    offsets.push(Number(value.toFixed(4)));
  }
  return offsets;
}

function positionFromOffset(
  origin: Position,
  eastMetres: number,
  northMetres: number,
): [number, number] {
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
  ).geometry.coordinates as [number, number];
}

function normalizeRotation(value: number) {
  return ((value % 360) + 360) % 360;
}

function compareCandidates(
  left: AssistedPlacementCandidate,
  right: AssistedPlacementCandidate,
  origin: Position,
) {
  const leftImageryPenalty = imageryPenalty(left.imageryFindings);
  const rightImageryPenalty = imageryPenalty(right.imageryFindings);
  return (
    leftImageryPenalty - rightImageryPenalty ||
    (left.nearestMappedServiceDistanceMetres ?? Number.POSITIVE_INFINITY) -
      (right.nearestMappedServiceDistanceMetres ?? Number.POSITIVE_INFINITY) ||
    Number(left.rotationDegrees !== 0) - Number(right.rotationDegrees !== 0) ||
    distance(point([...left.position]), point(origin), { units: "meters" }) -
      distance(point([...right.position]), point(origin), {
        units: "meters",
      }) ||
    left.position[0] - right.position[0] ||
    left.position[1] - right.position[1]
  );
}

function imageryPenalty(findings: AerialConflictFinding[]) {
  return findings.reduce(
    (total, finding) =>
      total +
      (finding.evidenceStatus === "observed"
        ? finding.confidence === "high"
          ? 3
          : 2
        : 1),
    0,
  );
}

function rankingEvidence(input: {
  origin: Position;
  candidate: { position: readonly [number, number]; rotationDegrees: number };
  imageryFindings: AerialConflictFinding[];
  mappedServices: AssistedPlacementEvidence[];
  nearestMappedServiceDistanceMetres?: number | null;
}) {
  const evidence = [
    "Entire construction allowance is inside the confirmed parcel.",
    "Construction allowance does not intersect mapped buildings or measured hard constraints.",
    input.candidate.rotationDegrees === 0
      ? "Zero-degree orientation supports straightforward constructability comparison."
      : `Alternative ${input.candidate.rotationDegrees}° orientation retained as a fallback option.`,
    input.nearestMappedServiceDistanceMetres === null
      ? "No mapped service feature was available inside the access evidence; verify access onsite."
      : `${input.nearestMappedServiceDistanceMetres?.toFixed(1)} m to the nearest mapped service evidence feature.`,
  ];
  if (input.imageryFindings.length > 0) {
    evidence.push(
      "Advisory aerial findings affect ranking only and do not override measured GIS checks.",
    );
  }
  return evidence;
}

function nearestMappedServiceDistance(
  position: readonly [number, number],
  services: AssistedPlacementEvidence[],
): number | null {
  const distances = services.flatMap((service) => {
    if (service.status !== "available" || !service.geometry) return [];
    return coordAll(service.geometry).map((coordinate) =>
      distance(point([...position]), point(coordinate), { units: "meters" }),
    );
  });
  return distances.length > 0 ? Math.min(...distances) : null;
}

function roleForRank(rank: number): AssistedPlacementRole {
  return rank === 0
    ? "best_overall"
    : rank === 1
      ? "access_constructability"
      : "smaller_or_rotated_fallback";
}

function explanationForRank(
  rank: number,
  candidate: AssistedPlacementCandidate,
) {
  if (rank === 0)
    return "Best overall: strongest measured GIS fit with the lowest advisory imagery penalty.";
  if (rank === 1)
    return "Access/constructability option: a distinct measured GIS fit retained for practical comparison.";
  return `Fallback option: a distinct ${candidate.rotationDegrees}° placement retained when the first option is not practical.`;
}

function inspectionRequired(
  message: string,
  _missing: string[],
  rotations: number[],
): AssistedPlacementSearchResult {
  return {
    status: "inspection_required",
    message,
    testedPlacementCount: 0,
    testedRotationsDegrees: rotations,
    candidates: [],
  };
}

function invalidRequest(message: string): AssistedPlacementSearchResult {
  return {
    status: "invalid_request",
    message,
    testedPlacementCount: 0,
    testedRotationsDegrees: [],
    candidates: [],
  };
}
