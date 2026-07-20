import type {
  DatasetEvidence,
  ParcelMatch,
} from "@/modules/data-access-spike/data-access-gateway";
import {
  datasetKeys,
  queryableDatasetKeys,
  type DatasetKey,
} from "@/modules/data-access-spike/dataset-catalog";
import type { PoolScenarioComparison } from "@/modules/spatial/analyze-pool-scenarios";
import { feasibilityScoringRules } from "@/config/feasibility-scoring";
import {
  assessFeasibility,
  type FeasibilityAssessment,
  type ScreeningSignal,
} from "./assess-feasibility";

export interface NormalizedTerrainEvidence {
  status: "measured" | "unknown";
  maximumSlopeDegrees: number | null;
}

export function assessDataAccessFeasibility(input: {
  scenarioComparison: PoolScenarioComparison;
  exactAddressMatched: boolean;
  parcelMatchStatus:
    "mapped_primary_parcel" | "containing_parcel_requires_confirmation";
  parcel: ParcelMatch;
  datasets: Record<DatasetKey, DatasetEvidence>;
  terrainEvidence: NormalizedTerrainEvidence;
  assessedAt: string;
}): FeasibilityAssessment {
  return assessFeasibility({
    scenarioComparison: input.scenarioComparison,
    address: { status: "confirmed", exactMatch: input.exactAddressMatched },
    parcel: {
      status:
        input.parcelMatchStatus === "mapped_primary_parcel"
          ? "confirmed"
          : "unconfirmed",
      titleEvidence:
        input.parcel.titles.length > 0 ? "available" : "unavailable",
      easementEvidence: "unavailable",
    },
    providers: datasetKeys.map((id) => {
      const evidence = input.datasets[id];
      return {
        id,
        required:
          feasibilityScoringRules.evidenceRequirements.confidenceProviders.includes(
            id as (typeof feasibilityScoringRules.evidenceRequirements.confidenceProviders)[number],
          ),
        status: providerStatus(id, evidence),
        retrievedAt: evidence.retrievedAt,
        datasetDate: evidence.datasetDate,
        confidence: evidence.confidence,
      };
    }),
    screening: {
      infrastructure: infrastructureSignal(input),
      flood: constraintSignal(
        input,
        feasibilityScoringRules.evidenceRequirements.flood,
        "all",
        feasibilityScoringRules.constraintGroups.flood.id,
      ),
      flowPath: constraintSignal(
        input,
        feasibilityScoringRules.evidenceRequirements.flowPath,
        "any",
      ),
      terrain: terrainSignal(input.terrainEvidence),
      restrictedOverlay: constraintSignal(
        input,
        feasibilityScoringRules.evidenceRequirements.restrictedOverlay,
        "any",
      ),
      constructionAccess: "unknown",
    },
    assessedAt: input.assessedAt,
  });
}

function providerStatus(
  id: DatasetKey,
  evidence: DatasetEvidence,
): "available" | "unavailable" {
  if (
    queryableDatasetKeys.includes(id as (typeof queryableDatasetKeys)[number])
  ) {
    return evidence.status === "success" && evidence.geometry
      ? "available"
      : "unavailable";
  }
  return evidence.status === "success" || evidence.status === "available"
    ? "available"
    : "unavailable";
}

function infrastructureSignal(input: {
  scenarioComparison: PoolScenarioComparison;
  datasets: Record<DatasetKey, DatasetEvidence>;
}): ScreeningSignal {
  if (
    feasibilityScoringRules.evidenceRequirements.infrastructure.some(
      (key) => input.datasets[key].status !== "success",
    )
  ) {
    return "unknown";
  }
  const candidates = input.scenarioComparison.scenarios.flatMap(
    (scenario) => scenario.candidates,
  );
  if (candidates.length === 0) return "unknown";
  return candidates.every((candidate) =>
    candidate.mappedServiceDistances.some(
      (measurement) => measurement.distanceMetres === 0,
    ),
  )
    ? "triggered"
    : "clear";
}

function constraintSignal(
  input: {
    scenarioComparison: PoolScenarioComparison;
    datasets: Record<DatasetKey, DatasetEvidence>;
  },
  keys: readonly DatasetKey[],
  triggerMode: "any" | "all",
  groupId?: string,
): ScreeningSignal {
  if (
    keys.some(
      (key) =>
        input.datasets[key].status !== "success" ||
        !input.datasets[key].geometry,
    )
  ) {
    return "unknown";
  }
  if (triggerMode === "all") {
    if (!groupId) return "unknown";
    const groupSummaries = input.scenarioComparison.scenarios.map((scenario) =>
      scenario.constraintGroupScreening.find(
        (summary) => summary.groupId === groupId,
      ),
    );
    if (
      groupSummaries.some(
        (summary) => !summary || summary.status === "unavailable",
      )
    ) {
      return "unknown";
    }
    const testedGroupSummaries = groupSummaries.filter(
      (summary): summary is NonNullable<typeof summary> =>
        Boolean(summary && summary.apparentPlacementCount > 0),
    );
    if (testedGroupSummaries.length === 0) return "unknown";
    return testedGroupSummaries.every(
      (summary) =>
        summary.minimumAffectedEnvelopePercent !== null &&
        summary.minimumAffectedEnvelopePercent >=
          feasibilityScoringRules.categoryRules.substantialFloodOverlapPercent,
    )
      ? "triggered"
      : "clear";
  }
  const scenarioSummaries = input.scenarioComparison.scenarios.map((scenario) =>
    scenario.constraintScreening.filter((summary) =>
      keys.includes(summary.evidenceId as DatasetKey),
    ),
  );
  if (
    scenarioSummaries.some(
      (summaries) =>
        summaries.length !== keys.length ||
        summaries.some((summary) => summary.status === "unavailable"),
    )
  ) {
    return "unknown";
  }
  const testedScenarioSummaries = scenarioSummaries.filter((summaries) =>
    summaries.some((summary) => summary.apparentPlacementCount > 0),
  );
  if (testedScenarioSummaries.length === 0) return "unknown";
  const triggered = testedScenarioSummaries.some((summaries) =>
    summaries.some(
      (summary) =>
        summary.apparentPlacementCount > 0 &&
        (summary.intersectingPlacementCount ?? 0) > 0,
    ),
  );
  return triggered ? "triggered" : "clear";
}

function terrainSignal(evidence: NormalizedTerrainEvidence): ScreeningSignal {
  if (evidence.status !== "measured" || evidence.maximumSlopeDegrees === null) {
    return "unknown";
  }
  return evidence.maximumSlopeDegrees >=
    feasibilityScoringRules.categoryRules.severeSlopeDegrees
    ? "triggered"
    : "clear";
}
