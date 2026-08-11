import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  REPORT_MAP_BASE_STYLES,
  reportMapLayerStyle,
  reportMapPoolStyle,
} from "@/modules/reporting/report-map-style";

export const CC_BY_4_LICENCE_URL =
  "https://creativecommons.org/licenses/by/4.0/legalcode";

export function reportLicenceUrl(licence: string): string | null {
  return /(?:Creative Commons Attribution 4\.0|CC BY 4\.0)/i.test(licence)
    ? CC_BY_4_LICENCE_URL
    : null;
}

export type ReportMapLegendEntry = {
  id: string;
  label: string;
  colour: string;
  kind: "area" | "line";
  dashed?: boolean;
};

export function reportMapLegend(report: SavedPreliminaryReport): {
  entries: ReportMapLegendEntry[];
  excludedLayers: string[];
} {
  const entries: ReportMapLegendEntry[] = [
    {
      id: "property-boundary",
      ...REPORT_MAP_BASE_STYLES.boundary,
      kind: "area",
    },
    {
      id: "selected-pool",
      ...reportMapPoolStyle(report.warningState),
      kind: "area",
    },
    {
      id: "construction-envelope",
      ...REPORT_MAP_BASE_STYLES.constructionEnvelope,
      kind: "line",
    },
  ];
  const seen = new Set(entries.map((entry) => entry.label));
  const excludedLayers: string[] = [];

  for (const layer of report.layers) {
    const hasMappedGeometry =
      layer.state === "returned" || layer.state === "internal_reference_only";
    if (!hasMappedGeometry) continue;
    if (layer.evidenceUse !== "report_allowed") {
      if (!excludedLayers.includes(layer.dataset)) {
        excludedLayers.push(layer.dataset);
      }
      continue;
    }
    const style = reportMapLayerStyle(layer.id ?? layer.dataset);
    if (seen.has(style.label)) continue;
    entries.push({
      id: layer.id ?? layer.dataset,
      label: style.label,
      colour: style.colour,
      kind: "line",
      dashed: style.dashed,
    });
    seen.add(style.label);
  }

  return { entries, excludedLayers };
}

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
