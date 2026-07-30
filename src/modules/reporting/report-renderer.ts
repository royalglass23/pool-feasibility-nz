import {
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-errors";
import type { SessionReportRequest } from "@/modules/reporting/report-request";
import {
  renderPreliminaryReportHtml,
  type SavedPreliminaryReport,
} from "@/modules/reporting/preliminary-report";
import { renderSessionReportHtml } from "@/modules/reporting/session-report";

export interface PdfRenderer {
  render(html: string, signal?: AbortSignal): Promise<Buffer>;
}

const REPORT_RENDER_TIMEOUT_MS = 30_000;
const rendererGlobal = globalThis as typeof globalThis & {
  __poolFeasibilityReportRendererBusy?: boolean;
};

export async function generateSessionReportPdf(
  request: SessionReportRequest,
  renderer: PdfRenderer = defaultPdfRenderer(),
): Promise<Buffer> {
  const pdf = await generateReportHtmlPdf(
    renderSessionReportHtml(request),
    renderer,
  );
  return canonicalizePdfMetadata(pdf, request.assessment.property.generatedAt);
}

export async function generatePreliminaryReportPdf(
  report: SavedPreliminaryReport,
  renderer: PdfRenderer = defaultPdfRenderer(),
): Promise<Buffer> {
  const pdf = await generateReportHtmlPdf(
    renderPreliminaryReportHtml(report),
    renderer,
  );
  return canonicalizePdfMetadata(pdf, report.generatedAt);
}

async function generateReportHtmlPdf(
  html: string,
  renderer: PdfRenderer,
): Promise<Buffer> {
  if (rendererGlobal.__poolFeasibilityReportRendererBusy) {
    throw new ReportRendererBusyError();
  }

  rendererGlobal.__poolFeasibilityReportRendererBusy = true;
  const controller = new AbortController();
  const renderPromise = Promise.resolve().then(() =>
    renderer.render(html, controller.signal),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new ReportRendererTimeoutError());
    }, REPORT_RENDER_TIMEOUT_MS);
  });
  let releaseWhenRendererSettles = false;
  try {
    return await Promise.race([renderPromise, deadline]);
  } catch (error) {
    if (controller.signal.aborted) {
      releaseWhenRendererSettles = true;
      void renderPromise
        .catch(() => undefined)
        .finally(() => {
          rendererGlobal.__poolFeasibilityReportRendererBusy = false;
        });
      throw new ReportRendererTimeoutError();
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (!releaseWhenRendererSettles) {
      rendererGlobal.__poolFeasibilityReportRendererBusy = false;
    }
  }
}

function defaultPdfRenderer(): PdfRenderer {
  if (process.env.VERCEL) {
    throw new Error(
      "REPORT_GENERATION_FAILED: production PDF runtime is pending its deployment evidence gate.",
    );
  }
  return playwrightRenderer;
}

const playwrightRenderer: PdfRenderer = {
  async render(html, signal) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const closeOnAbort = () => void browser.close();
    signal?.addEventListener("abort", closeOnAbort, { once: true });
    try {
      if (signal?.aborted) throw new Error("REPORT_RENDER_ABORTED");
      const page = await browser.newPage();
      await page.route("**/*", (route) => route.abort("blockedbyclient"));
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
      signal?.removeEventListener("abort", closeOnAbort);
      await browser.close();
    }
  },
};

function canonicalizePdfMetadata(pdf: Buffer, generatedAt: string): Buffer {
  const timestamp = new Date(generatedAt)
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const source = pdf.toString("latin1");
  const canonical = source.replace(
    /(\/(?:CreationDate|ModDate)\s*\(D:)\d{14}((?:Z|[+-]\d{2}'\d{2}')?)(\))/g,
    (_match, prefix: string, suffix: string, close: string) =>
      `${prefix}${timestamp}${suffix}${close}`,
  );
  return canonical === source ? pdf : Buffer.from(canonical, "latin1");
}

export {
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-errors";
