import {
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-errors";
import type { SessionReportRequest } from "@/modules/reporting/report-request";
import { renderSessionReportHtml } from "@/modules/reporting/session-report";

export interface PdfRenderer {
  render(html: string, signal?: AbortSignal): Promise<Buffer>;
}

const REPORT_RENDER_TIMEOUT_MS = 15_000;
const rendererGlobal = globalThis as typeof globalThis & {
  __poolFeasibilityReportRendererBusy?: boolean;
};

export async function generateSessionReportPdf(
  request: SessionReportRequest,
  renderer: PdfRenderer = playwrightRenderer,
): Promise<Buffer> {
  if (rendererGlobal.__poolFeasibilityReportRendererBusy) {
    throw new ReportRendererBusyError();
  }

  rendererGlobal.__poolFeasibilityReportRendererBusy = true;
  const controller = new AbortController();
  const renderPromise = Promise.resolve().then(() =>
    renderer.render(renderSessionReportHtml(request), controller.signal),
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

export {
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-errors";
