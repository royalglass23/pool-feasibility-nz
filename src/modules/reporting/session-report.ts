import type { SessionAssessment } from "@/modules/assessment/build-session-assessment";
import { escapeHtml } from "@/shared/html/escape-html";

export interface SessionReportRequest {
  assessment: SessionAssessment;
  mapImageDataUrl: string;
}

export interface PdfRenderer {
  render(html: string): Promise<Buffer>;
}

const MAX_MAP_BYTES = 6_000_000;

export function parseSessionReportRequest(
  value: unknown,
): SessionReportRequest {
  if (!value || typeof value !== "object") throw new Error("INVALID_REPORT");
  const input = value as Record<string, unknown>;
  if (!isSessionAssessment(input.assessment)) throw new Error("INVALID_REPORT");
  if (
    typeof input.mapImageDataUrl !== "string" ||
    !input.mapImageDataUrl.startsWith("data:image/png;base64,") ||
    input.mapImageDataUrl.length > MAX_MAP_BYTES
  ) {
    throw new Error("INVALID_MAP_IMAGE");
  }
  return input as unknown as SessionReportRequest;
}

export function sessionReportId(assessment: SessionAssessment): string {
  const stamp = assessment.property.generatedAt
    .slice(0, 10)
    .replaceAll("-", "");
  return `PFA-${stamp}-${assessment.property.addressId.replace(/[^a-z0-9-]/gi, "").slice(-12)}`;
}

export function sessionReportFilename(assessment: SessionAssessment): string {
  return `pool-feasibility-${assessment.property.addressId.replace(/[^a-z0-9-]/gi, "-")}.pdf`;
}

export async function generateSessionReportPdf(
  request: SessionReportRequest,
  renderer: PdfRenderer = playwrightRenderer,
): Promise<Buffer> {
  return renderer.render(renderSessionReportHtml(request));
}

export function renderSessionReportHtml({
  assessment,
  mapImageDataUrl,
}: SessionReportRequest): string {
  const id = sessionReportId(assessment);
  const date = new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeZone: "Pacific/Auckland",
  }).format(new Date(assessment.property.generatedAt));
  const esc = (value: unknown) => escapeHtml(String(value ?? ""));
  const score = assessment.feasibilityAssessment.score ?? "—";
  const classification = esc(
    assessment.feasibilityAssessment.band?.replaceAll("_", " ") ??
      "indeterminate",
  );
  const flags = assessment.feasibilityAssessment.criticalFlags.slice(0, 3);
  const datasets = assessment.provenance.datasets.slice(0, 6);
  const risks = assessment.risks.slice(0, 5);
  const actions = assessment.actions
    .flatMap((group) =>
      group.items.map((item) => ({ phase: group.phase, item })),
    )
    .slice(0, 7);

  const header = (title: string, page: number) =>
    `<header class="page-head"><div><b>Pool feasibility assessment</b><span>${esc(title)}</span></div><div>${esc(id)}<br>Page ${page} of 3</div></header>`;
  const footer = `<footer>Generated ${esc(date)} · Internal preliminary assessment · No durable report history</footer>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;background:#eef2f4;color:#172126;font-family:Arial,sans-serif}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{size:A4;margin:0}.page{width:210mm;height:297mm;padding:12mm 13mm 10mm;background:#fff;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}
    .page-head{height:16mm;border-bottom:1px solid #ccd6d9;display:flex;justify-content:space-between;font-size:8.5pt;color:#56666d}.page-head b{display:block;color:#172126;font-size:11pt}.page-head span{display:block;margin-top:2mm}.page-head div:last-child{text-align:right;font-family:monospace}
    h1{font-size:23pt;line-height:1.08;margin:8mm 0 2mm}h2{font-size:13pt;margin:6mm 0 3mm}h3{font-size:10pt;margin:0 0 1.5mm}p{font-size:9pt;line-height:1.45;margin:0;color:#46575e}.muted{color:#66777e}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}.card{border:1px solid #d4dde0;border-radius:3mm;padding:3.5mm;background:#fbfcfc}.card strong{display:block;font-size:16pt;margin-top:2mm}.decision{display:grid;grid-template-columns:32mm 1fr;gap:5mm;border:1px solid #8fd0c3;background:#effaf7;padding:5mm;border-radius:4mm;margin:6mm 0}.score{display:grid;place-items:center;width:28mm;height:28mm;border-radius:50%;background:#0f766e;color:#fff;font-size:22pt;font-weight:700}.recommendation{font-size:13pt;line-height:1.28;color:#183b38;font-weight:700}.pill{display:inline-block;padding:1.2mm 2.5mm;margin:1mm 1mm 0 0;border-radius:99px;background:#fff4e6;color:#8a4b08;border:1px solid #f0c48a;font-size:8pt}.map{width:100%;height:105mm;object-fit:cover;border-radius:3mm;border:1px solid #c9d4d7;background:#d9e1e4}.table{width:100%;border-collapse:collapse;font-size:8.3pt}.table th,.table td{padding:2.6mm;border-bottom:1px solid #dce3e5;text-align:left;vertical-align:top}.table th{color:#53636a;font-weight:600;background:#f5f7f8}.status{font-weight:700;color:#0f766e}.risk{border-left:3px solid #d97706;padding:2.5mm 3mm;margin-bottom:2.5mm;background:#fff9f0}.risk.high{border-color:#c2410c}.action{display:grid;grid-template-columns:36mm 1fr;gap:3mm;padding:2.6mm 0;border-bottom:1px solid #e0e6e8;font-size:8.5pt}.action b{text-transform:capitalize;color:#526269}.columns{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.small-list{margin:0;padding-left:5mm;font-size:8.2pt;line-height:1.45;color:#46575e}.small-list li{margin-bottom:1.5mm}footer{position:absolute;left:13mm;right:13mm;bottom:5mm;border-top:1px solid #dce3e5;padding-top:2mm;font-size:7.5pt;color:#69787e}
  </style></head><body>
  <section class="page">${header("Executive summary", 1)}<h1>${esc(assessment.property.address)}</h1><p>${esc(assessment.property.appellation)} · Parcel ${esc(assessment.property.parcelId)}</p>
    <div class="decision"><div class="score">${esc(score)}</div><div><div class="recommendation">${esc(assessment.recommendation)}</div><p style="margin-top:2mm">${classification} · ${esc(assessment.feasibilityAssessment.confidence.level)} confidence</p>${flags.map((f) => `<span class="pill">${esc(f.id.replaceAll("_", " "))}</span>`).join("")}</div></div>
    <div class="grid">${assessment.scenarioComparison.scenarios
      .slice(0, 3)
      .map(
        (s) =>
          `<div class="card"><h3>${esc(s.scenario.label)}</h3><strong>${esc(s.status.replaceAll("_", " "))}</strong><p>${esc(s.usableAreaSquareMetres)} m² usable area</p></div>`,
      )
      .join("")}</div>
    <h2>Priority risks</h2>${risks
      .slice(0, 3)
      .map(
        (r) =>
          `<div class="risk ${r.severity}"><h3>${esc(r.title)}</h3><p>${esc(r.impact)}</p></div>`,
      )
      .join("")}
    <h2>Property overview</h2><img class="map" style="height:72mm" src="${mapImageDataUrl}" alt="Captured property assessment map">${footer}</section>
  <section class="page">${header("Property constraints", 2)}<h1>Mapped property evidence</h1><p>Official geometry returned during this session. Missing evidence is shown as unavailable and is not inferred.</p><img class="map" src="${mapImageDataUrl}" alt="Captured property assessment map">
    <h2>Evidence status</h2><table class="table"><thead><tr><th>Dataset</th><th>Provider</th><th>Status</th><th>Confidence</th></tr></thead><tbody>${datasets.map((d) => `<tr><td>${esc(d.dataset)}</td><td>${esc(d.provider)}</td><td class="status">${esc(d.status)}</td><td>${esc(d.confidence)}</td></tr>`).join("")}</tbody></table>${footer}</section>
  <section class="page">${header("Risks and actions", 3)}<h1>What needs attention next</h1><div class="columns"><div><h2>Material risks</h2>${risks.map((r) => `<div class="risk ${r.severity}"><h3>${esc(r.title)}</h3><p>${esc(r.evidence)}</p><p><b>Action:</b> ${esc(r.action)}</p></div>`).join("")}</div><div><h2>Prioritised actions</h2>${actions.map((a) => `<div class="action"><b>${esc(a.phase.replaceAll("_", " "))}</b><span>${esc(a.item)}</span></div>`).join("")}
    <h2>Missing information</h2><ul class="small-list">${assessment.missingInformation
      .slice(0, 8)
      .map((m) => `<li>${esc(m.label)}</li>`)
      .join("")}</ul></div></div>
    <h2>Assumptions and limits</h2><p>${esc(assessment.preliminaryFeasibilityWording)}</p><p style="margin-top:2mm">${esc(assessment.limitations.join(" "))}</p><p style="margin-top:3mm;font-weight:700">This preliminary desktop assessment is not approval, engineering design, a survey, title advice, utility location, or an approved pool position.</p>${footer}</section>
  </body></html>`;
}

const playwrightRenderer: PdfRenderer = {
  async render(html) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      await page.emulateMedia({ media: "print" });
      return Buffer.from(
        await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          tagged: true,
        }),
      );
    } finally {
      await browser.close();
    }
  },
};

function isSessionAssessment(value: unknown): value is SessionAssessment {
  if (!value || typeof value !== "object") return false;
  const assessment = value as Partial<SessionAssessment>;
  return Boolean(
    assessment.property?.addressId &&
    assessment.property.address &&
    assessment.property.generatedAt &&
    assessment.feasibilityAssessment &&
    Array.isArray(assessment.risks) &&
    Array.isArray(assessment.actions) &&
    Array.isArray(assessment.missingInformation) &&
    Array.isArray(assessment.provenance?.datasets),
  );
}
