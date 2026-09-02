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
      retrievedAt: "2026-08-13T02:00:00.000Z",
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

    for (let retry = 0; retry < 5; retry += 1) {
      const retryPdf = await generatePreliminaryReportPdf(report);
      expect(retryPdf.equals(first)).toBe(true);
    }
  }, 60_000);

  it("keeps the saved map and clearances inside the fixed three-page A4 report", async () => {
    const sixStateReport = buildTestPreliminaryReport({
      keyFindings: [
        {
          id: "pool_position_review",
          category: "pool_fit",
          severity: "red",
          title: "Pool position needs review",
          clientSummary:
            "The selected pool layout overlaps reliable mapped building infrastructure.",
        },
        {
          id: "placement_layer:electricity_feeder_lines",
          category: "electricity",
          severity: "red",
          title: "Electricity infrastructure near the proposed pool",
          clientSummary:
            "The selected pool layout overlaps reliable mapped electricity infrastructure.",
        },
        {
          id: "placement_layer:gas_distribution_lines",
          category: "gas",
          severity: "amber",
          title: "Gas infrastructure near the proposed pool",
          clientSummary:
            "The selected pool layout overlaps mapped gas infrastructure that needs position confirmation.",
        },
      ],
      mapImageSource: "fast_property_view_capture",
      mapVisibleLayerKeys: [
        "contours",
        "public_stormwater_assets",
        "wastewater_assets",
        "public_water_assets",
        "electricity_feeder_lines",
        "gas_distribution_lines",
      ],
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
          mapCount: number;
          mapPanelContained: boolean;
          mapPanelAlignedWithGlance: boolean;
          mapPanelClearOfFooter: boolean;
          mapLayoutHeightMatchesFixedArea: boolean;
          mapLegendContentContained: boolean;
          clearanceItemsContained: boolean;
          clearancesAppearBeforeMapLayers: boolean;
          mapFillsLegendHeight: boolean;
          mapKeyCount: number;
          mapCaptionContained: boolean;
          keyFindingsCount: number;
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
            const mapPanel = document.querySelector<HTMLElement>(".map-panel");
            const map = mapPanel?.querySelector<HTMLElement>(".map");
            const mapLegend =
              mapPanel?.querySelector<HTMLElement>(".map-legend");
            const mapPage = mapPanel?.closest<HTMLElement>(".page");
            const mapCaption =
              mapPanel?.querySelector<HTMLElement>(".map-caption");
            const glance = document.querySelector<HTMLElement>(".glance-grid");
            const footer = mapPage?.querySelector<HTMLElement>("footer");
            if (
              !mapPanel ||
              !map ||
              !mapLegend ||
              !mapPage ||
              !mapCaption ||
              !glance ||
              !footer
            ) {
              throw new Error("REPORT_MAP_PANEL_MISSING");
            }
            const panelRect = mapPanel.getBoundingClientRect();
            const mapRect = map.getBoundingClientRect();
            const mapLegendRect = mapLegend.getBoundingClientRect();
            const pageRect = mapPage.getBoundingClientRect();
            const captionRect = mapCaption.getBoundingClientRect();
            const glanceRect = glance.getBoundingClientRect();
            const footerRect = footer.getBoundingClientRect();
            return {
              pageCount: pages.length,
              pageOverflowPixels: pages.map((reportPage) =>
                Math.max(0, reportPage.scrollHeight - reportPage.clientHeight),
              ),
              mapCount: document.querySelectorAll("img.map").length,
              mapPanelContained:
                panelRect.left >= pageRect.left &&
                panelRect.right <= pageRect.right &&
                panelRect.bottom <= pageRect.bottom,
              mapPanelAlignedWithGlance:
                Math.abs(panelRect.left - glanceRect.left) < 1 &&
                Math.abs(panelRect.right - glanceRect.right) < 1,
              mapPanelClearOfFooter: panelRect.bottom <= footerRect.top - 8,
              mapLayoutHeightMatchesFixedArea:
                Math.abs(mapRect.height - mapLegendRect.height) < 1 &&
                Math.abs(mapRect.height - 359.1) < 1,
              mapLegendContentContained:
                mapLegend.scrollHeight <= mapLegend.clientHeight,
              clearanceItemsContained: Array.from(
                mapLegend.querySelectorAll<HTMLElement>(".map-clearances li"),
              ).every(
                (item) =>
                  item.getBoundingClientRect().bottom <=
                  mapLegendRect.bottom + 1,
              ),
              clearancesAppearBeforeMapLayers:
                (mapLegend
                  .querySelector(".map-clearances")
                  ?.compareDocumentPosition(
                    mapLegend.querySelector(".map-legend-list")!,
                  ) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING
                  ? true
                  : false,
              mapFillsLegendHeight: mapRect.bottom >= mapLegendRect.bottom - 1,
              mapKeyCount: mapPanel.querySelectorAll(".map-legend").length,
              mapCaptionContained:
                captionRect.left >= panelRect.left &&
                captionRect.right <= panelRect.right,
              keyFindingsCount: document.querySelectorAll(".findings").length,
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
      mapCount: 1,
      mapPanelContained: true,
      mapPanelAlignedWithGlance: true,
      mapPanelClearOfFooter: true,
      mapLayoutHeightMatchesFixedArea: true,
      mapLegendContentContained: true,
      clearanceItemsContained: true,
      clearancesAppearBeforeMapLayers: true,
      mapFillsLegendHeight: true,
      mapKeyCount: 1,
      mapCaptionContained: true,
      keyFindingsCount: 0,
    });
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
