import { describe, expect, it } from "vitest";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

const report = buildTestPreliminaryReport({
  summary: "The selected pool needs checking.",
  recommendations: [
    {
      phase: "before_concept_design",
      priority: 1,
      title: "Confirm the mapped evidence",
      reason: "Ask Royal Glass to review the detailed official checks.",
    },
  ],
  sources: [
    {
      provider: "Land Information New Zealand",
      dataset: "NZ Parcels",
      status: "available",
      evidenceUse: "report_allowed",
      licence: "Creative Commons Attribution 4.0 International",
      attribution: "Land Information New Zealand (LINZ), CC BY 4.0",
      sourceUrl: "https://data.linz.govt.nz/",
    },
  ],
});

describe("persisted preliminary report renderer", () => {
  it("renders the shared saved report through the real local Chromium boundary", async () => {
    const pdf = await generatePreliminaryReportPdf(report);
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  }, 30_000);

  it("returns byte-identical PDFs for retries of the same saved report", async () => {
    const first = await generatePreliminaryReportPdf(report);
    const second = await generatePreliminaryReportPdf(report);

    expect(second.equals(first)).toBe(true);
  }, 60_000);

  it("keeps the attached six-state map key inside the rendered three-page A4 report", async () => {
    const sixStateReport = buildTestPreliminaryReport({
      layers: [
        {
          id: "contours",
          provider: "Auckland Council",
          dataset: "Contours 2016",
          evidenceUse: "spike_only",
          state: "returned",
          confidence: "limited",
          attribution: "Auckland Council",
          sourceUrl: null,
        },
        {
          id: "public_stormwater_assets",
          provider: "Auckland Council",
          dataset: "Stormwater Pipe",
          evidenceUse: "report_allowed",
          state: "returned",
          confidence: "limited",
          attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
          sourceUrl: null,
        },
        {
          id: "wastewater_assets",
          provider: "Watercare",
          dataset: "Wastewater Pipes",
          evidenceUse: "internal_reference",
          state: "internal_reference_only",
          confidence: "limited",
          attribution: "Watercare",
          sourceUrl: null,
        },
        {
          id: "public_water_assets",
          provider: "Watercare",
          dataset: "Water Pipes",
          evidenceUse: "internal_reference",
          state: "internal_reference_only",
          confidence: "limited",
          attribution: "Watercare",
          sourceUrl: null,
        },
        {
          id: "electricity_feeder_lines",
          provider: "Vector",
          dataset: "Electricity Distribution Feeder Network",
          evidenceUse: "report_allowed",
          state: "empty",
          confidence: "limited",
          attribution: "Vector",
          sourceUrl: null,
        },
        {
          id: "gas_distribution_lines",
          provider: "Vector",
          dataset: "Gas Distribution Network",
          evidenceUse: "report_allowed",
          state: "unavailable",
          confidence: "unavailable",
          attribution: "Vector",
          sourceUrl: null,
        },
      ],
    });
    let layout:
      | {
          pageCount: number;
          pageOverflowPixels: number[];
          detailPanelHorizontal: boolean;
          detailPanelContained: boolean;
          legendItemsContained: boolean;
          legendText: string;
        }
      | undefined;
    const executablePath = testChromiumExecutable();

    const pdf = await generatePreliminaryReportPdf(sixStateReport, {
      async render(html) {
        const browser = await puppeteer.launch({
          executablePath,
          headless: true,
        });
        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "load" });
          await page.emulateMediaType("print");
          layout = await page.evaluate(() => {
            const pages = Array.from(
              document.querySelectorAll<HTMLElement>(".page"),
            );
            const detailPanel = document.querySelector<HTMLElement>(
              ".report-map-panel.detail",
            );
            const map = detailPanel?.querySelector<HTMLElement>(".map");
            const key = detailPanel?.querySelector<HTMLElement>(".map-key");
            const detailPage = detailPanel?.closest<HTMLElement>(".page");
            if (!detailPanel || !map || !key || !detailPage) {
              throw new Error("REPORT_MAP_PANEL_MISSING");
            }
            const panelRect = detailPanel.getBoundingClientRect();
            const mapRect = map.getBoundingClientRect();
            const keyRect = key.getBoundingClientRect();
            const pageRect = detailPage.getBoundingClientRect();
            const legendItems = Array.from(
              key.querySelectorAll<HTMLElement>(".map-key-item"),
            );
            return {
              pageCount: pages.length,
              pageOverflowPixels: pages.map((reportPage) =>
                Math.max(0, reportPage.scrollHeight - reportPage.clientHeight),
              ),
              detailPanelHorizontal:
                Math.abs(mapRect.top - keyRect.top) <= 1 &&
                mapRect.right <= keyRect.left + 1,
              detailPanelContained:
                panelRect.left >= pageRect.left &&
                panelRect.right <= pageRect.right &&
                panelRect.bottom <= pageRect.bottom,
              legendItemsContained: legendItems.every((item) => {
                const itemRect = item.getBoundingClientRect();
                return (
                  itemRect.left >= keyRect.left &&
                  itemRect.right <= keyRect.right &&
                  itemRect.bottom <= keyRect.bottom
                );
              }),
              legendText: key.innerText,
            };
          });
          return Buffer.from(
            await page.pdf({ format: "A4", printBackground: true }),
          );
        } finally {
          await browser.close();
        }
      },
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
    expect(layout).toMatchObject({
      pageCount: 3,
      pageOverflowPixels: [0, 0, 0],
      detailPanelHorizontal: true,
      detailPanelContained: true,
      legendItemsContained: true,
    });
    expect(layout?.legendText).toContain("Contours\nNot reproduced");
    expect(layout?.legendText).toContain("Stormwater\nMapped");
    expect(layout?.legendText).toContain("Wastewater\nNot reproduced");
    expect(layout?.legendText).toContain("Water\nNot reproduced");
    expect(layout?.legendText).toContain("Electricity\nNo mapped evidence");
    expect(layout?.legendText).toContain("Gas\nUnavailable / unknown");
  }, 60_000);
});

function testChromiumExecutable(): string {
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
  const executablePath = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && existsSync(candidate),
  );
  if (!executablePath) throw new Error("TEST_CHROMIUM_EXECUTABLE_NOT_FOUND");
  return executablePath;
}
