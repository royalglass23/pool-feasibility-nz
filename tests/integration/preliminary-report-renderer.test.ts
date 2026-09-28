import { describe, expect, it } from "vitest";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
import { AUCKLAND_DEM_REQUIRED_METADATA } from "@/modules/providers/linz/auckland-dem-source-contract";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

const report = buildTestPreliminaryReport({
  reportAudience: "pool_builder",
  summary: "The selected pool needs checking.",
  constructability: buildConstructabilitySnapshot({
    answers: {
      version: 1,
      estimatedDepthMetres: 1.5,
      route: {
        provenance: "suggested",
        geometry: {
          type: "LineString",
          coordinates: [
            [174.7598, -36.8502],
            [174.76, -36.85],
          ],
        },
      },
      accessConditions: ["rocky_ground"],
      nearbyFeatures: ["fences"],
    },
    mappedEvidence: [
      {
        id: "saved-ground-check",
        category: "terrain_ground",
        status: "no_concern",
        provider: "Auckland DEM",
        dataset: "Indicative terrain",
      },
    ],
    providerAvailability: [
      {
        category: "terrain_ground",
        provider: "Auckland DEM",
        dataset: "Indicative terrain",
        status: "available",
      },
      {
        category: "barrier",
        provider: "Auckland Council",
        dataset: "Barrier evidence",
        status: "unavailable",
      },
      {
        category: "access_excavation",
        provider: "Vector",
        dataset: "Mapped services",
        status: "error",
      },
    ],
    assumptions: ["Route policy v1 retained from the saved assessment."],
    suggestedRoute: {
      type: "LineString",
      coordinates: [
        [174.7598, -36.8502],
        [174.76, -36.85],
      ],
    },
    routePolicyVersion: 1,
    excavation: {
      dimensions: { lengthMetres: 6, widthMetres: 3 },
      terrainAdjustment: "unavailable",
    },
  }),
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
  it("projects trusted Homeowner content into PDF HTML", () => {
    const homeownerReport = buildTestPreliminaryReport({
      reportAudience: "homeowner",
      constructability: report.constructability,
      mapImageSource: "fast_property_view_capture",
    });

    const html = renderCanonicalPreliminaryReportHtml(homeownerReport);

    expect(html).toContain("What your pool builder will confirm");
    expect(html).toContain("Arrange an onsite visit with a pool builder");
    expect(html).toContain(
      "PoolReady does not arrange, assign, introduce or book a builder",
    );
    expect(html).not.toContain("Site constructability");
    expect(html).not.toContain("Illustrative excavation geometry");
    expect(html).not.toContain("Firth masonry guidance");
    expect(html).not.toContain("user-selected-side-clearance-v1");
    expect(html).not.toContain("Mapping information &amp; licences");
    expect(html).not.toContain("Pool-shell clearances");
    expect(html).not.toContain("Suggested access route");
  });

  it("shows the optional company only in the trusted Pool Builder projection", () => {
    const builderHtml = renderCanonicalPreliminaryReportHtml(report, {
      builderCompanyName: "North Shore Pools Ltd",
    });
    const homeownerHtml = renderCanonicalPreliminaryReportHtml(
      buildTestPreliminaryReport({ reportAudience: "homeowner" }),
      { builderCompanyName: "North Shore Pools Ltd" },
    );

    expect(builderHtml).toContain(
      "Company / trading name:</strong> North Shore Pools Ltd",
    );
    expect(builderHtml).not.toContain("Customer name");
    expect(builderHtml).not.toContain("Customer phone");
    expect(builderHtml).not.toContain("Customer email");
    expect(homeownerHtml).not.toContain("North Shore Pools Ltd");
  });

  it("keeps the Homeowner projection inside three A4 pages without orphaned guidance headings", async () => {
    const homeownerReport = buildTestPreliminaryReport({
      reportAudience: "homeowner",
      constructability: report.constructability,
      mapImageSource: "fast_property_view_capture",
    });
    let layout:
      | {
          pageCount: number;
          pageOverflowPixels: number[];
          contentClearOfFooters: boolean;
          guidanceHeadingsHaveContent: boolean;
          guidanceClearOfFooter: boolean;
        }
      | undefined;

    const pdf = await generatePreliminaryReportPdf(homeownerReport, {
      async render(html) {
        const browser = await puppeteer.launch({
          executablePath: testChromiumExecutable(),
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
            const guidance = document.querySelector<HTMLElement>(
              ".homeowner-guidance",
            );
            const guidancePage = guidance?.closest<HTMLElement>(".page");
            const guidanceFooter =
              guidancePage?.querySelector<HTMLElement>("footer");
            const guidanceHeadings = Array.from(
              guidance?.querySelectorAll<HTMLElement>("h2") ?? [],
            );
            return {
              pageCount: pages.length,
              pageOverflowPixels: pages.map((reportPage) =>
                Math.max(0, reportPage.scrollHeight - reportPage.clientHeight),
              ),
              contentClearOfFooters: pages.every((reportPage) => {
                const footer = reportPage.querySelector<HTMLElement>("footer");
                if (!footer) return false;
                const boundary = footer.getBoundingClientRect().top - 8;
                return Array.from(reportPage.children).every(
                  (child) =>
                    child === footer ||
                    child.getBoundingClientRect().bottom <= boundary,
                );
              }),
              guidanceHeadingsHaveContent:
                guidanceHeadings.length === 2 &&
                guidanceHeadings.every((heading) =>
                  Boolean(heading.nextElementSibling?.textContent?.trim()),
                ),
              guidanceClearOfFooter: Boolean(
                guidance &&
                guidanceFooter &&
                guidance.getBoundingClientRect().bottom <=
                  guidanceFooter.getBoundingClientRect().top - 8,
              ),
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
    expect(layout).toEqual({
      pageCount: 3,
      pageOverflowPixels: [0, 0, 0],
      contentClearOfFooters: true,
      guidanceHeadingsHaveContent: true,
      guidanceClearOfFooter: true,
    });
  }, 30_000);

  it("renders the shared saved report through the real local Chromium boundary", async () => {
    const pdf = await generatePreliminaryReportPdf(report);
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  }, 30_000);

  it("returns a byte-identical PDF for a retry of the same saved report", async () => {
    const first = await generatePreliminaryReportPdf(report);
    const retry = await generatePreliminaryReportPdf(report);

    expect(retry.equals(first)).toBe(true);
  }, 70_000);

  it("groups repeated map credits and fits the report on three pages", async () => {
    const fullSourceReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      sources: Array.from({ length: 23 }, (_, index) => ({
        ...report.sources[0]!,
        provider:
          index === 0 ? "Land Information New Zealand" : "Auckland Council",
        attribution:
          index === 0
            ? "Land Information New Zealand (LINZ), CC BY 4.0"
            : "Healthy Waters, Auckland Council, CC BY 4.0",
        dataset:
          index === 0
            ? "Auckland Part 1 LiDAR 1m DEM (2024)"
            : `Mapped infrastructure dataset ${index + 1}`,
        sourceUrl: `https://example.test/datasets/${index + 1}`,
        ...(index === 0
          ? {
              notes: [
                "Elevation data was clipped to the assessed property and used to derive indicative slope measurements.",
              ],
              provenanceAssets: Array.from({ length: 1 }, (_, asset) => ({
                dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
                datasetDate: "2024-04-30/2024-06-27",
                stacItemUrl: `https://example.test/terrain-${asset + 1}.json`,
                assetChecksum: `sha256:terrain-checksum-${asset + 1}`,
                assetUpdatedAt: "2026-03-27T00:00:00.000Z",
                retrievedAt: "2026-08-13T02:00:00.000Z",
              })),
            }
          : {}),
      })),
    });

    const html = renderCanonicalPreliminaryReportHtml(fullSourceReport);
    const pdf = await generatePreliminaryReportPdf(fullSourceReport);

    expect(html).toContain('<section class="recommended-stage">');
    expect(html).not.toContain("<h2>Missing information</h2>");
    expect(html).not.toContain("<h2>Prioritised actions</h2>");
    expect(html).toContain("<h2>Assumptions and limitations</h2>");
    expect(html.match(/class="source-item"/g)).toHaveLength(2);
    expect(html).toContain("Healthy Waters, Auckland Council, CC BY 4.0");
    expect(html).not.toContain("Mapped infrastructure dataset 23");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  }, 30_000);

  it("shows one provider credit when saved layers have differing licence metadata", () => {
    const sharedCreditReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      sources: [
        {
          ...report.sources[0]!,
          attribution: "Example provider",
          licence: "Licence A",
        },
        {
          ...report.sources[0]!,
          dataset: "Second dataset",
          attribution: "Example provider",
          licence: "Licence B",
        },
      ],
    });
    const html = renderCanonicalPreliminaryReportHtml(sharedCreditReport);

    expect(html.match(/class="source-item"/g)).toHaveLength(1);
    expect(html).toContain("Example provider");
    expect(html).not.toContain("Licence terms vary by layer");
    expect(html).not.toContain("Second dataset");
  });

  it("expands a Pool Builder PDF when complete source attribution needs more pages", async () => {
    const crowdedReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      sources: Array.from({ length: 50 }, (_, index) => ({
        ...report.sources[0]!,
        provider: `Mapped provider ${index + 1}`,
        dataset: `Mapped dataset ${index + 1}`,
        attribution: `Source ${index + 1}: ${"Official attribution details. ".repeat(8)}`,
      })),
    });

    const pdf = await generatePreliminaryReportPdf(crowdedReport);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(
      pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0,
    ).toBeGreaterThan(3);
  }, 30_000);

  it("expands a Pool Builder PDF when valid limitations need more than three pages", async () => {
    const crowdedReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      limitations: Array.from(
        { length: 8 },
        (_, index) =>
          `Limitation ${index + 1}: ${"Mapped evidence requires independent site confirmation. ".repeat(18)}`,
      ),
    });

    const pdf = await generatePreliminaryReportPdf(crowdedReport);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(
      pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0,
    ).toBeGreaterThan(3);
  }, 30_000);

  it("rejects a Pool Builder PDF when one unbreakable evidence item cannot fit a page", async () => {
    const unreadableReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      limitations: [
        `Unbreakable evidence item: ${"This evidence must remain readable as one item. ".repeat(500)}`,
      ],
    });

    await expect(
      generatePreliminaryReportPdf(unreadableReport),
    ).rejects.toThrow(
      "REPORT_GENERATION_FAILED: builder content cannot paginate cleanly",
    );
  }, 30_000);

  it("keeps the saved map and clearances inside the fixed three-page A4 report", async () => {
    const sixStateReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
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
      sources: Array.from({ length: 12 }, (_, index) => ({
        provider:
          index === 0
            ? "Land Information New Zealand"
            : `Mapped provider ${index + 1}`,
        dataset:
          index === 0
            ? "Auckland Part 1 LiDAR 1m DEM (2024)"
            : `Mapped dataset ${index + 1}`,
        status: "available",
        evidenceUse: "report_allowed",
        licence: `Recorded licence ${index + 1}`,
        attribution: `Recorded attribution ${index + 1}`,
        sourceUrl: `https://example.test/datasets/${index + 1}`,
        retrievedAt: "2026-08-13T02:00:00.000Z",
      })),
      terrain: {
        status: "measured",
        reportEligibility: "approved",
        averageSlopeDegrees: 4,
        upperSlopeDegrees: 7.5,
        estimatedFallMetres: 1.35,
        downhillBearingDegrees: 135,
        downhillDirection: "South-east",
        confidence: "indicative",
        constructionEnvelopeTerrain: null,
        source: {
          provider: "Land Information New Zealand",
          dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
          datasetIdentifier:
            "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
          datasetDate: "2024-04-30/2024-06-27",
          licence: AUCKLAND_DEM_REQUIRED_METADATA.licence,
          licenceUrl: AUCKLAND_DEM_REQUIRED_METADATA.licenceUrl,
          attribution: AUCKLAND_DEM_REQUIRED_METADATA.attribution,
          retrievedAt: "2026-08-13T02:00:00.000Z",
          derivedProductNotice:
            "Elevation data was clipped to the assessed property and used to derive indicative slope measurements.",
          contributingAssets: Array.from({ length: 4 }, (_, index) => ({
            ...(index === 1
              ? {
                  dataset: "Auckland Part 2 LiDAR 1m DEM (2024)",
                  datasetIdentifier:
                    "https://data.linz.govt.nz/layer/122580-auckland-part-2-lidar-1m-dem-2024/",
                  datasetDate: "2024-06-26/2024-11-04",
                }
              : {}),
            stacCollectionUrl: `https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-${index === 1 ? "2" : "1"}_2024/dem_1m/2193/collection.json`,
            assetUrl: `https://example.test/terrain-${index + 1}.tiff`,
            stacItemUrl: `https://example.test/terrain-${index + 1}.json`,
            assetChecksum: `sha256:terrain-checksum-${index + 1}`,
            assetUpdatedAt: "2026-03-27T00:00:00.000Z",
            retrievedAt: "2026-08-13T02:00:00.000Z",
          })),
        },
      },
    });
    sixStateReport.assessments.terrain = {
      ...sixStateReport.assessments.terrain,
      status: "amber",
      headline: "Indicative terrain measurement",
      summary: "Confirm mapped levels with a current site survey.",
      details: [{ label: "Property average slope", value: "4.0°" }],
    };
    let layout:
      | {
          pageCount: number;
          pageOverflowPixels: number[];
          mapCount: number;
          mapPanelContained: boolean;
          mapPanelOnPageOne: boolean;
          mapPanelClearOfFooter: boolean;
          findingsClearOfFooter: boolean;
          terrainCardShown: boolean;
          mapFillsVisualArea: boolean;
          mapLegendBelowMap: boolean;
          mapLegendHasThreeColumns: boolean;
          mapLegendContentContained: boolean;
          clearanceItemsContained: boolean;
          clearancesAppearBeforeMapLayers: boolean;
          mapKeyCount: number;
          mapCaptionContained: boolean;
          keyFindingsCount: number;
          sourceItemCount: number;
          provenanceAssetCount: number;
          terrainSourceText: string;
          terrainStacHrefs: string[];
          pageThreeContentClearOfFooter: boolean;
          sourceSummaryText: string;
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
            const mapPanel =
              document.querySelector<HTMLElement>(".summary-map");
            const map = mapPanel?.querySelector<HTMLElement>(".map");
            const mapVisual =
              mapPanel?.querySelector<HTMLElement>(".map-visual");
            const mapLegend =
              mapPanel?.querySelector<HTMLElement>(".map-legend");
            const mapLegendList =
              mapPanel?.querySelector<HTMLElement>(".map-legend-list");
            const mapPage = mapPanel?.closest<HTMLElement>(".page");
            const mapCaption =
              mapPanel?.querySelector<HTMLElement>(".map-caption");
            const pageTwo = pages[1];
            const findings =
              pageTwo?.querySelector<HTMLElement>(".assessment-grid");
            const terrainCard = Array.from(
              pageTwo?.querySelectorAll<HTMLElement>(".assessment-card") ?? [],
            ).find((card) =>
              card.textContent?.includes("Indicative terrain measurement"),
            );
            const pageTwoFooter = pageTwo?.querySelector<HTMLElement>("footer");
            const footer = mapPage?.querySelector<HTMLElement>("footer");
            const pageThree = pages[2];
            const pageThreeFooter =
              pageThree?.querySelector<HTMLElement>("footer");
            const disclaimer =
              pageThree?.querySelector<HTMLElement>(".disclaimer");
            if (
              !mapPanel ||
              !map ||
              !mapVisual ||
              !mapLegend ||
              !mapLegendList ||
              !mapPage ||
              !mapCaption ||
              !findings ||
              !pageTwoFooter ||
              !footer ||
              !pageThree ||
              !pageThreeFooter ||
              !disclaimer
            ) {
              throw new Error("REPORT_MAP_PANEL_MISSING");
            }
            const panelRect = mapPanel.getBoundingClientRect();
            const mapRect = map.getBoundingClientRect();
            const mapLegendRect = mapLegend.getBoundingClientRect();
            const pageRect = mapPage.getBoundingClientRect();
            const captionRect = mapCaption.getBoundingClientRect();
            const findingsRect = findings.getBoundingClientRect();
            const pageTwoFooterRect = pageTwoFooter.getBoundingClientRect();
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
              mapPanelOnPageOne: mapPage === pages[0],
              mapPanelClearOfFooter: panelRect.bottom <= footerRect.top - 8,
              findingsClearOfFooter:
                findingsRect.bottom <= pageTwoFooterRect.top - 8,
              terrainCardShown: Boolean(
                terrainCard?.textContent?.includes("4.0°"),
              ),
              mapFillsVisualArea:
                Math.abs(
                  mapRect.height - mapVisual.getBoundingClientRect().height,
                ) < 1,
              mapLegendBelowMap: mapLegendRect.top >= mapRect.bottom - 1,
              mapLegendHasThreeColumns:
                getComputedStyle(mapLegendList)
                  .gridTemplateColumns.split(" ")
                  .filter(Boolean).length === 3,
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
              mapKeyCount: mapPanel.querySelectorAll(".map-legend").length,
              mapCaptionContained:
                captionRect.left >= panelRect.left &&
                captionRect.right <= panelRect.right,
              keyFindingsCount: pageTwo?.querySelectorAll(".later").length ?? 0,
              sourceItemCount:
                pageThree.querySelectorAll(".source-item").length,
              provenanceAssetCount:
                pageThree.querySelectorAll(".source-provenance").length,
              terrainSourceText:
                pageThree
                  .querySelector<HTMLElement>(".source-item")
                  ?.textContent?.replace(/\s+/g, " ")
                  .trim() ?? "",
              terrainStacHrefs: Array.from(
                pageThree.querySelectorAll<HTMLAnchorElement>(
                  ".source-provenance a",
                ),
                (link) => link.href,
              ),
              pageThreeContentClearOfFooter:
                disclaimer.getBoundingClientRect().bottom <=
                pageThreeFooter.getBoundingClientRect().top - 8,
              sourceSummaryText:
                pageThree
                  .querySelector<HTMLElement>(".mapping-summary")
                  ?.textContent?.trim() ?? "",
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
      mapPanelOnPageOne: true,
      mapPanelClearOfFooter: true,
      findingsClearOfFooter: true,
      terrainCardShown: true,
      mapFillsVisualArea: true,
      mapLegendBelowMap: true,
      mapLegendHasThreeColumns: true,
      mapLegendContentContained: true,
      clearanceItemsContained: true,
      clearancesAppearBeforeMapLayers: true,
      mapKeyCount: 1,
      mapCaptionContained: true,
      keyFindingsCount: 1,
      sourceItemCount: 12,
      provenanceAssetCount: 0,
      terrainStacHrefs: [],
      pageThreeContentClearOfFooter: true,
      sourceSummaryText:
        "Sources include LINZ - Mapped provider 2 - Mapped provider 3 - Mapped provider 4 and 8 more providers.",
    });
    expect(layout?.terrainSourceText).toContain(
      AUCKLAND_DEM_REQUIRED_METADATA.attribution.text,
    );
    expect(layout?.terrainSourceText).not.toContain("Slope:");
    expect(layout?.terrainSourceText).not.toContain("Checksum");
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
