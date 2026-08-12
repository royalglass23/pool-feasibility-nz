import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  REPORT_MAP_BASE_STYLES,
  reportMapLayerKey,
  reportMapLayerStyle,
  reportMapPoolStyle,
  shouldReproduceReportMapLayer,
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
  statusLabel?:
    | "Mapped"
    | "Not reproduced"
    | "No mapped evidence"
    | "Unavailable / unknown";
};

const DETAILED_CHECK_LEGEND_KEYS = [
  "contours",
  "public_stormwater_assets",
  "wastewater_assets",
  "public_water_assets",
  "electricity_feeder_lines",
  "gas_distribution_lines",
] as const;

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
    if (hasMappedGeometry && layer.evidenceUse !== "report_allowed") {
      if (!excludedLayers.includes(layer.dataset)) {
        excludedLayers.push(layer.dataset);
      }
    }
  }

  for (const key of DETAILED_CHECK_LEGEND_KEYS) {
    const style = reportMapLayerStyle(key);
    const categoryLayers = report.layers.filter(
      (layer) => reportLayerStyle(layer).label === style.label,
    );
    const mapped = categoryLayers.some(
      (layer) =>
        layer.state === "returned" && layer.evidenceUse === "report_allowed",
    );
    const notReproduced = categoryLayers.some(
      (layer) =>
        (layer.state === "returned" ||
          layer.state === "internal_reference_only") &&
        layer.evidenceUse !== "report_allowed",
    );
    const unavailableOrUnknown =
      categoryLayers.length === 0 ||
      categoryLayers.some(
        (layer) =>
          layer.state === "unavailable" || layer.state === "provider_error",
      );
    entries.push({
      id: key,
      label: style.label,
      colour: style.colour,
      kind: "line",
      dashed: style.dashed,
      statusLabel: mapped
        ? "Mapped"
        : notReproduced
          ? "Not reproduced"
          : unavailableOrUnknown
            ? "Unavailable / unknown"
            : "No mapped evidence",
    });
    seen.add(style.label);
  }

  for (const layer of report.layers) {
    if (
      layer.state !== "returned" ||
      layer.evidenceUse !== "report_allowed" ||
      !shouldReproduceReportMapLayer(reportLayerKey(layer))
    ) {
      continue;
    }
    const style = reportLayerStyle(layer);
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

function reportLayerStyle(layer: SavedPreliminaryReport["layers"][number]) {
  return reportMapLayerStyle(reportLayerKey(layer));
}

function reportLayerKey(layer: SavedPreliminaryReport["layers"][number]) {
  return reportMapLayerKey(layer.id, layer.dataset);
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
