import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
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
  return {
    ...canonical,
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
    layers,
    sources: canonical.sources,
    assumptions: [reportData.preliminaryFeasibilityWording],
    limitations: reportData.limitations,
    mapImageDataUrl: submission.report.mapImageDataUrl,
    mapImageSource: reportData.mapImageSource,
    mapVisibleLayerKeys: reportData.mapVisibleLayerKeys,
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
