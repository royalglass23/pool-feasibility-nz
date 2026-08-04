import { describe, expect, it, vi } from "vitest";
import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import {
  buildSavedPreliminaryReport,
  preliminaryReportFilename,
  renderPreliminaryReportHtml,
} from "@/modules/reporting/preliminary-report";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";
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
      dataset: "Wastewater services",
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

  it("keeps production PDF rendering behind the deployment evidence gate", async () => {
    vi.stubEnv("VERCEL", "1");
    try {
      const report = buildSavedPreliminaryReport({
        submission,
        reference: "GF-2026-000123",
        createdAt: "2026-07-29T02:03:04.000Z",
      });

      await expect(generatePreliminaryReportPdf(report)).rejects.toThrow(
        "production PDF runtime is pending its deployment evidence gate",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
