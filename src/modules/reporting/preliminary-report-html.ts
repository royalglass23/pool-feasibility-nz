import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  assessmentStatusLabel,
  formatReportNumber,
  REPORT_ASSESSMENT_ORDER,
  reportShortStatus,
  type ReportAssessment,
} from "@/modules/reporting/pool-feasibility-report";
import {
  reportMapLegend,
  reportPoolShellClearances,
  type ReportMapLegendEntry,
} from "@/modules/reporting/preliminary-report-presentation";
import {
  POOL_SHELL_CLEARANCE_LIMITATION,
  PRELIMINARY_FEASIBILITY_REPORT_FOOTER,
  PRELIMINARY_FEASIBILITY_REPORT_SCOPE,
} from "@/modules/reporting/preliminary-feasibility-copy";
import { escapeHtml } from "@/shared/html/escape-html";
import { BLUE_HAVEN_REPORT_LOGO } from "@/modules/reporting/report-branding";

export function renderCanonicalPreliminaryReportHtml(
  report: SavedPreliminaryReport,
): string {
  const esc = (value: unknown) => escapeHtml(String(value ?? ""));
  const generatedDate = formatDate(report.generatedAt);
  const poolDimensions = `${formatReportNumber(report.pool.lengthMetres)} x ${formatReportNumber(report.pool.widthMetres)} m`;
  const header = () => `
    <header class="report-header">
      <img class="report-brand-logo" src="${BLUE_HAVEN_REPORT_LOGO}" alt="Blue Haven" width="500" height="266">
      <div class="report-heading"><strong>Preliminary Pool Feasibility Report</strong><h3>${esc(report.property.address)}</h3><div class="page-meta">${esc(generatedDate)}</div></div>
    </header>`;
  const continuationHeader = () => `
    <header class="continuation-header"><span>${esc(generatedDate)}</span><span>Preliminary Feasibility Report</span></header>`;
  const footer = (page: number) => `
    <footer><span>${esc(PRELIMINARY_FEASIBILITY_REPORT_FOOTER)}</span><span>${esc(report.reference)} - ${page}/3</span></footer>`;

  const assessments = REPORT_ASSESSMENT_ORDER.map(
    (id) => report.assessments[id],
  );
  const glance = assessments
    .map(
      (item) => `
        <div class="glance-row">
          <span>${esc(item.title)}</span>
          <strong class="status-text ${esc(item.status)}">${esc(reportShortStatus(item.status))}</strong>
        </div>`,
    )
    .join("");
  const clearances = reportPoolShellClearances(report);
  const { entries: mapLegendEntries } = reportMapLegend(report);
  const clearanceCaption =
    clearances.length === 4
      ? `<section class="map-clearances"><h3>Pool-shell clearances</h3><ul>${clearances.map((clearance, index) => `<li>Side ${index + 1}: ${esc(clearance.label)}</li>`).join("")}</ul><p>${esc(POOL_SHELL_CLEARANCE_LIMITATION)}</p></section>`
      : "";
  const mapLegend = `<aside class="map-legend" aria-label="Captured map layers">
    <h3>Captured map layers</h3>
    <p class="map-legend-intro">This legend records what the saved image shows.</p>
    ${clearanceCaption}
    <ul class="map-legend-list">${mapLegendEntries.map((entry) => renderMapLegendEntry(entry, esc)).join("")}</ul>
  </aside>`;

  const assessmentCards = assessments
    .map((item) => renderAssessment(item, esc))
    .join("");
  const keyFindings = report.keyFindings
    .map(
      (finding) =>
        `<li><strong>${esc(finding.title)}</strong><br>${esc(finding.clientSummary)}</li>`,
    )
    .join("");
  const laterVerification = report.laterVerification
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");
  const nextSteps = report.nextSteps
    .slice(0, 6)
    .map(
      (step, index) => `
        <li><span>${index + 1}</span><div><strong>${esc(step.title)}</strong><p>${esc(step.summary)}</p></div></li>`,
    )
    .join("");
  const providers = unique(
    report.sources.map((source) => source.provider).filter(Boolean),
  );
  const sourceAttributions = unique(
    report.sources
      .map((source) => source.attribution)
      .filter((value): value is string => Boolean(value)),
  );
  const sourceSummary = providers.length
    ? providers.map(esc).join(" - ")
    : "No mapping source summary was recorded";
  const detailedAttribution = sourceAttributions.length
    ? sourceAttributions.map((item) => `<li>${esc(item)}</li>`).join("")
    : `<li>Detailed attribution was not available in the saved report.</li>`;
  const dataAccessed = latestSourceDate(report) ?? generatedDate;

  return `<!doctype html>
<html lang="en-NZ">
<head>
  <meta charset="utf-8">
  <title>${esc(report.title)} - ${esc(report.reference)}</title>
  <style>
    :root{--radius:3px;--report-ink:#062f5d;--report-muted:#426b87;--report-border:#c6dce9;--report-soft:#f3f9fc;--report-blue-soft:#eaf5fc;--report-blue:#006da9}
    *{box-sizing:border-box}
    html,body{margin:0;background:var(--report-soft);color:var(--report-ink);font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{size:A4;margin:0}
    .page{width:210mm;height:297mm;padding:10mm 12mm 9mm;background:#fff;position:relative;break-after:page;break-inside:avoid;page-break-after:always;page-break-inside:avoid;overflow:hidden}
    .page+.page{break-before:page;page-break-before:always}
    .page:last-child{page-break-after:auto}
    .report-header{min-height:19mm;padding-bottom:3mm;border-bottom:.25mm solid var(--report-border);display:flex;gap:8mm;align-items:flex-start;justify-content:space-between;color:var(--report-muted);font-size:8pt}
    .report-brand-logo{display:block;width:25mm;height:auto;max-height:14mm;object-fit:contain;flex-shrink:0}
    .report-heading{text-align:right;min-width:0;overflow-wrap:anywhere}
    .report-header strong{display:block;color:var(--report-muted);font-size:8pt;font-weight:400;line-height:1.45}
    .report-header h3{margin-top:1.2mm;color:var(--report-ink);font-size:11pt}
    .page-meta{margin-top:1mm;text-align:right;font-variant-numeric:tabular-nums;line-height:1.45}
    .continuation-header{display:flex;align-items:center;justify-content:space-between;gap:8mm;padding-bottom:3mm;margin-bottom:4mm;border-bottom:.25mm solid var(--report-border);color:var(--report-muted);font-size:8pt;line-height:1.45}
    .continuation-header span:last-child{text-align:right}
    .page-section-title{font-size:11pt}
    .page-section-title+.assessment-intro{margin-top:1.5mm}
    footer{position:absolute;left:12mm;right:12mm;bottom:5mm;padding-top:2mm;border-top:.25mm solid var(--report-border);display:flex;justify-content:space-between;color:var(--report-muted);font-size:6.8pt}
    h1,h2,h3,p{margin:0}
    h1{font-size:21pt;line-height:1.1;letter-spacing:-.02em}
    h2{font-size:13pt;line-height:1.2}
    h3{font-size:8.4pt;line-height:1.25}
    .primary-section-title{font-size:11pt;line-height:1.25;letter-spacing:0}
    p,li{font-size:7.7pt;line-height:1.38}
    .property-line{margin-top:4.5mm}
    .property-line p{margin-top:1.5mm;color:var(--report-muted);font-size:8.4pt}
    .overall{margin-top:4mm;padding:4mm 4.5mm;border-radius:var(--radius);border:.35mm solid var(--state-border);background:var(--state-soft)}
    .overall.green,.status-text.green,.status-pill.green,.finding-dot.green{--state-border:oklch(89.3% 0.061 235);--state-soft:oklch(97.8% 0.014 235);--state-ink:oklch(40.1% 0.108 235)}
    .overall.amber,.status-text.amber,.status-pill.amber,.finding-dot.amber{--state-border:#fde68a;--state-soft:#fffbeb;--state-ink:#92400e}
    .overall.red,.status-text.red,.status-pill.red,.finding-dot.red{--state-border:#fecaca;--state-soft:#fef2f2;--state-ink:#991b1b}
    .overall.unknown,.status-text.unknown,.status-pill.unknown,.finding-dot.unknown{--state-border:var(--report-border);--state-soft:var(--report-soft);--state-ink:var(--report-muted)}
    .overall .status-label{font-size:7.7pt;font-weight:700;color:var(--state-ink)}
    .overall p{margin-top:1.7mm;max-width:155mm;font-size:8.7pt;line-height:1.4}
    .section-heading{margin:4mm 0 2mm;display:flex;align-items:baseline;justify-content:space-between}
    .section-heading span{font-size:7pt;color:var(--report-muted)}
    .glance-grid{display:grid;grid-template-columns:1fr 1fr;border:.25mm solid var(--report-border);border-radius:var(--radius);overflow:hidden}
    .glance-row{min-height:9mm;padding:2.1mm 3mm;display:flex;align-items:center;justify-content:space-between;gap:3mm;border-bottom:.25mm solid var(--report-border)}
    .glance-row:nth-child(odd){border-right:.25mm solid var(--report-border)}
    .glance-row:nth-last-child(-n+2){border-bottom:0}
    .glance-row>span{font-size:7.5pt;font-weight:700}
    .status-text{font-size:6.8pt;color:var(--state-ink);text-align:right}
    .map-panel{height:104mm;margin:3.2mm 0 0;border:.25mm solid var(--report-border);border-radius:var(--radius);overflow:hidden;background:#edf2f4}
    .map-layout{display:grid;grid-template-columns:minmax(0,1fr) 45mm;height:95mm;align-items:stretch;background:#dce5e9}
    .map-visual{display:flex;min-width:0;height:95mm;min-height:0;background:#dce5e9}
    .map{display:block;width:100%;height:100%;min-height:0;flex:1 1 auto;object-fit:cover;background:#dce5e9}
    .map-caption{padding:1.8mm 2.8mm;background:var(--report-soft);border-top:.25mm solid var(--report-border);color:var(--report-muted);font-size:6.2pt;line-height:1.35}
    .map-legend{padding:2.5mm;background:#fff;border-left:.25mm solid var(--report-border);color:var(--report-ink);overflow:hidden}
    .map-legend h3,.map-clearances h3{font-size:7.2pt;line-height:1.2}
    .map-legend-intro{margin-top:.8mm;color:var(--report-muted);font-size:5.4pt;line-height:1.3}
    .map-legend-list{margin:1.4mm 0 0;padding:0;list-style:none}
    .map-legend-item{display:flex;gap:1.2mm;padding:.9mm 0;border-top:.2mm solid var(--report-border)}
    .map-legend-item:first-child{border-top:0;padding-top:0}
    .map-legend-swatch{width:5mm;flex:0 0 5mm;margin-top:1.2mm;border-top:.6mm solid var(--report-ink)}
    .map-legend-swatch.area{height:2.6mm;margin-top:.65mm;border:.4mm solid var(--report-ink);background:#fff}
    .map-legend-copy{min-width:0;font-size:5.5pt;line-height:1.2}
    .map-legend-copy strong{display:block;font-size:6pt}
    .map-legend-copy span{display:block;margin-top:.2mm;color:var(--report-muted)}
    .map-clearances{margin-top:1.5mm;padding-top:1.5mm;border-top:.25mm solid var(--report-border);color:var(--report-muted)}
    .map-clearances ul{display:grid;grid-template-columns:1fr 1fr;gap:.6mm 1mm;margin:1mm 0 0;padding:0;list-style:none;font-size:5.5pt;font-weight:700;line-height:1.2}
    .map-clearances p{margin-top:.8mm;color:var(--report-muted);font-size:5pt;line-height:1.25}
    .assessment-intro{margin-top:4.5mm;max-width:150mm;color:var(--report-muted)}
    .assessment-grid{margin-top:3mm;display:grid;grid-template-columns:1fr 1fr;gap:2mm}
    .assessment-card{break-inside:avoid;min-height:29mm;padding:2.5mm;border:.25mm solid var(--report-border);border-radius:var(--radius)}
    .assessment-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:3mm}
    .assessment-card h2,.later h2,.plain-section h2,.disclaimer h2{font-size:11pt;line-height:1.25}
    .status-pill{max-width:43mm;padding:1mm 1.6mm;border-radius:var(--radius);background:var(--state-soft);color:var(--state-ink);font-size:6.2pt;font-weight:700;text-align:center}
    .assessment-card>p{margin-top:1.5mm;color:var(--report-muted)}
    .detail-list{margin:1.5mm 0 0;padding:0;list-style:none}
    .detail-list li{display:flex;justify-content:space-between;gap:3mm;padding-top:1mm;border-top:.2mm solid var(--report-border);font-size:6.8pt}
    .detail-list strong{text-align:right}
    .later{margin-top:2mm;padding:2.5mm 3mm;background:var(--report-soft);border-radius:var(--radius)}
    .later ul{columns:2;column-gap:8mm;margin:1.5mm 0 0;padding-left:4mm}
    .later li{break-inside:avoid;margin-bottom:.7mm;font-size:6.8pt}
    .next-stage{margin-top:4.5mm;padding:3.5mm 4mm;background:var(--report-ink);color:#fff;border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;gap:8mm}
    .next-stage span{font-size:7pt;color:#cbd6db}
    .next-stage strong{font-size:11pt}
    .steps{margin:3mm 0 0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:2.4mm 4mm}
    .steps li{display:flex;gap:2.5mm;break-inside:avoid}
    .steps li>span{display:grid;place-items:center;width:6mm;height:6mm;border-radius:50%;background:var(--report-blue-soft);color:var(--report-blue);font-size:7pt;font-weight:700;flex:0 0 auto}
    .steps p{margin-top:.7mm;color:var(--report-muted);font-size:7pt}
    .page-three-grid{margin-top:4mm;display:grid;grid-template-columns:1fr 1fr;gap:5mm}
    .plain-section{border-top:.4mm solid var(--report-ink);padding-top:2.5mm}
    .plain-section ul{margin:2mm 0 0;padding-left:4mm}
    .plain-section li{margin-bottom:1mm;font-size:7pt}
    .mapping-summary{margin-top:2mm;color:var(--report-muted)}
    .disclaimer{margin-top:4mm;padding:3.5mm;background:var(--report-soft);border-radius:var(--radius);color:var(--report-muted)}
    .disclaimer p{margin-top:1.5mm;font-size:7pt}
  </style>
</head>
<body>
  <section class="page">
    ${header()}
    <div class="property-line">
      <p>Proposed pool: ${esc(poolDimensions)}</p>
    </div>
    <section class="overall ${esc(report.overall.status)}" aria-label="Overall assessment">
      <div class="status-label">${esc(assessmentStatusLabel(report.overall.status))}</div>
      <p>${esc(report.overall.summary)}</p>
    </section>
    <p class="assessment-intro"><strong>Preliminary feasibility only.</strong> ${esc(PRELIMINARY_FEASIBILITY_REPORT_SCOPE)}</p>
    <div class="section-heading"><h2 class="primary-section-title">At a glance</h2><span>Status is shown by colour and description</span></div>
    <div class="glance-grid">${glance}</div>
    <figure class="map-panel">
      <div class="map-layout">
        <div class="map-visual"><img class="map" src="${report.mapImageDataUrl}" alt="Aerial map showing the mapped property and proposed pool"></div>
        ${mapLegend}
      </div>
      <figcaption class="map-caption">Saved aerial map and layer selection used when this report was generated.</figcaption>
    </figure>
    ${footer(1)}
  </section>

  <section class="page">
    ${continuationHeader()}
    <h2 class="page-section-title">What we checked</h2>
    <p class="assessment-intro">These findings use the mapped information saved with this report. Distances and boundaries are indicative, not surveyed.</p>
    <div class="assessment-grid">${assessmentCards}</div>
    ${keyFindings ? `<section class="later"><h2>Key findings</h2><ul>${keyFindings}</ul></section>` : ""}
    <section class="later">
      <h2>Requires later verification</h2>
      <ul>${laterVerification}</ul>
    </section>
    ${footer(2)}
  </section>

  <section class="page">
    ${continuationHeader()}
    <h2 class="page-section-title">What happens next</h2>
    <section class="next-stage"><span>Recommended next stage</span><strong>${esc(report.overall.recommendedStage)}</strong></section>
    <ol class="steps">${nextSteps}</ol>
    <div class="page-three-grid">
      <section class="plain-section">
        <h2>Not verified by this report</h2>
        <ul>${laterVerification}</ul>
      </section>
      <section class="plain-section">
        <h2>Mapping information</h2>
        <p class="mapping-summary">Sources include ${sourceSummary}.</p>
        <p class="mapping-summary">Data accessed: <strong>${esc(dataAccessed)}</strong></p>
        <ul>${detailedAttribution}</ul>
        <p class="mapping-summary">Selected datasets are used under their applicable licences. Mapped information is indicative.</p>
      </section>
    </div>
    <section class="disclaimer">
      <h2>Preliminary assessment</h2>
      <p>This report uses publicly available mapped information for preliminary planning purposes. Property boundaries, infrastructure locations, terrain and other mapped information are indicative and may differ from actual site conditions.</p>
      <p>This report does not constitute surveying, engineering, geotechnical advice, utility locating, building consent, resource consent or approval to undertake construction. Relevant conditions and infrastructure should be independently verified before final design, excavation or construction.</p>
    </section>
    ${footer(3)}
  </section>
</body>
</html>`;
}

function renderMapLegendEntry(
  entry: ReportMapLegendEntry,
  esc: (value: unknown) => string,
): string {
  const status = entry.statusLabel
    ? `<span>${esc(entry.statusLabel)}</span>`
    : "";
  const swatchClass = entry.kind === "area" ? "area" : "line";
  const swatchStyle =
    entry.kind === "area"
      ? `border-color:${esc(entry.colour)};background:${esc(entry.colour)}22`
      : `border-top-color:${esc(entry.colour)};border-top-style:${entry.dashed ? "dashed" : "solid"}`;
  return `<li class="map-legend-item"><span class="map-legend-swatch ${swatchClass}" style="${swatchStyle}" aria-hidden="true"></span><span class="map-legend-copy"><strong>${esc(entry.label)}</strong>${status}</span></li>`;
}

function renderAssessment(
  item: ReportAssessment,
  esc: (value: unknown) => string,
): string {
  const details = item.details
    .map(
      (detail) =>
        `<li><span>${esc(detail.label)}</span><strong>${esc(detail.value)}</strong></li>`,
    )
    .join("");
  return `<article class="assessment-card">
    <header><h2>${esc(item.title)}</h2><span class="status-pill ${esc(item.status)}">${esc(reportShortStatus(item.status))}</span></header>
    <p>${esc(item.summary)}</p>
    ${details ? `<ul class="detail-list">${details}</ul>` : ""}
  </article>`;
}

function latestSourceDate(report: SavedPreliminaryReport): string | null {
  const timestamps = report.sources
    .map((source) => source.retrievedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return formatDate(new Date(Math.max(...timestamps)).toISOString());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export const canonicalReportConsistencyFields = (
  report: SavedPreliminaryReport,
) => ({
  reference: report.reference,
  address: report.property.address,
  poolDimensions: `${formatReportNumber(report.pool.lengthMetres)} x ${formatReportNumber(report.pool.widthMetres)} m`,
  overallStatus: assessmentStatusLabel(report.overall.status),
  overallSummary: report.overall.summary,
  keyFinding: report.keyFindings[0]?.title ?? null,
  recommendedStage: report.overall.recommendedStage,
  generatedDate: formatDate(report.generatedAt),
});
