import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";

export function reportWarningLabel(
  state: SavedPreliminaryReport["warningState"],
): string {
  if (state === "no_warning") return "No warning";
  if (state === "blocked") return "Blocked";
  return "Needs checking";
}

export function humanizeReportValue(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatReportBoundaryArea(
  areaSquareMetres: number | null,
): string {
  return areaSquareMetres === null
    ? "Unavailable"
    : `${areaSquareMetres.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} m²`;
}

export function formatReportGeneratedAt(generatedAt: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Pacific/Auckland",
  }).format(new Date(generatedAt));
}

export function reportRecommendations(
  report: SavedPreliminaryReport,
): SavedPreliminaryReport["recommendations"] {
  if (report.recommendations.length > 0) return report.recommendations;
  return [
    {
      phase: "before_concept_design",
      priority: 0,
      title: "Main recommendation",
      reason: report.mainRecommendation,
    },
  ];
}
