import {
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-errors";
import type { SessionReportRequest } from "@/modules/reporting/report-request";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
import { renderSessionReportHtml } from "@/modules/reporting/session-report";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
    renderCanonicalPreliminaryReportHtml(report),
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
  return puppeteerRenderer;
}

const puppeteerRenderer: PdfRenderer = {
  async render(html, signal) {
    const browser = await launchPdfBrowser();
    const closeOnAbort = () => void browser.close();
    signal?.addEventListener("abort", closeOnAbort, { once: true });
    try {
      if (signal?.aborted) throw new Error("REPORT_RENDER_ABORTED");
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (request) => void request.abort("blockedbyclient"));
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(async () => {
        await Promise.all(
          Array.from(document.images).map(async (image) => {
            if (!image.complete) {
              await new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), {
                  once: true,
                });
              });
            }
            if (image.naturalWidth > 0) await image.decode();
          }),
        );
      });
      await page.emulateMediaType("print");
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

async function launchPdfBrowser() {
  const { default: puppeteer } = await import("puppeteer-core");
  if (process.env.VERCEL) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({
        args: chromium.args,
        headless: "shell",
      }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }

  const executablePath = findLocalChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      "REPORT_GENERATION_FAILED: local Chrome or Edge was not found.",
    );
  }
  return puppeteer.launch({ executablePath, headless: true });
}

function findLocalChromiumExecutable(): string | undefined {
  const candidates = [
    process.env.PDF_CHROMIUM_EXECUTABLE_PATH,
    process.env.LOCALAPPDATA &&
      join(
        process.env.LOCALAPPDATA,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
    process.env.PROGRAMFILES &&
      join(
        process.env.PROGRAMFILES,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
    process.env["PROGRAMFILES(X86)"] &&
      join(
        process.env["PROGRAMFILES(X86)"],
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
    process.env.PROGRAMFILES &&
      join(
        process.env.PROGRAMFILES,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
  ];
  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && existsSync(candidate),
  );
}

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
