export type FeasibilityCategoryId =
  | "available_space"
  | "underground_services"
  | "flooding_and_drainage"
  | "terrain_and_slope"
  | "planning_constraints"
  | "construction_access";

export type FeasibilityBand =
  | "strong_preliminary_candidate"
  | "likely_feasible_with_normal_investigations"
  | "potentially_feasible_but_constrained"
  | "significant_constraints"
  | "low_preliminary_feasibility";

const coreDatasetKeys = [
  "address_resolution",
  "legal_parcel",
  "building_footprints",
] as const;
const infrastructureDatasetKeys = [
  "public_stormwater_assets",
  "manholes",
  "catchpits",
  "wastewater_assets",
  "public_water_assets",
  "wastewater_manholes",
  "water_fittings",
  "wastewater_fittings",
] as const;
const floodDatasetKeys = [
  "flood_plains",
  "flood_prone_areas",
  "watercourses",
] as const;
const flowPathDatasetKeys = ["overland_flow_paths"] as const;
const terrainDatasetKeys = ["contours"] as const;
const restrictedOverlayDatasetKeys = ["planning_overlays"] as const;
const confidenceProviderKeys = [
  ...coreDatasetKeys,
  ...terrainDatasetKeys,
  ...restrictedOverlayDatasetKeys,
  ...floodDatasetKeys,
  ...flowPathDatasetKeys,
  ...infrastructureDatasetKeys,
] as const;
const constraintDatasetKeys = [
  ...restrictedOverlayDatasetKeys,
  ...floodDatasetKeys,
  ...flowPathDatasetKeys,
] as const;

export const feasibilityScoringRules = {
  version: "feasibility-scoring-v1",
  categories: [
    { id: "available_space", maximumPoints: 25 },
    { id: "underground_services", maximumPoints: 20 },
    { id: "flooding_and_drainage", maximumPoints: 20 },
    { id: "terrain_and_slope", maximumPoints: 15 },
    { id: "planning_constraints", maximumPoints: 10 },
    { id: "construction_access", maximumPoints: 10 },
  ],
  bands: [
    { minimumScore: 85, id: "strong_preliminary_candidate" },
    {
      minimumScore: 70,
      id: "likely_feasible_with_normal_investigations",
    },
    { minimumScore: 50, id: "potentially_feasible_but_constrained" },
    { minimumScore: 30, id: "significant_constraints" },
    { minimumScore: 0, id: "low_preliminary_feasibility" },
  ],
  categoryRules: {
    availableSpaceByScenario: {
      compact: 15,
      "compact-plus": 18,
      standard: 20,
      "standard-plus": 23,
      large: 25,
    },
    serviceDistanceBands: [
      { minimumMetres: 10, points: 20 },
      { minimumMetres: 5, points: 15 },
      { minimumMetres: 2, points: 10 },
      { minimumMetres: 0, points: 5 },
    ],
    intersectingServicePoints: 0,
    triggeredConstraintPoints: 0,
    severeSlopeDegrees: 20,
    substantialFloodOverlapPercent: 50,
    constructionAccessPoints: { clear: 10, constrained: 5, blocked: 0 },
  },
  confidence: {
    currentDatasetMaximumAgeDays: 365,
    levels: { high: 80, medium: 55, low: 0 },
    partialAddressPoints: 10,
    maximumPoints: {
      address: 15,
      parcel: 15,
      providerAvailability: 20,
      providerAge: 10,
      infrastructure: 10,
      buildings: 10,
      terrain: 10,
      title: 5,
      easements: 5,
    },
  },
  evidenceRequirements: {
    core: coreDatasetKeys,
    confidenceProviders: confidenceProviderKeys,
    infrastructure: infrastructureDatasetKeys,
    flood: floodDatasetKeys,
    flowPath: flowPathDatasetKeys,
    terrain: terrainDatasetKeys,
    restrictedOverlay: restrictedOverlayDatasetKeys,
    constraintLayers: constraintDatasetKeys,
  },
  constraintGroups: {
    flood: {
      id: "flood_hazards",
      evidenceIds: floodDatasetKeys,
    },
  },
  criticalFlags: {
    parcel: {
      id: "parcel_unconfirmed",
      effect: "override",
      rationale: "The legal parcel could not be confidently matched.",
    },
    infrastructure: {
      id: "major_mapped_infrastructure",
      effect: "qualify",
      rationale:
        "Major mapped infrastructure affects the apparent usable area.",
    },
    flood: {
      id: "all_candidates_flood_affected",
      effect: "qualify",
      rationale:
        "All apparent candidate areas are substantially affected by mapped flood hazards.",
    },
    flowPath: {
      id: "candidate_overland_flow_path",
      effect: "qualify",
      rationale:
        "An apparent candidate area crosses a mapped overland flow path.",
    },
    terrain: {
      id: "severe_mapped_terrain",
      effect: "qualify",
      rationale:
        "The mapped terrain signal reaches the severe screening threshold.",
    },
    coreData: {
      id: "required_core_data_unavailable",
      effect: "override",
      rationale: "Required core data is unavailable",
    },
    restrictedOverlay: {
      id: "known_restricted_overlay",
      effect: "qualify",
      rationale:
        "An apparent candidate area occupies a known restricted overlay.",
    },
  },
  finalRecommendations: {
    normalByBand: {
      strong_preliminary_candidate:
        "Strong preliminary candidate based on known mapped evidence.",
      likely_feasible_with_normal_investigations:
        "Likely feasible with normal onsite and specialist investigations.",
      potentially_feasible_but_constrained:
        "Potentially feasible, with mapped constraints requiring investigation.",
      significant_constraints:
        "Significant mapped constraints require specialist investigation.",
      low_preliminary_feasibility:
        "Low preliminary feasibility based on known mapped evidence.",
    },
    specialistReview:
      "Specialist review is required before relying on this preliminary result.",
    insufficientCoreData:
      "Insufficient core data is available for a preliminary recommendation.",
    indeterminate:
      "Physical feasibility is indeterminate until mapped evidence is available.",
  },
  missingEvidence: {
    categoryAwardedPoints: null,
    scoreNormalization: "known_categories_only",
    lowersConfidence: true,
  },
} as const satisfies {
  version: string;
  categories: readonly {
    id: FeasibilityCategoryId;
    maximumPoints: number;
  }[];
  bands: readonly { minimumScore: number; id: FeasibilityBand }[];
  categoryRules: {
    availableSpaceByScenario: Record<string, number>;
    serviceDistanceBands: readonly {
      minimumMetres: number;
      points: number;
    }[];
    intersectingServicePoints: number;
    triggeredConstraintPoints: number;
    severeSlopeDegrees: number;
    substantialFloodOverlapPercent: number;
    constructionAccessPoints: Record<
      "clear" | "constrained" | "blocked",
      number
    >;
  };
  confidence: {
    currentDatasetMaximumAgeDays: number;
    levels: Record<"high" | "medium" | "low", number>;
    partialAddressPoints: number;
    maximumPoints: Record<string, number>;
  };
  evidenceRequirements: Record<string, readonly string[]>;
  constraintGroups: Record<
    string,
    { id: string; evidenceIds: readonly string[] }
  >;
  criticalFlags: Record<
    string,
    { id: string; effect: "qualify" | "override"; rationale: string }
  >;
  finalRecommendations: {
    normalByBand: Record<FeasibilityBand, string>;
    specialistReview: string;
    insufficientCoreData: string;
    indeterminate: string;
  };
  missingEvidence: {
    categoryAwardedPoints: null;
    scoreNormalization: "known_categories_only";
    lowersConfidence: true;
  };
};

export function classifyFeasibilityScore(score: number): FeasibilityBand {
  const boundedScore = Math.max(0, Math.min(100, score));
  return (
    feasibilityScoringRules.bands.find(
      (band) => boundedScore >= band.minimumScore,
    ) ?? feasibilityScoringRules.bands[feasibilityScoringRules.bands.length - 1]
  ).id;
}
