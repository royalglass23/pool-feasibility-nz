import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import {
  reportMapLayerKey,
  shouldReproduceReportMapLayer,
} from "@/modules/reporting/report-map-style";
import { escapeHtml } from "@/shared/html/escape-html";
import {
  formatReportBoundaryArea,
  formatReportGeneratedAt,
  humanizeReportValue,
  reportLicenceUrl,
  reportRecommendations,
  reportMapLegend,
  reportWarningLabel,
} from "@/modules/reporting/preliminary-report-presentation";

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
  };
  pool: {
    lengthMetres: number;
    widthMetres: number;
    rotationDegrees: number;
  };
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
  }>;
  sources: Array<{
    provider: string;
    dataset: string;
    status: string;
    evidenceUse: string;
    licence: string;
    attribution: string | null;
    sourceUrl: string | null;
    retrievedAt?: string | null;
  }>;
  assumptions: string[];
  limitations: string[];
  mapImageDataUrl: string;
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

const REPORT_ALLOWED_COUNCIL_STORMWATER_KEYS = new Set([
  "public_stormwater_assets",
  "manholes",
  "catchpits",
  "watercourses",
]);

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
    return {
      id: provenance?.id,
      provider: layer.provider,
      dataset: layer.dataset,
      evidenceUse:
        provenance?.evidenceUse ??
        (layer.status === "internal_reference_only"
          ? "internal_reference"
          : "unavailable"),
      state: layer.status,
      confidence: layer.confidence ?? "unknown",
      attribution: layer.attribution ?? null,
      sourceUrl: layer.sourceUrl ?? null,
    };
  });
  return {
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
    },
    pool: {
      lengthMetres: submission.poolLayout.lengthMetres,
      widthMetres: submission.poolLayout.widthMetres,
      rotationDegrees: submission.poolLayout.rotationDegrees,
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
    sources: reportSources(reportData.provenance.datasets, layers),
    assumptions: [reportData.preliminaryFeasibilityWording],
    limitations: reportData.limitations,
    mapImageDataUrl: submission.report.mapImageDataUrl,
  };
}

export function preliminaryReportFilename(
  report: Pick<SavedPreliminaryReport, "reference">,
): string {
  return `pool-feasibility-${report.reference.replace(/[^a-z0-9-]/gi, "-")}.pdf`;
}

export function renderPreliminaryReportHtml(
  report: SavedPreliminaryReport,
): string {
  const esc = (value: unknown) => escapeHtml(String(value ?? ""));
  const renderSource = (source: SavedPreliminaryReport["sources"][number]) => {
    const licenceUrl = reportLicenceUrl(source.licence);
    const licence = licenceUrl
      ? `<a href="${esc(licenceUrl)}">${esc(source.licence)}</a>`
      : esc(source.licence);
    return `<div><b>${esc(source.dataset)}</b> · ${esc(source.provider)} · ${esc(humanizeReportValue(source.status))}<br>${source.attribution ? `${esc(source.attribution)} · ` : ""}${licence}${source.sourceUrl ? ` · <a href="${esc(source.sourceUrl)}">${esc(source.sourceUrl)}</a>` : ""}${source.retrievedAt ? ` · Retrieved ${esc(formatReportSourceDate(source.retrievedAt))}` : ""}</div>`;
  };
  const primarySources = report.sources.slice(0, 8);
  const sourceAppendixChunks = chunkSources(report.sources.slice(8), 12);
  const pageCount = 3 + sourceAppendixChunks.length;
  const generatedDate = formatReportGeneratedAt(report.generatedAt);
  const warningLabel = reportWarningLabel(report.warningState);
  const boundaryArea = formatReportBoundaryArea(
    report.property.boundaryAreaSquareMetres,
  );
  const header = (section: string, page: number) =>
    `<header><div><b>Preliminary Feasibility Report</b><span>${esc(section)}</span></div><div>${esc(report.reference)}<br>Page ${page} of ${pageCount}</div></header>`;
  const footer = `<footer>Generated ${esc(generatedDate)} · Reference ${esc(report.reference)} · Preliminary assessment only</footer>`;
  const warnings =
    report.warnings.length > 0
      ? report.warnings
          .map(
            (warning) =>
              `<div class="warning ${esc(warning.state)}"><h3>${esc(warning.title)}</h3><p>${esc(warning.message)}</p></div>`,
          )
          .join("")
      : `<div class="warning ${esc(report.warningState)}"><h3>${esc(warningLabel)}</h3><p>${esc(report.summary)}</p></div>`;
  const recommendations = reportRecommendations(report)
    .map(
      (recommendation) =>
        `<li><b>${esc(recommendation.title)}</b><span>${esc(recommendation.reason)}</span></li>`,
    )
    .join("");
  const layers =
    report.layers.length > 0
      ? report.layers
          .map(
            (layer) =>
              `<tr><td>${esc(layer.dataset)}</td><td>${esc(layer.provider)}</td><td>${esc(layer.state.replaceAll("_", " "))}</td><td>${esc(layer.confidence)}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="4">Detailed official checks have not been loaded.</td></tr>';
  const scenarios = report.scenarios
    .slice(0, 3)
    .map(
      (scenario) =>
        `<div class="scenario-card"><h3>${esc(scenario.label)}</h3><b>${esc(humanizeReportValue(scenario.status))}</b><span>${scenario.usableAreaSquareMetres === null ? "Usable area unavailable" : `${esc(scenario.usableAreaSquareMetres)} m² usable area`}</span></div>`,
    )
    .join("");
  const categories = report.categories
    .map(
      (category) =>
        `<tr class="category-row"><td>${esc(humanizeReportValue(category.id))}</td><td>${esc(category.status)}</td><td>${esc(category.awardedPoints ?? "—")} / ${esc(category.maximumPoints)}</td><td>${esc(category.rationale)}</td></tr>`,
    )
    .join("");
  const risks =
    report.risks.length > 0
      ? report.risks
          .slice(0, 5)
          .map(
            (risk) =>
              `<div class="risk ${esc(risk.severity)}"><h3>${esc(risk.title)}</h3><p>${esc(risk.evidence)}</p><p><b>Action:</b> ${esc(risk.action)}</p></div>`,
          )
          .join("")
      : "<p>No additional material risk was recorded.</p>";
  const topRisks =
    report.risks.length > 0
      ? `<div class="top-risk-grid">${report.risks
          .slice(0, 3)
          .map(
            (risk) =>
              `<div class="top-risk ${esc(risk.severity)}"><h3>${esc(risk.title)}</h3><p>${esc(risk.impact)}</p></div>`,
          )
          .join("")}</div>`
      : warnings;
  const actions = report.actions
    .flatMap((group) =>
      group.items.map(
        (item) =>
          `<div class="action"><b>${esc(humanizeReportValue(group.phase))}</b><span>${esc(item)}</span></div>`,
      ),
    )
    .slice(0, 7)
    .join("");
  const missingInformation =
    report.missingInformation.length > 0
      ? report.missingInformation
          .slice(0, 12)
          .map((item) => `<li>${esc(item.label)}</li>`)
          .join("")
      : "<li>No additional missing-information item was recorded.</li>";
  const sources =
    primarySources.length > 0
      ? primarySources.map(renderSource).join("")
      : "<div>No report-eligible source attribution was recorded.</div>";
  const mappedSourceKeys = new Set(
    report.layers
      .filter(
        (layer) =>
          layer.state === "returned" &&
          layer.evidenceUse === "report_allowed" &&
          shouldReproduceReportMapLayer(
            reportMapLayerKey(layer.id, layer.dataset),
          ),
      )
      .map((layer) => `${layer.provider}|${layer.dataset}`),
  );
  const mapSources = report.sources.filter(
    (source) =>
      !/building outline/i.test(source.dataset) &&
      (mappedSourceKeys.has(`${source.provider}|${source.dataset}`) ||
        (source.provider === "LINZ" &&
          /(?:aerial|parcel)/i.test(source.dataset))),
  );
  const mapAttributionGroups = new Map<
    string,
    SavedPreliminaryReport["sources"]
  >();
  for (const source of mapSources) {
    const key = `${source.provider}|${source.attribution}|${source.licence}|${source.retrievedAt}`;
    const group = mapAttributionGroups.get(key);
    if (group) group.push(source);
    else mapAttributionGroups.set(key, [source]);
  }
  const mapAttribution =
    mapAttributionGroups.size > 0
      ? [...mapAttributionGroups.values()]
          .map((group) => {
            const source = group[0];
            const licenceUrl = reportLicenceUrl(source.licence);
            const licence = licenceUrl
              ? `<a href="${esc(licenceUrl)}">${esc(source.licence)}</a>`
              : esc(source.licence);
            const exactSources = group
              .map((item) =>
                item.sourceUrl
                  ? `<a href="${esc(item.sourceUrl)}">${esc(item.dataset)}</a>`
                  : esc(item.dataset),
              )
              .join(", ");
            return `<div>${source.attribution ? `${esc(source.attribution)} · ` : ""}${licence} · Sources: ${exactSources}${source.retrievedAt ? ` · Retrieved ${esc(formatReportSourceDate(source.retrievedAt))}` : ""}</div>`;
          })
          .join("")
      : "<div>No report-eligible map attribution was recorded.</div>";
  const mapModificationNotice = report.layers.some(
    (layer) =>
      layer.state === "returned" &&
      layer.evidenceUse === "report_allowed" &&
      shouldReproduceReportMapLayer(reportMapLayerKey(layer.id, layer.dataset)),
  )
    ? "<div>Mapped provider geometry was clipped to the property assessment area and restyled for this report.</div>"
    : "";
  const councilStormwaterNotice = report.layers.some(
    (layer) =>
      layer.provider === "Auckland Council" &&
      layer.id !== undefined &&
      REPORT_ALLOWED_COUNCIL_STORMWATER_KEYS.has(layer.id) &&
      layer.state === "returned" &&
      layer.evidenceUse === "report_allowed",
  )
    ? "<div>Auckland Council stormwater is indicative only and supplied without accuracy or fitness warranty. Independently verify onsite before design or works. Not for legal disputes. No Auckland Council endorsement is implied.</div>"
    : "";
  const mapAttributionHtml = `<div class="source-note"><b>Map attribution</b>${mapAttribution}${mapModificationNotice}${councilStormwaterNotice}</div>`;
  const mapLegend = reportMapLegend(report);
  const mapLegendHtml = `<div class="map-key" aria-label="Map key"><b class="map-key-title">Map layers</b>${mapLegend.entries
    .map(
      (entry) =>
        `<span class="map-key-item${entry.statusLabel === "Mapped" || !entry.statusLabel ? "" : " muted"}"><i class="map-key-swatch ${esc(entry.kind)}${entry.dashed ? " dashed" : ""}" style="--map-colour:${esc(entry.colour)}"></i><span class="map-key-label">${esc(entry.label)}${entry.statusLabel ? `<small>${esc(entry.statusLabel)}</small>` : ""}</span></span>`,
    )
    .join("")}</div>`;
  const mapPanelHtml = (variant: "summary" | "detail") =>
    `<div class="report-map-panel ${variant}"><img class="map${variant === "summary" ? " summary-map" : ""}" src="${report.mapImageDataUrl}" alt="Saved property and pool map">${mapLegendHtml}</div>`;
  const excludedMapLayers =
    mapLegend.excludedLayers.length > 0
      ? `<p class="map-key-note"><b>Not reproduced in this report:</b> ${mapLegend.excludedLayers.map(esc).join(", ")}. These live reference layers remain excluded until report reuse is cleared.</p>`
      : "";
  const sourceAppendix = sourceAppendixChunks
    .map(
      (sourceChunk, index) => `
  <section class="page">${header("Data sources", index + 4)}
    <h1>Data sources</h1>
    <p>Continued exact source, licence, attribution and retrieval details for this report.</p>
    <div class="source-note">${sourceChunk.map(renderSource).join("")}</div>
    ${footer}
  </section>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;background:#eef2f4;color:#172126;font-family:Arial,sans-serif}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:0}.page{width:210mm;height:297mm;padding:12mm 13mm 10mm;background:#fff;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}
  header{height:17mm;border-bottom:1px solid #ccd6d9;display:flex;justify-content:space-between;font-size:8.5pt;color:#56666d}header b{display:block;color:#172126;font-size:11pt}header span{display:block;margin-top:2mm}header div:last-child{text-align:right;font-family:monospace}
  h1{font-size:21pt;line-height:1.1;margin:6mm 0 2mm}h2{font-size:12pt;margin:4mm 0 2mm}h3{font-size:9pt;margin:0 0 1mm}p,li,td,th{font-size:8pt;line-height:1.35}.summary{font-size:10pt}.status{display:inline-block;border:1px solid #f59e0b;border-radius:99px;padding:1.2mm 2.5mm;font-weight:700;text-transform:uppercase}.status.no_warning{border-color:#059669;color:#047857}.status.blocked{border-color:#dc2626;color:#b91c1c}.decision{display:grid;grid-template-columns:28mm 1fr;gap:4mm;border:1px solid #8fd0c3;background:#effaf7;padding:4mm;border-radius:3mm;margin:4mm 0}.score{display:grid;place-items:center;width:25mm;height:25mm;border-radius:50%;background:#0f766e;color:#fff;font-size:19pt;font-weight:700}.recommendation{font-size:11pt;line-height:1.25;color:#183b38;font-weight:700}.report-map-panel{display:grid;grid-template-columns:minmax(0,1fr) 48mm;overflow:hidden;border:1px solid #cbd5e1;border-radius:3mm;background:#fff}.report-map-panel.summary{grid-template-columns:minmax(0,1fr) 78mm}.map{width:100%;height:98mm;object-fit:contain;background:#e2e8f0}.map.summary-map{height:40mm}.report-map-panel .map-key{margin:0;border-left:1px solid #cbd5e1;border-radius:0}.map-key{display:flex;flex-direction:column;gap:1.5mm;margin-top:2mm;padding:2.5mm;background:#f8fafc;border-radius:2mm}.map-key-title{font-size:8pt;color:#172126}.report-map-panel.summary .map-key{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:1.2mm 2mm;padding:2mm}.report-map-panel.summary .map-key-title{grid-column:1/-1}.map-key-item{display:flex;align-items:center;gap:1.5mm;font-size:7pt;font-weight:700;color:#334155}.map-key-item.muted{color:#64748b}.map-key-item.muted .map-key-swatch{opacity:.5}.map-key-label small{display:block;margin-top:.4mm;font-size:6pt;font-weight:400;color:#64748b}.map-key-swatch{display:inline-block;width:8mm;height:0;border-top:1.1mm solid var(--map-colour)}.map-key-swatch.area{height:3mm;border:0;background:color-mix(in srgb,var(--map-colour) 35%,white);outline:.8mm solid var(--map-colour);outline-offset:-.8mm}.map-key-swatch.dashed{border-top-style:dashed}.map-key-note{margin:1.5mm 0 0;font-size:7pt;color:#475569}.facts,.scenario-grid,.top-risk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin:4mm 0}.fact,.scenario-card{border:1px solid #d7e0e3;border-radius:3mm;padding:2.5mm}.fact b,.scenario-card b,.scenario-card span{display:block;margin-bottom:1mm}.warning,.risk,.top-risk{border-left:3px solid #f59e0b;padding:2.5mm;margin-bottom:2mm;background:#fff7ed}.warning.no_warning{border-color:#059669;background:#ecfdf5}.warning.blocked,.risk.high,.top-risk.high{border-color:#dc2626;background:#fef2f2}.top-risk{min-height:22mm}.recommendations{padding-left:5mm}.recommendations li{margin-bottom:2mm}.recommendations span{display:block}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:2mm;border-bottom:1px solid #dce3e5;text-align:left;vertical-align:top}.table th{background:#f8fafc}.source-note{margin-top:2mm;padding:2.5mm;border:1px solid #dce3e5;background:#f8fafb;font-size:7pt;line-height:1.3}.source-note div{margin-top:1mm}.columns{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.action{display:grid;grid-template-columns:34mm 1fr;gap:2mm;padding:2mm 0;border-bottom:1px solid #e0e6e8;font-size:8pt}.action b{text-transform:capitalize}.small-list{margin:0;padding-left:5mm}.small-list li{margin-bottom:1mm}.limits{padding-left:5mm}.limits li{margin-bottom:1mm}footer{position:absolute;left:13mm;right:13mm;bottom:5mm;border-top:1px solid #dce3e5;padding-top:2mm;font-size:7.5pt;color:#69787e}
  </style></head><body>
  <section class="page">${header("Executive summary", 1)}
    <h1>${esc(report.property.address)}</h1>
    <p class="summary">${esc(report.summary)}</p>
    <div class="decision"><div class="score">${esc(report.decision.score ?? "—")}</div><div><div class="recommendation">${esc(report.mainRecommendation)}</div><p style="margin-top:2mm">${esc(humanizeReportValue(report.decision.classification))} · ${esc(report.decision.confidence)} confidence</p><span class="status ${esc(report.warningState)}">${esc(warningLabel)}</span></div></div>
    <div class="facts">
      <div class="fact"><b>Mapped boundary / area</b>Status: ${esc(report.property.boundaryStatus.replaceAll("_", " "))}<br>Confidence: ${esc(report.property.boundaryConfidence)}<br>Area: ${esc(boundaryArea)}${report.property.parcelIdentifier ? `<br>Parcel ${esc(report.property.parcelIdentifier)}` : ""}</div>
      <div class="fact"><b>Selected pool</b>${esc(report.pool.lengthMetres)} m × ${esc(report.pool.widthMetres)} m<br>${esc(report.pool.rotationDegrees)}° rotation</div>
      <div class="fact"><b>Report details</b>${esc(generatedDate)}<br>${esc(report.reference)}</div>
    </div>
    <h2>Scenario results</h2><div class="scenario-grid">${scenarios}</div>
    <h2>Top risks</h2>${topRisks}
    <h2>Main aerial map</h2>${mapPanelHtml("summary")}${mapAttributionHtml}
    ${footer}
  </section>
  <section class="page">${header("Property constraints", 2)}
    <h1>Mapped property evidence</h1>
    <p>Saved mapped geometry and evidence only. Missing or unavailable evidence is not treated as clear.</p>
    ${mapPanelHtml("detail")}${mapAttributionHtml}${excludedMapLayers}
    <h2>Feasibility category status</h2><table class="table"><thead><tr><th>Category</th><th>Status</th><th>Score</th><th>Rationale</th></tr></thead><tbody>${categories}</tbody></table>
    ${footer}
  </section>
  <section class="page">${header("Risks and actions", 3)}
    <h1>What needs attention next</h1>
    <div class="columns"><div><h2>Warnings and material risks</h2>${warnings}${risks}</div><div>
    <h2>Recommendations</h2><ol class="recommendations">${recommendations}</ol>
    <h2>Prioritised actions</h2>${actions || "<p>No additional action was recorded.</p>"}
    <h2>Missing information</h2><ul class="small-list">${missingInformation}</ul></div></div>
    <h2>Official layer status</h2><table class="table"><thead><tr><th>Layer</th><th>Provider</th><th>Status</th><th>Confidence</th></tr></thead><tbody>${layers}</tbody></table>
    <div class="source-note"><b>Data sources</b>${sources}</div>
    <h2>Assumptions</h2><ul class="limits">${report.assumptions.map((assumption) => `<li>${esc(assumption)}</li>`).join("")}</ul>
    <h2>Limitations</h2><ul class="limits">${report.limitations.map((limitation) => `<li>${esc(limitation)}</li>`).join("")}</ul>
    <p style="margin-top:4mm;font-weight:700">This preliminary desktop assessment is not approval, engineering design, a survey, title advice, utility location, or an approved pool position.</p>
    ${footer}
  </section>
  ${sourceAppendix}
  </body></html>`;
}

function chunkSources(
  sources: SavedPreliminaryReport["sources"],
  size: number,
): SavedPreliminaryReport["sources"][] {
  const chunks: SavedPreliminaryReport["sources"][] = [];
  for (let index = 0; index < sources.length; index += size) {
    chunks.push(sources.slice(index, index + size));
  }
  return chunks;
}

function reportSources(
  provenance: PersistedAssessmentSubmission["report"]["reportData"]["provenance"]["datasets"],
  layers: SavedPreliminaryReport["layers"],
): SavedPreliminaryReport["sources"] {
  const sources: SavedPreliminaryReport["sources"] = provenance
    .filter(
      (dataset) =>
        dataset.evidenceUse === "report_allowed" ||
        dataset.evidenceUse === "unavailable",
    )
    .map((dataset) => ({
      provider: dataset.provider,
      dataset: dataset.dataset,
      status: dataset.status,
      evidenceUse: dataset.evidenceUse,
      licence: dataset.licence,
      attribution: dataset.attribution?.text ?? null,
      sourceUrl: dataset.attribution?.url ?? null,
      retrievedAt: dataset.retrievedAt,
    }));
  for (const layer of layers) {
    if (layer.state === "internal_reference_only") continue;
    if (!layer.attribution && !layer.sourceUrl) continue;
    if (
      sources.some(
        (source) =>
          source.provider === layer.provider &&
          source.dataset === layer.dataset,
      )
    ) {
      continue;
    }
    sources.push({
      provider: layer.provider,
      dataset: layer.dataset,
      status: layer.state,
      evidenceUse: "saved_layer",
      licence: "Licence not recorded in this saved layer.",
      attribution: layer.attribution,
      sourceUrl: layer.sourceUrl,
      retrievedAt: null,
    });
  }
  return sources;
}

function formatReportSourceDate(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));
}

function boundaryConfidence(
  status: PersistedAssessmentSubmission["addressEvidence"]["boundaryStatus"],
): SavedPreliminaryReport["property"]["boundaryConfidence"] {
  if (status === "confirmed") return "high";
  if (status === "provisional") return "medium";
  if (status === "multiple") return "low";
  return "unknown";
}
