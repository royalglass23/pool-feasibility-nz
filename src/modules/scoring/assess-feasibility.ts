import {
  classifyFeasibilityScore,
  feasibilityScoringRules,
  type FeasibilityBand,
  type FeasibilityCategoryId,
} from "@/config/feasibility-scoring";
import type { PoolScenarioComparison } from "@/modules/spatial/analyze-pool-scenarios";

export type EvidenceStatus = "available" | "unavailable";
export type ScreeningSignal = "clear" | "triggered" | "unknown";
export type ConstructionAccessSignal =
  "clear" | "constrained" | "blocked" | "unknown";

export interface FeasibilityProviderEvidence {
  id: string;
  required: boolean;
  status: EvidenceStatus;
  retrievedAt: string;
  datasetDate: string | null;
  confidence: "high" | "limited" | "unavailable";
}

export interface FeasibilityAssessmentInput {
  scenarioComparison: PoolScenarioComparison;
  address: {
    status: "confirmed" | "ambiguous" | "unavailable";
    exactMatch: boolean;
  };
  parcel: {
    status: "confirmed" | "unconfirmed" | "unavailable";
    titleEvidence: EvidenceStatus;
    easementEvidence: EvidenceStatus;
  };
  providers: FeasibilityProviderEvidence[];
  screening: {
    infrastructure: ScreeningSignal;
    flood: ScreeningSignal;
    flowPath: ScreeningSignal;
    terrain: ScreeningSignal;
    restrictedOverlay: ScreeningSignal;
    constructionAccess: ConstructionAccessSignal;
  };
  assessedAt: string;
}

export interface FeasibilityCategoryContribution {
  id: FeasibilityCategoryId;
  maximumPoints: number;
  awardedPoints: number | null;
  status: "scored" | "unknown";
  appliedRuleIds: string[];
  evidenceReferences: string[];
  unknownInputs: string[];
  rationale: string;
}

export interface FeasibilityAssessment {
  analysisVersion: string;
  score: number | null;
  band: FeasibilityBand | null;
  qualification:
    | "normal"
    | "specialist_review_required"
    | "insufficient_core_data"
    | "indeterminate";
  categories: FeasibilityCategoryContribution[];
  confidence: {
    score: number;
    level: "high" | "medium" | "low";
    factors: ConfidenceFactor[];
  };
  finalRecommendation: string;
  criticalFlags: Array<{
    id: string;
    effect: "qualify" | "override";
    rationale: string;
  }>;
}

export interface ConfidenceFactor {
  id:
    | "address"
    | "parcel"
    | "provider_availability"
    | "provider_age"
    | "infrastructure"
    | "buildings"
    | "terrain"
    | "title"
    | "easements";
  maximumPoints: number;
  awardedPoints: number;
  status: "available" | "limited" | "unavailable";
}

export function assessFeasibility(
  input: FeasibilityAssessmentInput,
): FeasibilityAssessment {
  const categories = [
    scoreAvailableSpace(input),
    scoreUndergroundServices(input),
    scoreSignalCategory(
      "flooding_and_drainage",
      [input.screening.flood, input.screening.flowPath],
      ["screening:flood", "screening:flow_path"],
    ),
    scoreSignalCategory(
      "terrain_and_slope",
      [input.screening.terrain],
      ["screening:terrain"],
    ),
    scoreSignalCategory(
      "planning_constraints",
      [input.screening.restrictedOverlay],
      ["screening:restricted_overlay"],
    ),
    scoreConstructionAccess(input.screening.constructionAccess),
  ];
  const scoredCategories = categories.filter(
    (category) => category.awardedPoints !== null,
  );
  const knownMaximum = scoredCategories.reduce(
    (total, category) => total + category.maximumPoints,
    0,
  );
  const knownAwarded = scoredCategories.reduce(
    (total, category) => total + (category.awardedPoints ?? 0),
    0,
  );
  const score =
    knownMaximum === 0 ? null : Math.round((knownAwarded / knownMaximum) * 100);
  const band = score === null ? null : classifyFeasibilityScore(score);
  const confidenceFactors = scoreConfidence(input);
  const confidenceScore = confidenceFactors.reduce(
    (total, factor) => total + factor.awardedPoints,
    0,
  );
  const criticalFlags = identifyCriticalFlags(input);
  const qualification = criticalFlags.some((flag) => flag.effect === "override")
    ? "insufficient_core_data"
    : criticalFlags.length > 0
      ? "specialist_review_required"
      : score === null
        ? "indeterminate"
        : "normal";
  const finalRecommendation =
    qualification === "insufficient_core_data"
      ? feasibilityScoringRules.finalRecommendations.insufficientCoreData
      : qualification === "specialist_review_required"
        ? feasibilityScoringRules.finalRecommendations.specialistReview
        : qualification === "indeterminate"
          ? feasibilityScoringRules.finalRecommendations.indeterminate
          : feasibilityScoringRules.finalRecommendations.normalByBand[band!];

  return {
    analysisVersion: feasibilityScoringRules.version,
    score,
    band,
    qualification,
    categories,
    confidence: {
      score: confidenceScore,
      level:
        confidenceScore >= feasibilityScoringRules.confidence.levels.high
          ? "high"
          : confidenceScore >= feasibilityScoringRules.confidence.levels.medium
            ? "medium"
            : "low",
      factors: confidenceFactors,
    },
    finalRecommendation,
    criticalFlags,
  };
}

function identifyCriticalFlags(
  input: FeasibilityAssessmentInput,
): FeasibilityAssessment["criticalFlags"] {
  const unavailableCoreProviderIds =
    feasibilityScoringRules.evidenceRequirements.core.filter(
      (id) =>
        input.providers.find((provider) => provider.id === id)?.status !==
        "available",
    );
  const rules = feasibilityScoringRules.criticalFlags;
  return [
    ...(input.parcel.status === "confirmed"
      ? []
      : [criticalFlag(rules.parcel)]),
    ...(input.screening.infrastructure === "triggered"
      ? [criticalFlag(rules.infrastructure)]
      : []),
    ...(input.screening.flood === "triggered"
      ? [criticalFlag(rules.flood)]
      : []),
    ...(input.screening.flowPath === "triggered"
      ? [criticalFlag(rules.flowPath)]
      : []),
    ...(input.screening.terrain === "triggered"
      ? [criticalFlag(rules.terrain)]
      : []),
    ...(unavailableCoreProviderIds.length > 0
      ? [
          criticalFlag({
            ...rules.coreData,
            rationale: `${rules.coreData.rationale}: ${unavailableCoreProviderIds.join(", ")}.`,
          }),
        ]
      : []),
    ...(input.screening.restrictedOverlay === "triggered"
      ? [criticalFlag(rules.restrictedOverlay)]
      : []),
  ];
}

function criticalFlag(rule: {
  id: string;
  effect: "qualify" | "override";
  rationale: string;
}) {
  return { ...rule };
}

function scoreAvailableSpace(
  input: FeasibilityAssessmentInput,
): FeasibilityCategoryContribution {
  const maximumPoints = categoryMaximum("available_space");
  const largest = input.scenarioComparison.successfulShells.reduce<
    (typeof input.scenarioComparison.successfulShells)[number] | null
  >(
    (current, shell) =>
      !current ||
      shell.lengthMetres * shell.widthMetres >
        current.lengthMetres * current.widthMetres
        ? shell
        : current,
    null,
  );
  if (!largest) {
    const unknown = input.scenarioComparison.scenarios.some(
      (scenario) => scenario.status === "insufficient_data",
    );
    return unknown
      ? unknownCategory(
          "available_space",
          "No verified scenario result is available for the space score.",
          ["scenario_comparison"],
        )
      : scoredCategory(
          "available_space",
          0,
          "space.no_clear_candidate",
          ["scenario_comparison"],
          "No clear candidate area was identified using the tested screening scenarios.",
        );
  }
  return scoredCategory(
    "available_space",
    Math.min(
      maximumPoints,
      feasibilityScoringRules.categoryRules.availableSpaceByScenario[
        largest.scenarioId
      ],
    ),
    "space.largest_successful_shell",
    [`scenario:${largest.scenarioId}`, `candidate:${largest.candidateId}`],
    `${largest.label} is the largest successfully placed pool shell.`,
  );
}

function scoreUndergroundServices(
  input: FeasibilityAssessmentInput,
): FeasibilityCategoryContribution {
  if (input.screening.infrastructure === "unknown") {
    return unknownCategory(
      "underground_services",
      "Mapped infrastructure evidence is unavailable or incomplete.",
      ["screening:infrastructure"],
    );
  }
  const measurements = input.scenarioComparison.scenarios.flatMap((scenario) =>
    scenario.candidates.flatMap((candidate) =>
      candidate.mappedServiceDistances.map((measurement) => ({
        candidateId: candidate.id,
        measurement,
      })),
    ),
  );
  if (
    measurements.length === 0 ||
    measurements.some(({ measurement }) => measurement.status === "unknown")
  ) {
    return unknownCategory(
      "underground_services",
      "No complete mapped-service measurement is available.",
      ["mapped_service_distances"],
    );
  }
  const distances = measurements.flatMap(({ measurement }) =>
    measurement.distanceMetres === null ? [] : [measurement.distanceMetres],
  );
  const nearest = distances.length === 0 ? null : Math.min(...distances);
  const awardedPoints =
    input.screening.infrastructure === "triggered" || nearest === 0
      ? feasibilityScoringRules.categoryRules.intersectingServicePoints
      : nearest === null
        ? categoryMaximum("underground_services")
        : feasibilityScoringRules.categoryRules.serviceDistanceBands.find(
            (band) => nearest >= band.minimumMetres,
          )!.points;
  return scoredCategory(
    "underground_services",
    awardedPoints,
    "services.nearest_mapped_distance",
    measurements.map(
      ({ candidateId, measurement }) =>
        `candidate:${candidateId}:${measurement.evidence.id}`,
    ),
    nearest === null
      ? "Available mapped-service layers returned verified empty results."
      : `The nearest mapped service is ${nearest.toFixed(1)} metres from a screened envelope.`,
  );
}

function scoreSignalCategory(
  id: Extract<
    FeasibilityCategoryId,
    "flooding_and_drainage" | "terrain_and_slope" | "planning_constraints"
  >,
  signals: ScreeningSignal[],
  evidenceReferences: string[],
): FeasibilityCategoryContribution {
  if (signals.includes("unknown")) {
    return unknownCategory(
      id,
      "Required mapped screening evidence remains unknown.",
      evidenceReferences,
    );
  }
  const triggered = signals.includes("triggered");
  return scoredCategory(
    id,
    triggered
      ? feasibilityScoringRules.categoryRules.triggeredConstraintPoints
      : categoryMaximum(id),
    `${id}.${triggered ? "constraint_triggered" : "screening_clear"}`,
    evidenceReferences,
    triggered
      ? "A deterministic mapped screening constraint was triggered."
      : "Available mapped screening evidence did not trigger this constraint.",
  );
}

function scoreConstructionAccess(
  signal: ConstructionAccessSignal,
): FeasibilityCategoryContribution {
  if (signal === "unknown") {
    return unknownCategory(
      "construction_access",
      "Desktop construction-access evidence is unavailable.",
      ["screening:construction_access"],
    );
  }
  const awardedPoints =
    feasibilityScoringRules.categoryRules.constructionAccessPoints[signal];
  return scoredCategory(
    "construction_access",
    awardedPoints,
    `construction_access.${signal}`,
    ["screening:construction_access"],
    `Desktop construction-access screening is ${signal}.`,
  );
}

function scoreConfidence(
  input: FeasibilityAssessmentInput,
): ConfidenceFactor[] {
  const confidenceRules = feasibilityScoringRules.confidence;
  const requiredProviders = input.providers.filter(
    (provider) => provider.required,
  );
  const availableRequiredProviders = requiredProviders.filter(
    (provider) => provider.status === "available",
  );
  const providerAvailability = requiredProviders.length
    ? (availableRequiredProviders.length / requiredProviders.length) *
      confidenceRules.maximumPoints.providerAvailability
    : 0;
  const assessedAt = Date.parse(input.assessedAt);
  const currentProviders = availableRequiredProviders.filter((provider) => {
    const datasetDate = provider.datasetDate
      ? Date.parse(provider.datasetDate)
      : Number.NaN;
    return (
      Number.isFinite(datasetDate) &&
      assessedAt - datasetDate <=
        confidenceRules.currentDatasetMaximumAgeDays * 24 * 60 * 60 * 1000
    );
  });
  const providerAge = availableRequiredProviders.length
    ? (currentProviders.length / availableRequiredProviders.length) *
      confidenceRules.maximumPoints.providerAge
    : 0;
  const buildings = input.providers.some(
    (provider) =>
      provider.id === "building_footprints" && provider.status === "available",
  )
    ? confidenceRules.maximumPoints.buildings
    : 0;
  return [
    confidenceFactor(
      "address",
      confidenceRules.maximumPoints.address,
      input.address.status === "confirmed"
        ? input.address.exactMatch
          ? confidenceRules.maximumPoints.address
          : confidenceRules.partialAddressPoints
        : 0,
    ),
    confidenceFactor(
      "parcel",
      confidenceRules.maximumPoints.parcel,
      input.parcel.status === "confirmed"
        ? confidenceRules.maximumPoints.parcel
        : 0,
    ),
    confidenceFactor(
      "provider_availability",
      confidenceRules.maximumPoints.providerAvailability,
      providerAvailability,
    ),
    confidenceFactor(
      "provider_age",
      confidenceRules.maximumPoints.providerAge,
      providerAge,
    ),
    confidenceFactor(
      "infrastructure",
      confidenceRules.maximumPoints.infrastructure,
      input.screening.infrastructure === "unknown"
        ? 0
        : confidenceRules.maximumPoints.infrastructure,
    ),
    confidenceFactor(
      "buildings",
      confidenceRules.maximumPoints.buildings,
      buildings,
    ),
    confidenceFactor(
      "terrain",
      confidenceRules.maximumPoints.terrain,
      input.screening.terrain === "unknown"
        ? 0
        : confidenceRules.maximumPoints.terrain,
    ),
    confidenceFactor(
      "title",
      confidenceRules.maximumPoints.title,
      input.parcel.titleEvidence === "available"
        ? confidenceRules.maximumPoints.title
        : 0,
    ),
    confidenceFactor(
      "easements",
      confidenceRules.maximumPoints.easements,
      input.parcel.easementEvidence === "available"
        ? confidenceRules.maximumPoints.easements
        : 0,
    ),
  ];
}

function confidenceFactor(
  id: ConfidenceFactor["id"],
  maximumPoints: number,
  awardedPoints: number,
): ConfidenceFactor {
  const boundedPoints = Math.max(
    0,
    Math.min(maximumPoints, Math.round(awardedPoints)),
  );
  return {
    id,
    maximumPoints,
    awardedPoints: boundedPoints,
    status:
      boundedPoints === maximumPoints
        ? "available"
        : boundedPoints === 0
          ? "unavailable"
          : "limited",
  };
}

function categoryMaximum(id: FeasibilityCategoryId): number {
  return feasibilityScoringRules.categories.find(
    (category) => category.id === id,
  )!.maximumPoints;
}

function scoredCategory(
  id: FeasibilityCategoryId,
  awardedPoints: number,
  ruleId: string,
  evidenceReferences: string[],
  rationale: string,
): FeasibilityCategoryContribution {
  const maximumPoints = categoryMaximum(id);
  return {
    id,
    maximumPoints,
    awardedPoints: Math.max(0, Math.min(maximumPoints, awardedPoints)),
    status: "scored",
    appliedRuleIds: [ruleId],
    evidenceReferences,
    unknownInputs: [],
    rationale,
  };
}

function unknownCategory(
  id: FeasibilityCategoryId,
  rationale: string,
  unknownInputs: string[],
): FeasibilityCategoryContribution {
  return {
    id,
    maximumPoints: categoryMaximum(id),
    awardedPoints:
      feasibilityScoringRules.missingEvidence.categoryAwardedPoints,
    status: "unknown",
    appliedRuleIds: [`${id}.unknown`],
    evidenceReferences: unknownInputs,
    unknownInputs,
    rationale,
  };
}
