import { describe, expect, it, vi } from "vitest";

const launchBrowser = vi.hoisted(() => vi.fn());
const resolveChromiumExecutablePath = vi.hoisted(() =>
  vi.fn(async () => "/opt/chromium"),
);

vi.mock("puppeteer-core", () => ({
  default: {
    defaultArgs: vi.fn(({ args }: { args: string[] }) => args),
    launch: launchBrowser,
  },
}));
vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--disable-dev-shm-usage"],
    executablePath: resolveChromiumExecutablePath,
  },
}));

import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import {
  buildSavedPreliminaryReport,
  preliminaryReportFilename,
  renderPreliminaryReportHtml,
} from "@/modules/reporting/preliminary-report";
import {
  buildTestPreliminaryReport,
  TEST_MAP_IMAGE_DATA_URL,
} from "../fixtures/preliminary-report";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";

const submission: PersistedAssessmentSubmission = {
  idempotencyKey: "submission-1234567890",
  homeowner: {
    name: "Jane Homeowner",
    phone: "021 555 1234",
    email: "jane@example.com",
    address: "1 Test Street, Auckland",
    visitorType: "homeowner",
    desiredTiming: "3_months",
    consentGiven: true,
    consentVersion: "assessment-v1",
    consentedAt: "2026-07-29T01:00:00.000Z",
  },
  addressEvidence: {
    selectedAddressId: "linz-123",
    formattedAddress: "1 Test Street, Auckland",
    latitude: -36.85,
    longitude: 174.76,
    boundaryStatus: "provisional",
    boundaryAreaSquareMetres: 842.4,
    parcelIdentifier: "NA123/45",
  },
  poolLayout: {
    lengthMetres: 6.5,
    widthMetres: 3,
    rotationDegrees: 12,
    position: [174.76, -36.85],
    shellGeometry: { type: "Polygon", coordinates: [] },
    constructionEnvelopeGeometry: { type: "Polygon", coordinates: [] },
  },
  layerStates: [
    {
      provider: "Watercare",
      dataset: "Wastewater services",
      status: "returned",
      confidence: "high",
      featureCount: 1,
      attribution: "Watercare Services Limited",
      sourceUrl: "https://example.test/watercare",
    },
  ],
  warnings: [
    {
      state: "blocked",
      code: "POOL_BLOCKED",
      title: "Pool placement is blocked",
      message:
        "A reliable mapped wastewater service intersects the selected pool.",
    },
  ],
  recommendations: [
    {
      phase: "before_concept_design",
      priority: 1,
      title: "Resolve the mapped pool warning",
      reason:
        "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
    },
  ],
  report: {
    analysisVersion: "mt-249-v1",
    title: "Preliminary pool feasibility assessment",
    summary:
      "A reliable mapped wastewater service intersects the selected pool.",
    feasibilityState: "blocked",
    mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    reportData: {
      recommendation:
        "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
      preliminaryFeasibilityWording:
        "This preliminary assessment needs professional review.",
      risks: [
        {
          id: "risk-wastewater",
          category: "underground_services",
          title: "Mapped wastewater conflict",
          severity: "high",
          evidence: "A mapped wastewater service crosses the selected pool.",
          source: "Watercare wastewater services",
          confidence: "high",
          impact: "The selected position may not be buildable.",
          action: "Confirm the service location before concept design.",
          specialistReviewRequired: true,
        },
      ],
      actions: [
        {
          phase: "before_concept_design",
          items: ["Confirm the wastewater service location."],
        },
      ],
      missingInformation: [
        {
          id: "onsite-service-locating",
          label: "Onsite service locating",
          status: "unverified",
        },
      ],
      limitations: [
        "Mapped information is indicative and must be verified before design.",
      ],
      provenance: {
        datasets: [
          {
            id: "watercare-wastewater",
            provider: "Watercare",
            dataset: "Wastewater services",
            datasetIdentifier: "watercare-wastewater",
            status: "available",
            evidenceUse: "report_allowed",
            retrievedAt: "2026-07-29T01:00:00.000Z",
            datasetDate: "2026",
            licence: "CC BY 4.0",
            attribution: {
              text: "Watercare Services Limited",
              url: "https://example.test/watercare",
            },
            confidence: "high",
            availabilityNote: null,
          },
        ],
      },
      assessmentSnapshot: {
        property: {
          addressId: "linz-123",
          address: "1 Test Street, Auckland",
          parcelId: "NA123/45",
          appellation: "Lot 1 DP 12345",
          generatedAt: "2026-07-29T01:00:00.000Z",
        },
        recommendation:
          "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
        feasibilityAssessment: {
          score: 42,
          band: "significant_constraints",
          confidence: { level: "medium" },
          categories: [
            {
              id: "available_space",
              maximumPoints: 25,
              awardedPoints: 20,
              status: "scored",
              rationale: "A selected layout was saved.",
            },
            {
              id: "underground_services",
              maximumPoints: 20,
              awardedPoints: 0,
              status: "scored",
              rationale: "A mapped wastewater conflict is present.",
            },
            {
              id: "flooding_and_drainage",
              maximumPoints: 20,
              awardedPoints: null,
              status: "unknown",
              rationale: "Detailed flooding checks are unavailable.",
            },
            {
              id: "terrain_and_slope",
              maximumPoints: 15,
              awardedPoints: null,
              status: "unknown",
              rationale: "Detailed terrain checks are unavailable.",
            },
            {
              id: "planning_constraints",
              maximumPoints: 10,
              awardedPoints: null,
              status: "unknown",
              rationale: "Detailed planning checks are unavailable.",
            },
            {
              id: "construction_access",
              maximumPoints: 10,
              awardedPoints: 7,
              status: "scored",
              rationale: "Desktop access appears constrained.",
            },
          ],
          criticalFlags: [
            {
              id: "reliable_service_conflict",
              rationale: "The selected layout crosses a mapped service.",
            },
          ],
        },
        scenarioComparison: {
          recommendedShell: null,
          scenarios: [
            {
              scenario: { label: "Compact" },
              status: "possible_with_constraints",
              usableAreaSquareMetres: 72,
            },
            {
              scenario: { label: "Standard" },
              status: "specialist_review_required",
              usableAreaSquareMetres: 54,
            },
            {
              scenario: { label: "Large" },
              status: "no_clear_candidate",
              usableAreaSquareMetres: 18,
            },
          ],
        },
        preliminaryFeasibilityWording:
          "This preliminary assessment needs professional review.",
        risks: [
          {
            title: "Mapped wastewater conflict",
            severity: "high",
            evidence: "A mapped wastewater service crosses the selected pool.",
            impact: "The selected position may not be buildable.",
            action: "Confirm the service location before concept design.",
          },
        ],
        actions: [
          {
            phase: "before_concept_design",
            items: ["Confirm the wastewater service location."],
          },
        ],
        missingInformation: [{ label: "Onsite service locating" }],
        limitations: [
          "Mapped information is indicative and must be verified before design.",
        ],
        provenance: {
          datasets: [
            {
              provider: "Watercare",
              dataset: "Wastewater services",
              status: "available",
              evidenceUse: "report_allowed",
              retrievedAt: "2026-07-29T01:00:00.000Z",
              licence: "CC BY 4.0",
              attribution: {
                text: "Watercare Services Limited",
                url: "https://example.test/watercare",
              },
              confidence: "high",
            },
          ],
        },
      },
    },
  },
};

describe("saved preliminary report", () => {
  it("builds one plain-language report for a blocked saved layout", () => {
    const report = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000123",
      createdAt: "2026-07-29T02:03:04.000Z",
    });

    expect(report).toMatchObject({
      reference: "GF-2026-000123",
      warningState: "blocked",
      property: {
        address: "1 Test Street, Auckland",
        boundaryStatus: "provisional",
        boundaryConfidence: "medium",
        boundaryAreaSquareMetres: 842.4,
        parcelIdentifier: "NA123/45",
      },
      pool: {
        lengthMetres: 6.5,
        widthMetres: 3,
        rotationDegrees: 12,
      },
    });
    expect(report.mapImageDataUrl).toBe(TEST_MAP_IMAGE_DATA_URL);
    expect(report.mainRecommendation).toContain("Move the pool");
    expect(report.decision).toMatchObject({
      score: 42,
      classification: "significant_constraints",
      confidence: "medium",
    });
    expect(report.scenarios).toHaveLength(3);
    expect(report.categories).toHaveLength(6);
    expect(report.risks[0]?.title).toBe("Mapped wastewater conflict");
    expect(report.actions[0]?.items[0]).toContain("wastewater");
    expect(report.missingInformation[0]?.label).toBe("Onsite service locating");
    expect(report.sources[0]).toMatchObject({
      dataset: "Wastewater services",
      licence: "CC BY 4.0",
      attribution: "Watercare Services Limited",
    });
    expect(report.layers[0]).toMatchObject({
      id: "watercare-wastewater",
      dataset: "Wastewater services",
      evidenceUse: "report_allowed",
      state: "returned",
    });
  });

  it("renders the saved reference, map, warning, recommendation, layer status, and limitations into exactly three report pages", () => {
    const report = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000123",
      createdAt: "2026-07-29T02:03:04.000Z",
    });

    const html = renderPreliminaryReportHtml(report);

    expect(html.match(/<section class="page">/g)).toHaveLength(3);
    expect(html).toContain("GF-2026-000123");
    expect(html).toContain("1 Test Street, Auckland");
    expect(html).toContain("6.5 m × 3 m");
    expect(html).toContain("12° rotation");
    expect(html).toContain("Confidence: medium");
    expect(html).toContain("Area: 842 m²");
    expect(html).toContain("Pool placement is blocked");
    expect(html).toContain(
      "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
    );
    expect(html).toContain("Wastewater services");
    expect(html).toContain("returned");
    expect(html).toContain("42");
    expect(html).toContain("significant constraints");
    expect(html).toContain("medium confidence");
    expect(html.match(/class="scenario-card"/g)).toHaveLength(3);
    expect(html.match(/class="category-row"/g)).toHaveLength(6);
    expect(html).toContain("Mapped wastewater conflict");
    expect(html).toContain("Confirm the wastewater service location.");
    expect(html).toContain("Onsite service locating");
    expect(html).toContain("Assumptions");
    expect(html).toContain("Watercare Services Limited");
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain("https://example.test/watercare");
    expect(html).toContain("Map attribution");
    expect(html).toContain("Map key");
    expect(html).toContain("Mapped property boundary");
    expect(html).toContain("Selected pool");
    expect(html).toContain("Indicative investigation buffer");
    expect(html).toContain("Wastewater");
    const pageThreeStart = html.indexOf("Page 3 of 3");
    expect(pageThreeStart).toBeGreaterThan(-1);
    expect(html.indexOf("Data sources", pageThreeStart)).toBeGreaterThan(
      pageThreeStart,
    );
    expect(html).toContain(
      "Mapped information is indicative and must be verified before design.",
    );
    expect(html).toContain(TEST_MAP_IMAGE_DATA_URL);
    expect(html).not.toContain("No durable report history");
    expect(preliminaryReportFilename(report)).toBe(
      "pool-feasibility-GF-2026-000123.pdf",
    );
  });

  it.each([
    ["no_warning", "No mapped conflict found"],
    ["needs_checking", "Mapped evidence needs checking"],
    ["blocked", "Pool placement is blocked"],
  ] as const)(
    "renders consistent %s outcome copy",
    (warningState, warningTitle) => {
      const report = buildSavedPreliminaryReport({
        submission: {
          ...submission,
          recommendations: [],
          warnings: [
            {
              ...submission.warnings[0],
              state: warningState,
              title: warningTitle,
            },
          ],
          report: {
            ...submission.report,
            feasibilityState: warningState,
          },
        },
        reference: "GF-2026-000123",
        createdAt: "2026-07-29T02:03:04.000Z",
      });

      expect(report.warningState).toBe(warningState);
      const html = renderPreliminaryReportHtml(report);
      expect(html).toContain("Page 3 of 3");
      expect(html).toContain(warningTitle);
      expect(html).toContain(
        "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
      );
      expect(html).toContain(
        {
          no_warning: "No warning",
          needs_checking: "Needs checking",
          blocked: "Blocked",
        }[warningState],
      );
    },
  );

  it("names live reference layers that the report is not permitted to reproduce", () => {
    const html = renderPreliminaryReportHtml(
      buildTestPreliminaryReport({
        layers: [
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
        ],
      }),
    );

    expect(html).toContain("Not reproduced in this report:");
    expect(html).toContain("Wastewater Pipes");
    expect(html).toContain(">Wastewater<small>Not reproduced</small>");
  });

  it("shows every detailed-check category in the map legend without reproducing uncleared layers", () => {
    const html = renderPreliminaryReportHtml(
      buildTestPreliminaryReport({
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
            evidenceUse: "spike_only",
            state: "empty",
            confidence: "limited",
            attribution: "Vector",
            sourceUrl: null,
          },
          {
            id: "gas_distribution_lines",
            provider: "Vector",
            dataset: "Gas Distribution Network",
            evidenceUse: "spike_only",
            state: "unavailable",
            confidence: "unavailable",
            attribution: "Vector",
            sourceUrl: null,
          },
        ],
      }),
    );

    expect(html).toContain(">Contours<small>Not reproduced</small>");
    expect(html).toContain(">Stormwater<small>Mapped</small>");
    expect(html).toContain(">Wastewater<small>Not reproduced</small>");
    expect(html).toContain(">Water<small>Not reproduced</small>");
    expect(html).toContain(">Electricity<small>No mapped evidence</small>");
    expect(html).toContain(">Gas<small>Unavailable / unknown</small>");
    expect(html).toContain("Not reproduced in this report:");
    expect(html).toContain("Contours 2016");
    expect(html).toContain("Wastewater Pipes");
    expect(html).toContain("Water Pipes");
  });

  it("attributes licensed Council stormwater and discloses report map modifications", () => {
    const sourceUrl =
      "https://www.arcgis.com/home/item.html?id=cdea334c7ba9498c89b70977569007d7";
    const precedingSources = Array.from({ length: 7 }, (_, index) => ({
      provider: "LINZ",
      dataset: `Report source ${index + 1}`,
      status: "available",
      evidenceUse: "report_allowed",
      licence: "Creative Commons Attribution 4.0 International",
      attribution: "Land Information New Zealand (LINZ), CC BY 4.0",
      sourceUrl: "https://www.linz.govt.nz/",
      retrievedAt: "2026-08-11T00:00:00.000Z",
    }));
    const html = renderPreliminaryReportHtml(
      buildTestPreliminaryReport({
        layers: [
          {
            id: "public_stormwater_assets",
            provider: "Auckland Council",
            dataset: "Stormwater Pipe",
            evidenceUse: "report_allowed",
            state: "returned",
            confidence: "high",
            attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
            sourceUrl,
          },
        ],
        sources: [
          ...precedingSources,
          {
            provider: "Auckland Council",
            dataset: "Stormwater Pipe",
            status: "available",
            evidenceUse: "report_allowed",
            licence: "Creative Commons Attribution 4.0 International",
            attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
            sourceUrl,
            retrievedAt: "2026-08-11T00:00:00.000Z",
          },
        ],
      }),
    );
    const pageTwo = html.slice(
      html.indexOf("Page 2 of 3"),
      html.indexOf("Page 3 of 3"),
    );
    const pageOne = html.slice(
      html.indexOf("Page 1 of 3"),
      html.indexOf("Page 2 of 3"),
    );

    expect(html).toContain(">Stormwater<small>Mapped</small>");
    expect(html).toContain("Healthy Waters, Auckland Council, CC BY 4.0");
    expect(html).toContain(sourceUrl);
    expect(html).toContain(
      'href="https://creativecommons.org/licenses/by/4.0/legalcode"',
    );
    expect(html).toContain("Retrieved 11 Aug 2026");
    expect(html).toContain(
      "Mapped provider geometry was clipped to the property assessment area and restyled for this report.",
    );
    expect(html).toContain(
      "Auckland Council stormwater is indicative only and supplied without accuracy or fitness warranty. Independently verify onsite before design or works. Not for legal disputes. No Auckland Council endorsement is implied.",
    );
    expect(pageTwo).not.toContain(
      "Land Information New Zealand (LINZ), CC BY 4.0",
    );
    expect(
      pageTwo.match(/Healthy Waters, Auckland Council, CC BY 4\.0/g),
    ).toHaveLength(1);
    expect(pageOne.indexOf("Map attribution")).toBeGreaterThan(
      pageOne.indexOf('alt="Saved property and pool map"'),
    );
    expect(pageOne.indexOf("Map attribution")).toBeLessThan(
      pageOne.indexOf("<footer>"),
    );
    expect(pageTwo.indexOf("Map attribution")).toBeGreaterThan(
      pageTwo.indexOf('alt="Saved property and pool map"'),
    );
    expect(pageTwo.indexOf("Map attribution")).toBeLessThan(
      pageTwo.indexOf("Feasibility category status"),
    );
  });

  it("preserves every exact source link when the report needs a source appendix", () => {
    const generalSources = Array.from({ length: 9 }, (_, index) => ({
      provider: "LINZ",
      dataset: `Report source ${index + 1}`,
      status: "available",
      evidenceUse: "report_allowed",
      licence: "Creative Commons Attribution 4.0 International",
      attribution: "Land Information New Zealand (LINZ), CC BY 4.0",
      sourceUrl: `https://example.test/source-${index + 1}`,
      retrievedAt: "2026-08-11T00:00:00.000Z",
    }));
    const councilSources = [
      ["Stormwater Pipe", "cdea334c7ba9498c89b70977569007d7"],
      ["Stormwater Manhole and Chamber", "dab6f385653f4f899715465dcbd6c849"],
      ["Stormwater Catchpit", "91bc332f958b4b5b97f9e93ee6f9abc1"],
      ["Stormwater Watercourse", "0ecd434661f74bf980e940cf6f699c99"],
    ].map(([dataset, itemId]) => ({
      provider: "Auckland Council",
      dataset,
      status: "available",
      evidenceUse: "report_allowed",
      licence: "Creative Commons Attribution 4.0 International",
      attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
      sourceUrl: `https://www.arcgis.com/home/item.html?id=${itemId}`,
      retrievedAt: "2026-08-11T00:00:00.000Z",
    }));
    const html = renderPreliminaryReportHtml(
      buildTestPreliminaryReport({
        layers: [
          ["public_stormwater_assets", "Stormwater Pipe"],
          ["manholes", "Stormwater Manhole and Chamber"],
          ["catchpits", "Stormwater Catchpit"],
          ["watercourses", "Stormwater Watercourse"],
        ].map(([id, dataset]) => ({
          id,
          provider: "Auckland Council",
          dataset,
          evidenceUse: "report_allowed",
          state: "returned" as const,
          confidence: "high",
          attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
          sourceUrl:
            councilSources.find((source) => source.dataset === dataset)
              ?.sourceUrl ?? null,
        })),
        sources: [...generalSources, ...councilSources],
      }),
    );
    const pageTwo = html.slice(
      html.indexOf("Page 2 of 4"),
      html.indexOf("Page 3 of 4"),
    );
    const sourceAppendix = html.slice(html.indexOf("Page 4 of 4"));

    expect(html.match(/<section class="page">/g)).toHaveLength(4);
    for (const source of councilSources) {
      expect(pageTwo).toContain(`href="${source.sourceUrl}"`);
    }
    expect(pageTwo).not.toContain("Report source 1");
    expect(sourceAppendix).toContain("Stormwater Watercourse");
    expect(sourceAppendix).toContain(councilSources.at(-1)?.sourceUrl);
  });

  it("renders through the serverless Puppeteer and Chromium adapter contract", async () => {
    vi.stubEnv("VERCEL", "1");
    try {
      const pdfFixture = Buffer.from("%PDF-1.4\n%%EOF", "latin1");
      const page = {
        emulateMediaType: vi.fn(async () => undefined),
        on: vi.fn(),
        pdf: vi.fn(async () => new Uint8Array(pdfFixture)),
        setContent: vi.fn(async () => undefined),
        setRequestInterception: vi.fn(async () => undefined),
      };
      launchBrowser.mockResolvedValue({
        close: vi.fn(async () => undefined),
        newPage: vi.fn(async () => page),
      });
      const report = buildSavedPreliminaryReport({
        submission,
        reference: "GF-2026-000123",
        createdAt: "2026-07-29T02:03:04.000Z",
      });

      const pdf = await generatePreliminaryReportPdf(report);

      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(resolveChromiumExecutablePath).toHaveBeenCalledOnce();
      expect(launchBrowser).toHaveBeenCalledWith({
        args: ["--disable-dev-shm-usage"],
        executablePath: "/opt/chromium",
        headless: "shell",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
