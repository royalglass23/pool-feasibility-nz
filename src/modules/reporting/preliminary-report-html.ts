import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  assessmentStatusLabel,
  formatReportNumber,
  reportShortStatus,
  type ReportAssessment,
  type ReportDataSource,
} from "@/modules/reporting/pool-feasibility-report";
import {
  formatReportGeneratedAt,
  reportConstructabilitySections,
  reportMapLegend,
  reportPoolShellClearances,
  type ReportConstructabilitySection,
  type ReportMapLegendEntry,
} from "@/modules/reporting/preliminary-report-presentation";
import {
  POOL_SHELL_CLEARANCE_LIMITATION,
  PRELIMINARY_FEASIBILITY_REPORT_FOOTER,
} from "@/modules/reporting/preliminary-feasibility-copy";
import { escapeHtml } from "@/shared/html/escape-html";
import { reportAudiencePresentation } from "@/modules/reporting/report-audience-presentation";

export function renderCanonicalPreliminaryReportHtml(
  report: SavedPreliminaryReport,
): string {
  const esc = (value: unknown) => escapeHtml(String(value ?? ""));
  const generatedDate = formatReportGeneratedAt(report.generatedAt);
  const audiencePresentation = reportAudiencePresentation(
    report.reportAudience,
  );
  const poolDimensions = `${formatReportNumber(report.pool.lengthMetres)} x ${formatReportNumber(report.pool.widthMetres)} m`;
  const header = () => `
    <header class="report-header">
      <div class="report-brand"><strong>PoolReady</strong><span>Powered by Blue Haven</span></div>
      <div class="report-heading"><strong>Preliminary Feasibility Report</strong><h3>${esc(report.property.address)}</h3><div class="page-meta">${esc(generatedDate)}</div></div>
    </header>`;
  const continuationHeader = () => `
    <header class="continuation-header"><span>${esc(generatedDate)}</span><span>Preliminary Feasibility Report</span></header>`;
  const footer = (page: number) => `
    <footer><span>${esc(PRELIMINARY_FEASIBILITY_REPORT_FOOTER)}</span><span>${esc(report.reference)} - ${page}/3</span></footer>`;
  const assessments = audiencePresentation.assessmentIds.map(
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
  const assessmentCards = assessments
    .filter((item) => item.status !== "unknown")
    .map((item) => renderAssessment(item, esc))
    .join("");
  const needsChecking = assessments
    .filter((item) => item.status === "unknown")
    .map((item) => `<li><strong>${esc(item.title)}</strong></li>`)
    .join("");
  const constructabilitySections =
    audiencePresentation.showTechnicalConstructability
      ? reportConstructabilitySections(report)
          .map((section) => renderConstructabilitySection(section, esc))
          .join("")
      : "";
  const keyFindings = report.keyFindings
    .map((finding) => `<li><strong>${esc(finding.title)}</strong></li>`)
    .join("");
  const clearances = audiencePresentation.showTechnicalConstructability
    ? reportPoolShellClearances(report)
    : [];
  const { entries: allMapLegendEntries } = reportMapLegend(report);
  const mapLegendEntries = audiencePresentation.showTechnicalConstructability
    ? allMapLegendEntries
    : allMapLegendEntries.filter(
        (entry) => entry.id !== "suggested-access-route",
      );
  const clearanceCaption =
    clearances.length === 4
      ? `<section class="map-clearances"><h3>Pool-shell clearances</h3><ul>${clearances.map((clearance, index) => `<li>Side ${index + 1}: ${esc(clearance.label)}</li>`).join("")}</ul><p>${esc(POOL_SHELL_CLEARANCE_LIMITATION)}</p></section>`
      : "";
  const mapLegend = `<aside class="map-legend" aria-label="Captured map layers">
    <div class="map-legend-heading"><h3>Captured map layers</h3><p class="map-legend-intro">The saved image shows these mapped layers${audiencePresentation.showTechnicalConstructability ? " and clearances" : ""}.</p></div>
    ${clearanceCaption}
    <ul class="map-legend-list">${mapLegendEntries.map((entry) => renderMapLegendEntry(entry, esc)).join("")}</ul>
  </aside>`;
  const assumptionsAndLimitations = [
    ...report.assumptions,
    ...report.limitations,
  ]
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");
  const mappingSources = reportMappingSources(report);
  const providers = unique(
    mappingSources.map((source) =>
      source.provider === "Land Information New Zealand"
        ? "LINZ"
        : source.provider,
    ),
  );
  const visibleProviders = providers.slice(0, 4);
  const omittedProviderCount = providers.length - visibleProviders.length;
  const sourceSummary = providers.length
    ? `Sources include ${visibleProviders.map(esc).join(" - ")}${omittedProviderCount > 0 ? ` and ${omittedProviderCount} more ${omittedProviderCount === 1 ? "provider" : "providers"}` : ""}.`
    : "No mapping source summary was recorded.";
  const detailedAttribution = mappingSources.length
    ? renderMappingCredits(mappingSources, esc)
    : `<li>Detailed mapping information was not available in the saved report.</li>`;
  const dataAccessed = latestSourceDate(report) ?? generatedDate;
  const builderConfirmationItems = audiencePresentation.builderConfirmationItems
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");
  const homeownerGuidance = audiencePresentation.onsiteNextStep
    ? `<div class="homeowner-guidance">
      <section class="plain-section builder-confirmation"><h2>${esc(audiencePresentation.builderConfirmationHeading)}</h2><ul>${builderConfirmationItems}</ul></section>
      <section class="plain-section onsite-next-step"><h2>${esc(audiencePresentation.nextStepHeading)}</h2><h3>${esc(audiencePresentation.onsiteNextStep.action)}</h3><p>${esc(audiencePresentation.onsiteNextStep.explanation)}</p></section>
    </div>`
    : "";

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
    .page{width:210mm;height:297mm;padding:9mm 10mm 8mm;background:#fff;position:relative;break-after:page;break-inside:avoid;page-break-after:always;page-break-inside:avoid;overflow:hidden}
    .page+.page{break-before:page;page-break-before:always}
    .page:last-child{page-break-after:auto}
    .report-header{min-height:19mm;padding-bottom:3mm;border-bottom:.25mm solid var(--report-border);display:flex;gap:8mm;align-items:flex-start;justify-content:space-between;color:var(--report-muted);font-size:8pt}
    .report-brand{display:flex;flex-direction:column;gap:.8mm;flex-shrink:0;color:var(--report-ink)}
    .report-brand strong{font-size:18pt;line-height:1;font-weight:800;letter-spacing:-.035em}
    .report-brand span{color:var(--report-muted);font-size:8pt;font-weight:600}
    .report-heading{text-align:right;min-width:0;overflow-wrap:anywhere}
    .report-heading>strong{display:block;color:var(--report-muted);font-size:8pt;font-weight:400;line-height:1.3}
    .report-header h3{margin-top:1.2mm;color:var(--report-ink);font-size:12pt}
    .page-meta{margin-top:1mm;text-align:right;font-variant-numeric:tabular-nums;line-height:1.45}
    .continuation-header{display:flex;align-items:center;justify-content:space-between;gap:8mm;padding-bottom:3mm;margin-bottom:4mm;border-bottom:.25mm solid var(--report-border);color:var(--report-muted);font-size:8pt;line-height:1.3}
    .continuation-header span:last-child{text-align:right}
    .page-section-title{font-size:12pt}
    .page-section-title+.assessment-intro{margin-top:1.5mm}
    footer{position:absolute;left:10mm;right:10mm;bottom:4mm;padding-top:2mm;border-top:.25mm solid var(--report-border);display:flex;justify-content:space-between;color:var(--report-muted);font-size:8pt}
    h1,h2,h3,p{margin:0}
    h1{font-size:21pt;line-height:1.1;letter-spacing:-.02em}
    h2{font-size:12pt;line-height:1.2}
    h3{font-size:10pt;line-height:1.25}
    .primary-section-title{font-size:12pt;line-height:1.25;letter-spacing:0}
    p,li{font-size:8pt;line-height:1.3}
    .property-line{margin-top:4.5mm}
    .property-line p{margin-top:1.5mm;color:var(--report-muted);font-size:8pt}
    .overall{margin-top:4mm;padding:2.6mm 0;border-top:.25mm solid var(--report-border);border-bottom:.25mm solid var(--report-border)}
    .overall.green,.status-text.green,.status-pill.green,.finding-dot.green{--state-border:oklch(89.3% 0.061 235);--state-soft:oklch(97.8% 0.014 235);--state-ink:oklch(40.1% 0.108 235)}
    .overall.amber,.status-text.amber,.status-pill.amber,.finding-dot.amber{--state-border:#fde68a;--state-soft:#fffbeb;--state-ink:#92400e}
    .overall.red,.status-text.red,.status-pill.red,.finding-dot.red{--state-border:#fecaca;--state-soft:#fef2f2;--state-ink:#991b1b}
    .overall.unknown,.status-text.unknown,.status-pill.unknown,.finding-dot.unknown{--state-border:var(--report-border);--state-soft:var(--report-soft);--state-ink:var(--report-muted)}
    .overall .status-label{font-size:8pt;font-weight:700;color:var(--state-ink)}
    .overall p{margin-top:1.2mm;width:100%;font-size:8pt;line-height:1.3}
    .scope-note{margin-top:2mm;color:var(--report-muted);font-size:8pt;line-height:1.3}
    .summary-map{height:124mm;margin:3mm 0 0;border:.25mm solid var(--report-border);border-radius:var(--radius);overflow:hidden;background:#edf2f4}
    .summary-map .map-layout{height:116mm}
    .summary-map .map-visual{height:80mm}
    .summary-map .map{height:100%}
    .section-heading{margin:4mm 0 2mm;display:flex;align-items:baseline;justify-content:space-between}
    .section-heading span{font-size:8pt;color:var(--report-muted)}
    .glance-grid{display:grid;grid-template-columns:1fr 1fr;border:.25mm solid var(--report-border);border-radius:var(--radius);overflow:hidden}
    .glance-row{min-height:10mm;padding:2mm 3mm;display:flex;align-items:center;justify-content:space-between;gap:3mm;border-bottom:.25mm solid var(--report-border)}
    .glance-row:nth-child(odd){border-right:.25mm solid var(--report-border)}
    .glance-row:nth-last-child(-n+2){border-bottom:0}
    .glance-row>span{font-size:8pt;font-weight:700}
    .status-text{font-size:8pt;color:var(--state-ink);text-align:right}
    .map-layout{display:block;height:116mm;background:#dce5e9}
    .map-visual{display:flex;min-width:0;height:80mm;min-height:0;background:#dce5e9}
    .map{display:block;width:100%;height:100%;min-height:0;flex:1 1 auto;object-fit:cover;background:#dce5e9}
    .map-caption{padding:1.4mm 2.8mm;background:var(--report-soft);border-top:.25mm solid var(--report-border);color:var(--report-muted);font-size:8pt;line-height:1.25}
    .map-legend{height:36mm;padding:2mm 2.8mm;background:#fff;border-top:.25mm solid var(--report-border);color:var(--report-ink);overflow:hidden;display:grid;grid-template-columns:36mm 45mm minmax(0,1fr);gap:3mm}
    .map-legend h3,.map-clearances h3{font-size:8pt;line-height:1.2}
    .map-legend-intro{margin-top:.8mm;color:var(--report-muted);font-size:8pt;line-height:1.25}
    .map-legend-list{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:2.5mm;align-content:start}
    .map-legend-item{display:flex;gap:1.2mm;padding:.7mm 0;border-top:.2mm solid var(--report-border);min-width:0}
    .map-legend-item:nth-child(-n+3){border-top:0;padding-top:0}
    .map-legend-swatch{width:5mm;flex:0 0 5mm;margin-top:1.2mm;border-top:.6mm solid var(--report-ink)}
    .map-legend-swatch.area{height:2.6mm;margin-top:.65mm;border:.4mm solid var(--report-ink);background:#fff}
    .map-legend-copy{min-width:0;font-size:8pt;line-height:1.15}
    .map-legend-copy strong{display:block;font-size:8pt}
    .map-legend-copy span{display:block;margin-top:.2mm;color:var(--report-muted)}
    .map-clearances{margin:0;padding:0;color:var(--report-muted)}
    .map-clearances ul{display:grid;grid-template-columns:1fr 1fr;gap:.6mm 1mm;margin:1mm 0 0;padding:0;list-style:none;font-size:8pt;font-weight:700;line-height:1.2}
    .map-clearances p{margin-top:.8mm;color:var(--report-muted);font-size:8pt;line-height:1.2}
    .assessment-intro{margin-top:4.5mm;max-width:150mm;color:var(--report-muted)}
    .assessment-grid{margin-top:2mm;display:grid;grid-template-columns:1fr 1fr;gap:1.5mm;align-items:start}
    .assessment-card{break-inside:avoid;padding:1.8mm 2mm;border:.25mm solid var(--report-border);border-radius:var(--radius)}
    .assessment-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:3mm}
    .assessment-card h2{font-size:12pt;line-height:1.25}
    .later h2,.plain-section h2,.disclaimer h2{font-size:12pt;line-height:1.25}
    .status-pill{max-width:50mm;color:var(--state-ink);font-size:8pt;font-weight:700;text-align:right}
    .assessment-card>p{margin-top:1.5mm;color:var(--report-muted)}
    .detail-list{margin:1.5mm 0 0;padding:0;list-style:none}
    .detail-list li{display:flex;justify-content:space-between;gap:3mm;padding-top:1mm;border-top:.2mm solid var(--report-border);font-size:8pt}
    .detail-list strong{text-align:right}
    .constructability{margin-top:1.8mm}
    .constructability>h2{font-size:12pt}
    .constructability-grid{margin-top:1.2mm;display:grid;grid-template-columns:1fr 1fr;gap:1.2mm;align-items:start}
    .constructability-card{--card-heading-size:12pt;--card-body-size:8pt;break-inside:avoid;padding:1.6mm;border:.25mm solid var(--report-border);border-radius:var(--radius)}
    .constructability-card.access_excavation{grid-column:1/-1}
    .constructability-card.needs_checking{--state-ink:#92400e}
    .constructability-card.not_fully_assessed{--state-ink:var(--report-muted)}
    .constructability-card.no_obvious_concern{--state-ink:oklch(40.1% 0.108 235)}
    .constructability-card h3,.constructability-card h4{font-size:var(--card-heading-size);line-height:1.2}
    .constructability-status{margin-top:.5mm;color:var(--state-ink);font-size:var(--card-body-size);font-weight:700;line-height:1.15}
    .constructability-summary,.constructability-boundary,.constructability-note{margin-top:.5mm;color:var(--report-muted);font-size:var(--card-body-size);line-height:1.15}
    .constructability-details,.constructability-evidence,.excavation-scenarios{margin:.6mm 0 0;padding:0;list-style:none}
    .constructability-details li,.constructability-evidence li,.excavation-scenarios li{margin-top:.35mm;font-size:var(--card-body-size);line-height:1.15;break-inside:avoid}
    .constructability-evidence strong{color:var(--report-ink)}
    .constructability-note{padding:.6mm;background:var(--report-soft)}
    .access-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:2.5mm;align-items:start}
    .access-layout>div{columns:2;column-gap:2.5mm;column-fill:balance}
    .excavation{margin-top:.6mm;padding-top:.6mm;border-top:.2mm solid var(--report-border)}
    .excavation p{margin-top:.4mm;color:var(--report-muted);font-size:var(--card-body-size);line-height:1.15}
    .excavation a{color:var(--report-blue)}
    .needs-checking{margin-top:1mm;padding:1mm 1.5mm;background:var(--report-soft);border-radius:var(--radius)}
    .needs-checking h2{font-size:12pt}
    .needs-checking ul{margin:.5mm 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4mm 3mm}
    .needs-checking li{display:block;font-size:8pt;line-height:1.15}
    .needs-checking li strong{flex:0 0 auto}
    .needs-checking li span{color:var(--report-muted)}
    .later{margin-top:1mm;padding:1mm 1.5mm;background:var(--report-soft);border-radius:var(--radius)}
    .later ul{columns:2;column-gap:8mm;margin:1.5mm 0 0;padding-left:4mm}
    .later li{break-inside:avoid;margin-bottom:.4mm;font-size:8pt;line-height:1.15}
    .page-two-bottom{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:1.5mm;align-items:start}
    .recommended-stage{margin-top:3mm;padding:4mm 5mm;background:var(--report-ink);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:5mm}
    .recommended-stage h2{font-size:12pt}
    .recommended-stage strong{font-size:12pt;text-align:right}
    .page-three-grid{margin-top:5mm;display:grid;grid-template-columns:100mm minmax(0,1fr);gap:5mm;align-items:start}
    .plain-section{border-top:.4mm solid var(--report-ink);padding-top:2.5mm}
    .plain-section ul{margin:2mm 0 0;padding-left:4mm}
    .plain-section li{margin-bottom:1mm;font-size:8pt}
    .mapping-summary{margin-top:2mm;color:var(--report-muted)}
    .source-list{margin:1.5mm 0 0;padding-left:4mm}
    .source-item{margin-bottom:.8mm;font-size:8pt;line-height:1.3;overflow-wrap:anywhere}
    .source-item a{color:var(--report-blue)}
    .disclaimer{margin-top:4mm;padding:3.5mm;background:var(--report-soft);border-radius:var(--radius);color:var(--report-muted)}
    .disclaimer p{margin-top:1.5mm;font-size:8pt}
    .homeowner-guidance{margin-top:5mm;display:grid;grid-template-columns:1fr 1fr;gap:5mm;align-items:start}
    .homeowner-guidance h3{margin-top:2mm;font-size:10pt}
    .homeowner-guidance p{margin-top:1.5mm;color:var(--report-muted)}
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
      <p><strong>Main recommendation:</strong> ${esc(report.mainRecommendation)}</p>
      <p><strong>Recommended next stage:</strong> ${esc(report.overall.recommendedStage)}</p>
    </section>
    <p class="scope-note"><strong>Preliminary assessment only.</strong> Confirm property boundaries, services, site levels and approval requirements before design or construction.</p>
    <div class="section-heading"><h2 class="primary-section-title">At a glance</h2><span>Status is shown by colour and description</span></div>
    <div class="glance-grid">${glance}</div>
    <figure class="summary-map">
      <div class="map-layout">
        <div class="map-visual"><img class="map" src="${report.mapImageDataUrl}" alt="Aerial overview showing the mapped property and proposed pool"></div>
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
    ${assessmentCards ? `<div class="assessment-grid">${assessmentCards}</div>` : ""}
    ${constructabilitySections ? `<section class="constructability"><h2>Site constructability</h2><div class="constructability-grid">${constructabilitySections}</div></section>` : ""}
    ${needsChecking || keyFindings ? `<div class="page-two-bottom">${needsChecking ? `<section class="needs-checking"><h2>Still needs checking</h2><ul>${needsChecking}</ul></section>` : ""}${keyFindings ? `<section class="later"><h2>Key findings</h2><ul>${keyFindings}</ul></section>` : ""}</div>` : ""}
    ${footer(2)}
  </section>

  <section class="page">
    ${continuationHeader()}
    <section class="recommended-stage"><h2>Recommended next stage</h2><strong>${esc(report.overall.recommendedStage)}</strong></section>
    ${
      audiencePresentation.showDetailedSources
        ? `<div class="page-three-grid">
      <section class="plain-section">
        <h2>Mapping information &amp; licences</h2>
        <p class="mapping-summary">${sourceSummary}</p>
        <p class="mapping-summary">Data accessed: <strong>${esc(dataAccessed)}</strong></p>
        <ul class="source-list">${detailedAttribution}</ul>
        <p class="mapping-summary">Mapped information is indicative and may differ from current site conditions.</p>
      </section>
      <section class="plain-section"><h2>Assumptions and limitations</h2><ul>${assumptionsAndLimitations}</ul></section>
    </div>`
        : homeownerGuidance
    }
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
    <p><strong>${esc(item.headline)}</strong> ${esc(item.summary)}</p>
    ${details ? `<ul class="detail-list">${details}</ul>` : ""}
  </article>`;
}

function renderConstructabilitySection(
  section: ReportConstructabilitySection,
  esc: (value: unknown) => string,
): string {
  if (section.id === "access_excavation") {
    return renderAccessAndExcavationSection(section, esc);
  }

  const details = section.details
    .map(
      (detail) =>
        `<li><strong>${esc(detail.label)}:</strong> ${esc(detail.value)}</li>`,
    )
    .join("");
  const evidence = section.evidence
    .map(
      (item) =>
        `<li><strong>${esc(item.provenance)}:</strong> ${esc(item.description)}</li>`,
    )
    .join("");
  const excavation = section.excavation
    ? `<section class="excavation"><h4>${esc(section.excavation.heading)}</h4><ul class="excavation-scenarios">${section.excavation.scenarios.map((scenario) => `<li><strong>${esc(scenario.label)}:</strong> ${esc(scenario.formattedValue)}</li>`).join("")}</ul><p>${esc(section.excavation.rangeDisclosure)}</p><p>${esc(section.excavation.exclusions)}</p><p>${esc(section.excavation.terrainLabel)}</p>${section.excavation.specialistDepthWarning ? `<p><strong>${esc(section.excavation.specialistDepthWarning)}</strong></p>` : ""}<p>Assumption ${esc(section.excavation.assumptionId)}. <a href="${esc(section.excavation.sourceUrl)}">Firth masonry guidance</a>. ${esc(section.excavation.assumptionDisclosure)}</p></section>`
    : "";
  return `<article class="constructability-card ${esc(section.id)} ${esc(section.status)}"><h3>${esc(section.title)}</h3><p class="constructability-status">${esc(section.statusLabel)}</p><p class="constructability-summary">${esc(section.summary)}</p>${details ? `<ul class="constructability-details">${details}</ul>` : ""}${evidence ? `<ul class="constructability-evidence">${evidence}</ul>` : ""}${section.provenanceNote ? `<p class="constructability-note">${esc(section.provenanceNote)}</p>` : ""}${excavation}<p class="constructability-boundary">${esc(section.boundary)}</p></article>`;
}

function renderAccessAndExcavationSection(
  section: ReportConstructabilitySection,
  esc: (value: unknown) => string,
): string {
  const details = section.details
    .filter((detail) =>
      [
        "Estimated pool depth",
        "Saved route",
        "Route length",
        "Steepest route gradient",
      ].includes(detail.label),
    )
    .map(
      (detail) =>
        `<li><strong>${esc(detail.label)}:</strong> ${esc(detail.value)}</li>`,
    )
    .join("");
  const evidenceByProvenance = new Map<string, string[]>();
  for (const item of section.evidence) {
    if (item.provenance === "Saved assumption") continue;
    const descriptions = evidenceByProvenance.get(item.provenance) ?? [];
    descriptions.push(item.description);
    evidenceByProvenance.set(item.provenance, descriptions);
  }
  const evidence = Array.from(evidenceByProvenance)
    .map(
      ([provenance, descriptions]) =>
        `<li><strong>${esc(provenance)}:</strong> ${esc(descriptions.join("; "))}</li>`,
    )
    .join("");
  const excavation = section.excavation
    ? `<section class="excavation" data-assumption-id="${esc(section.excavation.assumptionId)}" data-source-url="${esc(section.excavation.sourceUrl)}"><h4>Indicative excavation</h4><ul class="excavation-scenarios">${section.excavation.scenarios.map((scenario) => `<li><strong>${esc(scenario.label)}:</strong> ${esc(scenario.formattedValue)}</li>`).join("")}</ul><p>${esc(section.excavation.clearanceDisclosure)}</p><p>${esc(section.excavation.terrainLabel)}.</p><p>This planning estimate does not include extra depth, footings, drainage, slopes or site support.</p></section>`
    : "";

  return `<article class="constructability-card access_excavation ${esc(section.status)}"><h3>${esc(section.title)}</h3><p class="constructability-status">${esc(section.statusLabel)}</p><p class="constructability-summary">${esc(section.summary)}</p><div class="access-layout"><div>${details ? `<ul class="constructability-details">${details}</ul>` : ""}${evidence ? `<ul class="constructability-evidence">${evidence}</ul>` : ""}${section.provenanceNote ? `<p class="constructability-note">${esc(section.provenanceNote)}</p>` : ""}</div>${excavation}</div><p class="constructability-boundary">Confirm access, excavation and ground conditions onsite before construction.</p></article>`;
}

function reportMappingSources(
  report: SavedPreliminaryReport,
): ReportDataSource[] {
  const sources = [...report.sources];
  if (
    report.terrain?.status === "measured" &&
    report.terrain.reportEligibility === "approved"
  ) {
    const source = report.terrain.source;
    const terrainSource: ReportDataSource = {
      provider: source.provider,
      dataset: source.dataset,
      datasetDate: source.datasetDate,
      sourceUrl: source.datasetIdentifier,
      licenceUrl: source.licenceUrl,
      licence: source.licence,
      attribution: source.attribution?.text ?? null,
      notes: [source.derivedProductNotice],
      provenanceAssets: source.contributingAssets.map((asset) => ({
        dataset: asset.dataset,
        datasetDate: asset.datasetDate,
        stacItemUrl: asset.stacItemUrl,
        assetChecksum: asset.assetChecksum,
        assetUpdatedAt: asset.assetUpdatedAt,
        retrievedAt: asset.retrievedAt,
      })),
      retrievedAt: source.retrievedAt,
      queryStatus: "success",
      status: "derived_indicative_slope",
      evidenceUse: "saved_terrain_result",
    };
    const existingIndex = sources.findIndex(
      (item) =>
        item.provider === source.provider && item.dataset === source.dataset,
    );
    if (existingIndex >= 0) {
      sources[existingIndex] = { ...sources[existingIndex], ...terrainSource };
    } else {
      sources.unshift(terrainSource);
    }
  }
  return sources;
}

function renderMappingCredits(
  sources: ReportDataSource[],
  esc: (value: unknown) => string,
): string {
  const credits = new Map<string, ReportDataSource[]>();
  for (const source of sources) {
    const credit =
      source.attribution?.trim() || `${source.provider}, ${source.licence}`;
    const group = credits.get(credit) ?? [];
    group.push(source);
    credits.set(credit, group);
  }
  return [...credits.entries()]
    .map(([credit, group]) => {
      const licences = unique(group.map((source) => source.licence));
      const variableLicence = licences.length > 1;
      const licenceUrl = group.find((source) => source.licenceUrl)?.licenceUrl;
      const licence =
        !variableLicence && licenceUrl
          ? ` <a href="${esc(licenceUrl)}">Licence</a>`
          : "";
      return `<li class="source-item">${esc(credit)}${licence}</li>`;
    })
    .join("");
}

function latestSourceDate(report: SavedPreliminaryReport): string | null {
  const timestamps = reportMappingSources(report)
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
