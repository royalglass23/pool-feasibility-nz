import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { DatasetKey } from "@/modules/data-access-spike/dataset-catalog";
import type { AssessmentExplanation } from "@/modules/recommendations/generate-assessment-explanation";
import { humanizeIdentifier as humanize } from "@/shared/text/humanize-identifier";

export type AssessmentRiskSeverity = "low" | "medium" | "high";

export interface AssessmentRisk {
  id: string;
  category: string;
  title: string;
  severity: AssessmentRiskSeverity;
  evidence: string;
  source: string;
  confidence: "high" | "limited" | "unavailable";
  impact: string;
  action: string;
  specialistReviewRequired: boolean;
}

export interface SessionAssessment {
  property: {
    addressId: string;
    address: string;
    parcelId: string;
    appellation: string;
    generatedAt: string;
  };
  recommendation: string;
  feasibilityAssessment: DataAccessSpikeResult["feasibilityAssessment"];
  scenarioComparison: ReturnType<typeof downloadableScenarioComparison>;
  assessmentExplanation: AssessmentExplanation | null;
  preliminaryFeasibilityWording: string;
  risks: AssessmentRisk[];
  actions: Array<{
    phase:
      | "before_concept_design"
      | "before_quotations"
      | "before_consent_or_construction";
    items: string[];
  }>;
  missingInformation: Array<{
    id: string;
    label: string;
    status: "unverified";
  }>;
  limitations: string[];
  provenance: {
    datasets: Array<{
      id: string;
      provider: string;
      dataset: string;
      datasetIdentifier: string;
      status: "success" | "available" | "unavailable" | "error";
      evidenceUse:
        "report_allowed" | "spike_only" | "internal_reference" | "unavailable";
      retrievedAt: string;
      datasetDate: string | null;
      licence: string;
      attribution: { text: string; url: string } | null;
      confidence: "high" | "limited" | "unavailable";
      availabilityNote: string | null;
    }>;
  };
  session: {
    persistence: "none";
    notice: string;
  };
}

const missingInformation: SessionAssessment["missingInformation"] = [
  missing("title", "Current title interests and covenants"),
  missing("easements", "Registered and unregistered easements"),
  missing("private_services", "Private stormwater and wastewater services"),
  missing(
    "public_and_private_pipe_position_and_depth",
    "Exact public/private water, drainage, gas, and electricity service position and depth",
  ),
  missing("consent_notices", "Consent notices affecting the property"),
  missing("geotechnical_conditions", "Geotechnical conditions"),
  missing("groundwater", "Groundwater conditions"),
  missing("retaining_walls", "Retaining-wall condition and influence"),
  missing("construction_access", "Exact construction access"),
  missing("pool_barrier", "Final pool barrier design"),
  missing("consent_requirements", "Final consent and approval requirements"),
  missing("onsite_service_locating", "Onsite service locating"),
];

export function buildSessionAssessment(
  result: DataAccessSpikeResult,
  assessmentExplanation?: AssessmentExplanation,
): SessionAssessment {
  const legalParcel =
    result.datasets.legal_parcel ?? result.datasets.address_resolution;

  return {
    property: {
      addressId: result.resolvedAddress.addressId,
      address: result.resolvedAddress.fullAddress,
      parcelId: result.parcel.parcelId,
      appellation: result.parcel.appellation,
      generatedAt: result.generatedAt,
    },
    recommendation: result.feasibilityAssessment.finalRecommendation,
    feasibilityAssessment: result.feasibilityAssessment,
    scenarioComparison: downloadableScenarioComparison(
      result.scenarioComparison,
    ),
    assessmentExplanation: assessmentExplanation ?? null,
    preliminaryFeasibilityWording:
      "Based on available mapped information, the property appears to have potential for a residential swimming pool, subject to onsite investigation, detailed design, utility locating, title review, and applicable approvals.",
    risks: [
      {
        id: "unverified_legal_and_site_information",
        category: "Legal and site due diligence",
        title: "Legal interests and site conditions remain unverified",
        severity: "high",
        evidence:
          "The desktop assessment does not include a current title review, easement verification, geotechnical investigation, groundwater investigation, or onsite service locating.",
        source: legalParcel
          ? `${legalParcel.provider} / ${legalParcel.dataset}`
          : "No legal-parcel source available",
        confidence: legalParcel?.confidence ?? "unavailable",
        impact:
          "Unverified interests or physical conditions may change the feasible pool position, design, cost, or approval path.",
        action:
          "Complete title review, specialist site investigations, and onsite service locating before relying on a concept design.",
        specialistReviewRequired: true,
      },
      ...result.feasibilityAssessment.criticalFlags.map((flag) =>
        criticalFlagRisk(result, flag),
      ),
    ],
    actions: [
      {
        phase: "before_concept_design",
        items: [
          "Review the current title, easements, covenants, and consent notices.",
          "Obtain BeforeUdig plans and locate all private and public services onsite.",
        ],
      },
      {
        phase: "before_quotations",
        items: [
          "Confirm geotechnical, groundwater, retaining-wall, and construction-access conditions.",
        ],
      },
      {
        phase: "before_consent_or_construction",
        items: [
          "Confirm the final pool barrier and all building, resource, Works Over, and other approval requirements.",
        ],
      },
    ],
    missingInformation: missingInformation.map((item) => ({ ...item })),
    limitations: [
      "This assessment does not provide approval, consent advice, engineering design, construction safety assurance, a survey, title advice, utility location, or an approved pool position.",
      "Vector open electricity and gas geometry is preliminary reference evidence only and may be incomplete or inaccurate; obtain BeforeUdig plans and onsite locating before excavation or design reliance.",
    ],
    provenance: {
      datasets: Object.entries(result.datasets).map(([id, evidence]) => ({
        id,
        provider: evidence.provider,
        dataset: evidence.dataset,
        datasetIdentifier: evidence.datasetIdentifier ?? "Not supplied",
        status: evidence.status,
        evidenceUse: evidence.evidenceUse,
        retrievedAt: evidence.retrievedAt ?? result.generatedAt,
        datasetDate: evidence.datasetDate ?? null,
        licence: evidence.licence ?? "Not supplied",
        attribution: evidence.attribution ?? null,
        confidence:
          evidence.confidence ??
          (evidence.status === "success" || evidence.status === "available"
            ? "limited"
            : "unavailable"),
        availabilityNote:
          evidence.status === "success" || evidence.status === "available"
            ? null
            : (evidence.reason ?? evidence.errorCode ?? "Unavailable"),
      })),
    },
    session: {
      persistence: "none",
      notice:
        "This result exists only in the current browser session and disappears after refresh or restart. No database or durable report history exists.",
    },
  };
}

function downloadableScenarioComparison(
  comparison: DataAccessSpikeResult["scenarioComparison"],
) {
  return {
    version: comparison.version,
    preferences: comparison.preferences,
    rankedScenarioIds: comparison.rankedScenarioIds,
    successfulShells: comparison.successfulShells,
    recommendedShell: comparison.recommendedShell,
    shellRange: comparison.shellRange,
    scenarios: comparison.scenarios.map((analysis) => ({
      scenario: analysis.scenario,
      status: analysis.status,
      resultWording: analysis.resultWording,
      testedPlacementCount: analysis.testedPlacementCount,
      testedRotationsDegrees: analysis.testedRotationsDegrees,
      usableAreaSquareMetres: analysis.usableAreaSquareMetres,
      constraintScreening: analysis.constraintScreening,
      constraintGroupScreening: analysis.constraintGroupScreening,
      missingRequiredEvidence: analysis.missingRequiredEvidence,
      candidates: analysis.candidates.map((candidate) => ({
        id: candidate.id,
        rank: candidate.rank,
        rotationDegrees: candidate.rotationDegrees,
        shellLengthMetres: analysis.scenario.shellLengthMetres,
        shellWidthMetres: analysis.scenario.shellWidthMetres,
        constructionAllowanceMetres:
          analysis.scenario.constructionAllowanceMetres,
        constraintIntersections: candidate.constraintIntersections.map(
          (measurement) => ({
            evidenceId: measurement.evidence.id,
            status: measurement.status,
            intersects: measurement.intersects,
            affectedEnvelopePercent: measurement.affectedEnvelopePercent,
          }),
        ),
        mappedServiceDistances: candidate.mappedServiceDistances.map(
          (measurement) => ({
            evidenceId: measurement.evidence.id,
            status: measurement.status,
            distanceMetres: measurement.distanceMetres,
          }),
        ),
        rankingEvidence: candidate.rankingEvidence,
      })),
    })),
  };
}

function criticalFlagRisk(
  result: DataAccessSpikeResult,
  flag: DataAccessSpikeResult["feasibilityAssessment"]["criticalFlags"][number],
): AssessmentRisk {
  const common = {
    id: `critical:${flag.id}`,
    evidence: flag.rationale,
    specialistReviewRequired: true,
  } as const;

  switch (flag.id) {
    case "parcel_unconfirmed":
      return {
        ...common,
        category: "Property identity",
        title: "The legal parcel requires confirmation",
        severity: "high",
        source: datasetSource(result, ["legal_parcel"]),
        confidence: datasetConfidence(result, ["legal_parcel"]),
        impact:
          "Analysing the wrong legal parcel would invalidate candidate placement and all downstream findings.",
        action:
          "Confirm the legal parcel through current title information and specialist review before concept design.",
      };
    case "major_mapped_infrastructure":
      return {
        ...common,
        category: "Underground services",
        title: "Major mapped infrastructure affects apparent usable areas",
        severity: "high",
        source: datasetSource(result, [
          "public_stormwater_assets",
          "wastewater_assets",
          "public_water_assets",
          "electricity_feeder_lines",
          "gas_distribution_lines",
        ]),
        confidence: datasetConfidence(result, [
          "public_stormwater_assets",
          "wastewater_assets",
          "public_water_assets",
          "electricity_feeder_lines",
          "gas_distribution_lines",
        ]),
        impact:
          "Mapped services may constrain pool position, excavation, protection requirements, cost, or Works Over approvals.",
        action:
          "Obtain current network plans and complete onsite utility locating before progressing a concept design.",
      };
    case "all_candidates_flood_affected":
      return {
        ...common,
        category: "Flooding and drainage",
        title: "Mapped flood hazards affect all apparent candidates",
        severity: "high",
        source: datasetSource(result, ["flood_plains", "flood_prone_areas"]),
        confidence: datasetConfidence(result, [
          "flood_plains",
          "flood_prone_areas",
        ]),
        impact:
          "Flood exposure may materially change the pool position, drainage design, cost, or feasibility.",
        action:
          "Obtain specialist flood and drainage review before progressing a concept design.",
      };
    case "candidate_overland_flow_path":
      return {
        ...common,
        category: "Flooding and drainage",
        title: "An apparent candidate crosses a mapped overland flow path",
        severity: "high",
        source: datasetSource(result, ["overland_flow_paths"]),
        confidence: datasetConfidence(result, ["overland_flow_paths"]),
        impact:
          "Obstructing or redirecting overland flow may increase flood effects and prevent the indicated placement.",
        action:
          "Obtain specialist flood and drainage review before progressing a concept design.",
      };
    case "severe_mapped_terrain":
      return {
        ...common,
        category: "Terrain and slope",
        title: "Mapped terrain reaches the severe screening threshold",
        severity: "high",
        source: datasetSource(result, ["contours"]),
        confidence: datasetConfidence(result, ["contours"]),
        impact:
          "Steep or uncertain terrain may require retaining, structural, drainage, and geotechnical design changes.",
        action:
          "Commission topographical and geotechnical review before relying on a pool position or quotation.",
      };
    case "required_core_data_unavailable":
      return {
        ...common,
        category: "Evidence availability",
        title: "Required core evidence is unavailable",
        severity: "high",
        source: "Normalized official dataset evidence",
        confidence: "unavailable",
        impact:
          "The assessment cannot distinguish an absent mapped constraint from an unavailable evidence source.",
        action:
          "Restore or independently obtain the missing core evidence before relying on the preliminary assessment.",
      };
    case "known_restricted_overlay":
      return {
        ...common,
        category: "Planning constraints",
        title: "A known restricted overlay affects an apparent candidate",
        severity: "medium",
        source: datasetSource(result, ["planning_overlays"]),
        confidence: datasetConfidence(result, ["planning_overlays"]),
        impact:
          "The overlay may alter the design, specialist inputs, or approval pathway.",
        action:
          "Obtain planning advice before progressing the affected concept.",
      };
    default:
      return {
        ...common,
        category: "Deterministic critical flag",
        title: humanize(flag.id),
        severity: flag.effect === "override" ? "high" : "medium",
        source: `Deterministic feasibility rules ${result.feasibilityAssessment.analysisVersion}`,
        confidence: "limited",
        impact:
          "This critical flag qualifies or overrides the normal preliminary result.",
        action: "Obtain specialist review before relying on the assessment.",
      };
  }
}

function datasetSource(
  result: DataAccessSpikeResult,
  ids: DatasetKey[],
): string {
  const sources = ids.flatMap((id) => {
    const evidence = result.datasets[id];
    return evidence ? [`${evidence.provider} / ${evidence.dataset}`] : [];
  });
  return sources.length > 0 ? sources.join("; ") : "Dataset unavailable";
}

function datasetConfidence(
  result: DataAccessSpikeResult,
  ids: DatasetKey[],
): AssessmentRisk["confidence"] {
  const confidences = ids.flatMap((id) => {
    const confidence = result.datasets[id]?.confidence;
    return confidence ? [confidence] : [];
  });
  if (confidences.length === 0 || confidences.includes("unavailable")) {
    return "unavailable";
  }
  return confidences.includes("limited") ? "limited" : "high";
}

function missing(
  id: string,
  label: string,
): SessionAssessment["missingInformation"][number] {
  return { id, label, status: "unverified" };
}
