import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import type { ConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import {
  buildCanonicalPoolFeasibilityReport,
  reportAddressSlug,
  type CanonicalPoolFeasibilityReport,
  type ReportDataSource,
} from "@/modules/reporting/pool-feasibility-report";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";

export type SavedPreliminaryReport = {
  reference: string;
  generatedAt: string;
  title: string;
  summary: string;
  warningState: "no_warning" | "needs_checking" | "blocked";
  property: {
    address: string;
    boundaryStatus: string;
    boundaryConfidence: "high" | "medium" | "low" | "unknown";
    boundaryAreaSquareMetres: number | null;
    parcelIdentifier: string | null;
    boundaryGeometry: NonNullable<
      PersistedAssessmentSubmission["addressEvidence"]["boundaryGeometry"]
    > | null;
  };
  pool: {
    lengthMetres: number;
    widthMetres: number;
    rotationDegrees: number;
    position: PersistedAssessmentSubmission["poolLayout"]["position"];
    shellGeometry: PersistedAssessmentSubmission["poolLayout"]["shellGeometry"];
    constructionEnvelopeGeometry: PersistedAssessmentSubmission["poolLayout"]["constructionEnvelopeGeometry"];
    clearancesVisible: boolean;
  };
  overall: CanonicalPoolFeasibilityReport["overall"];
  assessments: CanonicalPoolFeasibilityReport["assessments"];
  keyFindings: CanonicalPoolFeasibilityReport["keyFindings"];
  laterVerification: CanonicalPoolFeasibilityReport["laterVerification"];
  nextSteps: CanonicalPoolFeasibilityReport["nextSteps"];
  warnings: PersistedAssessmentSubmission["warnings"];
  recommendations: PersistedAssessmentSubmission["recommendations"];
  mainRecommendation: string;
  decision: {
    score: number | null;
    classification: string;
    confidence: string;
  };
  scenarios: Array<{
    label: string;
    status: string;
    usableAreaSquareMetres: number | null;
  }>;
  categories: Array<{
    id: string;
    maximumPoints: number;
    awardedPoints: number | null;
    status: "scored" | "unknown";
    rationale: string;
  }>;
  risks: PersistedAssessmentSubmission["report"]["reportData"]["risks"];
  actions: PersistedAssessmentSubmission["report"]["reportData"]["actions"];
  missingInformation: PersistedAssessmentSubmission["report"]["reportData"]["missingInformation"];
  terrain:
    PersistedAssessmentSubmission["report"]["reportData"]["terrain"] | null;
  constructability:
    | ConstructabilitySnapshot
    | {
        version: 0;
        status: "not_assessed";
        reason: string;
      };
  layers: Array<{
    id?: string;
    provider: string;
    dataset: string;
    evidenceUse?: string;
    state: PersistedAssessmentSubmission["layerStates"][number]["status"];
    confidence: string;
    attribution: string | null;
    sourceUrl: string | null;
    geometry?: NonNullable<
      PersistedAssessmentSubmission["layerStates"][number]["geometry"]
    > | null;
  }>;
  sources: ReportDataSource[];
  assumptions: string[];
  limitations: string[];
  mapImageDataUrl: string;
  mapImageSource?: PersistedAssessmentSubmission["report"]["reportData"]["mapImageSource"];
  mapVisibleLayerKeys?: string[];
};

export type SavedPreliminaryReportSource = Pick<
  PersistedAssessmentSubmission,
  | "addressEvidence"
  | "poolLayout"
  | "layerStates"
  | "warnings"
  | "recommendations"
  | "report"
>;

const FALLBACK_CATEGORIES: SavedPreliminaryReport["categories"] = [
  ["available_space", 25],
  ["underground_services", 20],
  ["flooding_and_drainage", 20],
  ["terrain_and_slope", 15],
  ["planning_constraints", 10],
  ["construction_access", 10],
].map(([id, maximumPoints]) => ({
  id: String(id),
  maximumPoints: Number(maximumPoints),
  awardedPoints: null,
  status: "unknown",
  rationale: "Not evaluated in this preliminary placement view.",
}));

const FALLBACK_SCENARIOS: SavedPreliminaryReport["scenarios"] = [
  "Compact",
  "Standard",
  "Large",
].map((label) => ({
  label,
  status: "insufficient_data",
  usableAreaSquareMetres: null,
}));

export function buildSavedPreliminaryReport({
  submission,
  reference,
  createdAt,
}: {
  submission: SavedPreliminaryReportSource;
  reference: string;
  createdAt: string;
}): SavedPreliminaryReport {
  const reportData = submission.report.reportData;
  const snapshot = reportData.assessmentSnapshot ?? null;
  const layers = submission.layerStates.map((layer) => {
    const provenance = reportData.provenance.datasets.find(
      (dataset) =>
        dataset.provider === layer.provider &&
        dataset.dataset === layer.dataset,
    );
    const evidenceUse =
      provenance?.evidenceUse ??
      (layer.status === "internal_reference_only"
        ? "internal_reference"
        : "unavailable");
    return {
      id: provenance?.id,
      provider: layer.provider,
      dataset: layer.dataset,
      evidenceUse,
      state: layer.status,
      confidence: layer.confidence ?? "unknown",
      attribution: layer.attribution ?? null,
      sourceUrl: layer.sourceUrl ?? null,
      geometry:
        evidenceUse === "report_allowed" ? (layer.geometry ?? null) : null,
    };
  });
  const canonical = buildCanonicalPoolFeasibilityReport(submission, layers);
  const assessments = withTerrainAssessment(
    canonical.assessments,
    reportData.terrain,
  );
  return {
    ...canonical,
    overall:
      canonical.overall.status === "red"
        ? canonical.overall
        : reportData.constructability?.overallStatus === "needs_checking"
          ? {
              ...canonical.overall,
              status: "amber",
              headline: "Needs checking",
              summary:
                "Mapped or reported site conditions need onsite checking.",
            }
          : reportData.constructability?.overallStatus ===
                "not_fully_assessed" &&
              (canonical.overall.status === "green" ||
                canonical.overall.status === "unknown")
            ? {
                ...canonical.overall,
                status: "unknown",
                headline: "Not fully assessed",
                summary:
                  "Critical site evidence or answers remain uncertain. Confirm the site conditions onsite.",
              }
            : canonical.overall,
    assessments,
    reference,
    generatedAt: createdAt,
    title: submission.report.title,
    summary: submission.report.summary,
    warningState: submission.report.feasibilityState,
    property: {
      address: submission.addressEvidence.formattedAddress,
      boundaryStatus: submission.addressEvidence.boundaryStatus,
      boundaryConfidence: boundaryConfidence(
        submission.addressEvidence.boundaryStatus,
      ),
      boundaryAreaSquareMetres:
        submission.addressEvidence.boundaryAreaSquareMetres ?? null,
      parcelIdentifier: submission.addressEvidence.parcelIdentifier ?? null,
      boundaryGeometry: submission.addressEvidence.boundaryGeometry ?? null,
    },
    pool: {
      lengthMetres: submission.poolLayout.lengthMetres,
      widthMetres: submission.poolLayout.widthMetres,
      rotationDegrees: submission.poolLayout.rotationDegrees,
      position: submission.poolLayout.position,
      shellGeometry: submission.poolLayout.shellGeometry,
      constructionEnvelopeGeometry:
        submission.poolLayout.constructionEnvelopeGeometry,
      clearancesVisible: submission.poolLayout.clearancesVisible,
    },
    warnings: submission.warnings,
    recommendations: [...submission.recommendations].sort(
      (left, right) => left.priority - right.priority,
    ),
    mainRecommendation: reportData.recommendation,
    decision: {
      score: snapshot?.feasibilityAssessment.score ?? null,
      classification: snapshot?.feasibilityAssessment.band ?? "indeterminate",
      confidence: snapshot?.feasibilityAssessment.confidence.level ?? "unknown",
    },
    scenarios:
      snapshot?.scenarioComparison.scenarios.map((scenario) => ({
        label: scenario.scenario.label,
        status: scenario.status,
        usableAreaSquareMetres: scenario.usableAreaSquareMetres,
      })) ?? FALLBACK_SCENARIOS,
    categories:
      snapshot?.feasibilityAssessment.categories ?? FALLBACK_CATEGORIES,
    risks: reportData.risks,
    actions: reportData.actions,
    missingInformation: reportData.missingInformation,
    terrain: reportData.terrain ?? null,
    constructability: reportData.constructability ?? {
      version: 0,
      status: "not_assessed",
      reason:
        "Site constructability evidence was not captured for this assessment.",
    },
    layers,
    sources: canonical.sources,
    assumptions: [reportData.preliminaryFeasibilityWording],
    limitations: reportData.limitations,
    mapImageDataUrl: submission.report.mapImageDataUrl,
    mapImageSource: reportData.mapImageSource,
    mapVisibleLayerKeys: reportData.mapVisibleLayerKeys,
  };
}

function withTerrainAssessment(
  assessments: SavedPreliminaryReport["assessments"],
  terrain: PersistedAssessmentSubmission["report"]["reportData"]["terrain"],
): SavedPreliminaryReport["assessments"] {
  if (!terrain) return assessments;
  if (terrain.status === "needs_checking") {
    return {
      ...assessments,
      terrain: {
        ...assessments.terrain,
        status: "unknown",
        headline: "Needs checking",
        summary: terrain.reasons.join(" "),
      },
    };
  }
  if (terrain.reportEligibility !== "approved") {
    return {
      ...assessments,
      terrain: {
        ...assessments.terrain,
        status: "unknown",
        headline: "Needs checking",
        summary:
          "Terrain information has not yet completed the checks required for inclusion in this preliminary report.",
        details: [],
      },
    };
  }
  const bufferedProposedPool =
    terrain.analysisArea === "buffered_proposed_pool";
  const details = [
    {
      label: bufferedProposedPool
        ? "Proposed pool area average slope"
        : "Property average slope",
      value: `${terrain.averageSlopeDegrees.toFixed(1)}°`,
    },
    {
      label: bufferedProposedPool
        ? "Steeper sampled pool areas"
        : "Steeper sampled areas",
      value: `${terrain.upperSlopeDegrees.toFixed(1)}°`,
    },
    {
      label: bufferedProposedPool
        ? "Estimated pool area height change"
        : "Estimated property height change",
      value: `${terrain.estimatedFallMetres.toFixed(2)} m`,
    },
    {
      label: bufferedProposedPool
        ? "Pool area downhill direction"
        : "Overall downhill direction",
      value: terrain.downhillDirection ?? "Approximately flat",
    },
    ...(!bufferedProposedPool && terrain.constructionEnvelopeTerrain
      ? [
          {
            label: "Proposed pool construction area slope",
            value: `${terrain.constructionEnvelopeTerrain.averageSlopeDegrees.toFixed(1)}°`,
          },
          {
            label: "Proposed pool construction area height change",
            value: `${terrain.constructionEnvelopeTerrain.estimatedFallMetres.toFixed(2)} m`,
          },
        ]
      : []),
  ];
  return {
    ...assessments,
    terrain: {
      ...assessments.terrain,
      status: "amber",
      headline: "Indicative terrain measurement",
      summary:
        "Indicative DEM-derived slope is available for early planning. Confirm levels with a current site survey before design, excavation or construction.",
      details,
    },
  };
}

export function preliminaryReportFilename(
  report: Pick<SavedPreliminaryReport, "reference" | "property">,
): string {
  const addressSlug = reportAddressSlug(report.property.address);
  return `preliminary-pool-feasibility-${addressSlug || report.reference.toLowerCase()}.pdf`;
}

export function renderPreliminaryReportHtml(
  report: SavedPreliminaryReport,
): string {
  return renderCanonicalPreliminaryReportHtml(report);
}

function boundaryConfidence(
  status: PersistedAssessmentSubmission["addressEvidence"]["boundaryStatus"],
): SavedPreliminaryReport["property"]["boundaryConfidence"] {
  if (status === "confirmed") return "high";
  if (status === "provisional") return "medium";
  if (status === "multiple") return "low";
  return "unknown";
}
