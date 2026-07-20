import type {
  PoolScenarioConfig,
  PoolScenarioId,
  PreferredPoolLocation,
} from "@/config/pool-scenarios";
import {
  analyzePoolCandidates,
  type ConstraintScreeningGroup,
  type PoolCandidateAnalysis,
  type SpatialEvidenceInput,
} from "./analyze-pool-candidates";
import type { Polygon } from "geojson";

export type { SpatialEvidenceInput } from "./analyze-pool-candidates";

export interface PoolScenarioPreferences {
  preferredLocation: PreferredPoolLocation;
  preferredSize: PoolScenarioId | null;
}

export type PoolScenarioStatus =
  | "likely"
  | "possible_with_constraints"
  | "specialist_review_required"
  | "no_clear_candidate"
  | "insufficient_data";

export interface PoolScenarioAnalysis extends Omit<
  PoolCandidateAnalysis,
  "status"
> {
  status: PoolScenarioStatus;
}

export interface SuccessfulPoolShell {
  scenarioId: PoolScenarioId;
  label: string;
  lengthMetres: number;
  widthMetres: number;
  candidateId: string;
}

export interface PoolScenarioComparison {
  version: string;
  preferences: PoolScenarioPreferences;
  scenarios: PoolScenarioAnalysis[];
  rankedScenarioIds: PoolScenarioId[];
  successfulShells: SuccessfulPoolShell[];
  shellRange: {
    minimum: Omit<SuccessfulPoolShell, "label">;
    maximum: Omit<SuccessfulPoolShell, "label">;
  } | null;
}

export function analyzePoolScenarios(input: {
  parcel: Polygon;
  parcelStatus: "confirmed" | "unconfirmed";
  parcelEvidence: SpatialEvidenceInput;
  buildings: SpatialEvidenceInput;
  constraints: SpatialEvidenceInput[];
  constraintGroups?: readonly ConstraintScreeningGroup[];
  mappedServices: SpatialEvidenceInput[];
  catalogue: {
    version: string;
    scenarios: readonly PoolScenarioConfig[];
  };
  preferences: PoolScenarioPreferences;
}): PoolScenarioComparison {
  const scenarios = input.catalogue.scenarios.map((config) => {
    const analysis = analyzePoolCandidates({
      parcel: input.parcel,
      parcelStatus: input.parcelStatus,
      parcelEvidence: input.parcelEvidence,
      buildings: input.buildings,
      constraints: input.constraints,
      constraintGroups: input.constraintGroups,
      mappedServices: input.mappedServices,
      config,
      preferredLocation: input.preferences.preferredLocation,
    });
    return {
      ...analysis,
      status: comparisonStatus(analysis),
    } satisfies PoolScenarioAnalysis;
  });
  const successfulShells = scenarios.flatMap((analysis) => {
    const candidate = analysis.candidates[0];
    return candidate
      ? [
          {
            scenarioId: analysis.scenario.id,
            label: analysis.scenario.label,
            lengthMetres: analysis.scenario.shellLengthMetres,
            widthMetres: analysis.scenario.shellWidthMetres,
            candidateId: candidate.id,
          },
        ]
      : [];
  });
  const sortedShells = [...successfulShells].sort(
    (left, right) =>
      left.lengthMetres * left.widthMetres -
        right.lengthMetres * right.widthMetres ||
      left.lengthMetres - right.lengthMetres ||
      left.widthMetres - right.widthMetres,
  );

  return {
    version: input.catalogue.version,
    preferences: input.preferences,
    scenarios,
    rankedScenarioIds: rankScenarios(
      scenarios,
      input.catalogue.scenarios,
      input.preferences.preferredSize,
    ),
    successfulShells,
    shellRange:
      sortedShells.length === 0
        ? null
        : {
            minimum: rangeBoundary(sortedShells[0]),
            maximum: rangeBoundary(sortedShells[sortedShells.length - 1]),
          },
  };
}

function rankScenarios(
  scenarios: PoolScenarioAnalysis[],
  configs: readonly PoolScenarioConfig[],
  preferredSize: PoolScenarioId | null,
): PoolScenarioId[] {
  const statusOrder: Record<PoolScenarioStatus, number> = {
    likely: 0,
    possible_with_constraints: 1,
    specialist_review_required: 2,
    no_clear_candidate: 3,
    insufficient_data: 4,
  };
  const preferredIndex = configs.findIndex(
    (config) => config.id === preferredSize,
  );
  return scenarios
    .map((analysis, index) => ({ analysis, index }))
    .sort(
      (left, right) =>
        statusOrder[left.analysis.status] -
          statusOrder[right.analysis.status] ||
        (preferredIndex < 0
          ? 0
          : Math.abs(left.index - preferredIndex) -
            Math.abs(right.index - preferredIndex)) ||
        left.index - right.index,
    )
    .map(({ analysis }) => analysis.scenario.id);
}

function comparisonStatus(analysis: PoolCandidateAnalysis): PoolScenarioStatus {
  if (analysis.status === "insufficient_data") return "insufficient_data";
  if (analysis.status === "no_clear_candidate") return "no_clear_candidate";
  const hasUnknownConstraint = analysis.candidates.some((candidate) =>
    candidate.constraintIntersections.some(
      (measurement) => measurement.status === "unavailable",
    ),
  );
  const hasUnknownService = analysis.candidates.some((candidate) =>
    candidate.mappedServiceDistances.some(
      (measurement) => measurement.status === "unknown",
    ),
  );
  const mappedDistances = analysis.candidates.flatMap((candidate) =>
    candidate.mappedServiceDistances.flatMap((measurement) =>
      measurement.distanceMetres === null ? [] : [measurement.distanceMetres],
    ),
  );
  if (
    hasUnknownConstraint ||
    hasUnknownService ||
    mappedDistances.some((distanceMetres) => distanceMetres === 0)
  ) {
    return "specialist_review_required";
  }
  if (mappedDistances.length > 0) {
    return "possible_with_constraints";
  }
  return "likely";
}

function rangeBoundary(shell: SuccessfulPoolShell) {
  return {
    scenarioId: shell.scenarioId,
    lengthMetres: shell.lengthMetres,
    widthMetres: shell.widthMetres,
    candidateId: shell.candidateId,
  };
}
