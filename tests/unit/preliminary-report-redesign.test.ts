import { describe, expect, it } from "vitest";
import {
  buildSavedPreliminaryReport,
  preliminaryReportFilename,
} from "@/modules/reporting/preliminary-report";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { buildTestPersistedAssessmentSubmission } from "../fixtures/preliminary-report";

const createdAt = "2026-08-13T02:00:00.000Z";

function buildReport(
  mutate?: (
    submission: ReturnType<typeof buildTestPersistedAssessmentSubmission>,
  ) => void,
) {
  const submission = buildTestPersistedAssessmentSubmission(
    `redesign-${Math.random().toString(16).slice(2)}`,
  );
  mutate?.(submission);
  return buildSavedPreliminaryReport({
    submission,
    reference: "GF-2026-000019",
    createdAt,
  });
}

describe("canonical homeowner feasibility report", () => {
  it("uses persisted layout identity and preserves a neutral historical fallback", () => {
    const named = buildReport();
    const historical = buildReport((submission) => {
      submission.poolLayout.layoutId = null;
      submission.poolLayout.layoutName = "Saved pool layout";
      submission.poolLayout.lengthMetres = 6.5;
      submission.poolLayout.widthMetres = 3;
    });

    expect(named.pool).toMatchObject({
      layoutId: "compact",
      layoutName: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    });
    expect(historical.pool).toMatchObject({
      layoutId: null,
      layoutName: "Saved pool layout",
      lengthMetres: 6.5,
      widthMetres: 3,
    });
  });

  it("keeps normal later-stage verification separate from a green overall result", () => {
    const report = buildReport((submission) => {
      submission.report.feasibilityState = "no_warning";
      submission.report.summary = "No mapped conflict was identified.";
      submission.warnings = [];
      submission.report.reportData.risks = [
        {
          id: "unverified_legal_and_site_information",
          category: "Legal and site due diligence",
          title: "Legal interests and site conditions remain unverified",
          severity: "high",
          evidence: "Title, geotechnical and utility information is not known.",
          source: "Saved desktop assessment",
          confidence: "unavailable",
          impact: "Later checks may change the design.",
          action: "Complete the later checks.",
          specialistReviewRequired: true,
        },
      ];
    });

    expect(report.overall.status).toBe("green");
    expect(report.keyFindings[0]?.severity).toBe("green");
    expect(report.laterVerification).toContain(
      "Current title and registered easements",
    );
    expect(report.laterVerification).toContain(
      "Geotechnical and groundwater conditions",
    );
  });

  it("makes missing critical property information incomplete and never green", () => {
    const report = buildReport((submission) => {
      submission.addressEvidence.boundaryStatus = "unavailable";
      submission.report.feasibilityState = "no_warning";
      submission.warnings = [];
    });

    expect(report.overall).toMatchObject({
      status: "unknown",
      headline: "Assessment incomplete",
      recommendedStage: "Confirm property information",
    });
    expect(report.assessments.pool_fit.status).toBe("unknown");
  });

  it("makes invalid saved pool geometry incomplete and never green", () => {
    const report = buildReport((submission) => {
      submission.report.feasibilityState = "no_warning";
      submission.warnings = [];
      submission.poolLayout.shellGeometry = {
        type: "Polygon",
        coordinates: [],
      };
    });

    expect(report.overall).toMatchObject({
      status: "unknown",
      headline: "Assessment incomplete",
      recommendedStage: "Confirm property information",
    });
    expect(report.assessments.pool_fit.status).toBe("unknown");
  });

  it("allows a red utility category to produce an amber overall result when the proposal remains worth investigating", () => {
    const report = buildReport((submission) => {
      submission.report.reportData.risks = [
        {
          id: "major_mapped_infrastructure",
          category: "Underground services",
          title: "Major mapped infrastructure affects apparent usable areas",
          severity: "high",
          evidence: "A mapped wastewater pipe is close to the proposed pool.",
          source: "Watercare / Wastewater assets",
          confidence: "limited",
          impact: "The position may need to move.",
          action:
            "Confirm the mapped wastewater asset location and applicable requirements.",
          specialistReviewRequired: true,
        },
      ];
      submission.layerStates = [
        {
          provider: "Watercare",
          dataset: "Wastewater assets",
          datasetId: "wastewater_assets",
          status: "returned",
          confidence: "medium",
        },
      ];
    });

    expect(report.overall.status).toBe("amber");
    expect(report.assessments.water_wastewater.status).toBe("red");
    expect(report.keyFindings[0]).toMatchObject({
      severity: "red",
      category: "water",
    });
    expect(report.nextSteps[0]?.title).toBe(
      "Verify water and wastewater infrastructure",
    );
  });

  it("uses red overall only for a blocked current layout", () => {
    const report = buildReport((submission) => {
      submission.report.feasibilityState = "blocked";
      submission.report.summary =
        "The current construction envelope conflicts with mapped evidence.";
      submission.warnings = [
        {
          state: "blocked",
          code: "POOL_BLOCKED",
          title: "Pool position blocked",
          message:
            "The current construction envelope conflicts with mapped evidence.",
        },
      ];
    });

    expect(report.overall).toMatchObject({
      status: "red",
      headline: "Potential Constraint",
      recommendedStage: "Review pool position",
    });
  });

  it("uses saved placement-layer findings for the short category statuses and one combined key finding", () => {
    const report = buildReport((submission) => {
      submission.report.feasibilityState = "blocked";
      submission.report.summary =
        "The pool overlaps reliable mapped stormwater pipe infrastructure. Mapped wastewater pipe position also needs checking.";
      submission.warnings = [
        {
          state: "blocked",
          code: "POOL_BLOCKED",
          title: "Blocked",
          message: submission.report.summary,
        },
      ];
      submission.report.reportData.placementLayerFindings = [
        {
          key: "public_stormwater_assets",
          dataset: "Stormwater Pipes",
          category: "stormwater",
          status: "potential_constraint",
          evidence: "reliable",
        },
        {
          key: "wastewater_assets",
          dataset: "Wastewater Pipes",
          category: "water_wastewater",
          status: "further_investigation",
          evidence: "needs_checking",
        },
      ];
    });

    expect(report.assessments.pool_fit.status).toBe("red");
    expect(report.assessments.stormwater.status).toBe("red");
    expect(report.assessments.water_wastewater.status).toBe("amber");
    expect(report.keyFindings[0]).toMatchObject({
      id: "pool_position_review",
      category: "pool_fit",
      severity: "red",
      title: "Pool position needs review",
      clientSummary:
        "The pool overlaps reliable mapped stormwater pipe infrastructure. Mapped wastewater pipe position also needs checking.",
    });
    expect(
      report.keyFindings.filter((finding) =>
        finding.id.startsWith("placement_layer:"),
      ),
    ).toHaveLength(0);
  });

  it("shows gas and electricity separately in assessments and key findings", () => {
    const report = buildReport((submission) => {
      submission.report.feasibilityState = "blocked";
      submission.report.summary =
        "The pool overlaps reliable mapped electricity and gas infrastructure.";
      submission.warnings = [
        {
          state: "blocked",
          code: "POOL_BLOCKED",
          title: "Blocked",
          message: submission.report.summary,
        },
      ];
      submission.report.reportData.placementLayerFindings = [
        {
          key: "electricity_feeder_lines",
          dataset: "Electricity Distribution Feeder Network",
          category: "electricity",
          status: "potential_constraint",
          evidence: "reliable",
        },
        {
          key: "gas_distribution_lines",
          dataset: "Gas Distribution Network",
          category: "gas",
          status: "further_investigation",
          evidence: "needs_checking",
        },
      ];
    });

    expect(report.assessments.electricity.status).toBe("red");
    expect(report.assessments.gas.status).toBe("amber");
    expect(report.keyFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "electricity",
          title: "Electricity infrastructure near the proposed pool",
        }),
        expect.objectContaining({
          category: "gas",
          title: "Gas infrastructure near the proposed pool",
        }),
      ]),
    );
  });

  it("does not expose internal-reference vector geometry in the homeowner report", () => {
    const report = buildReport((submission) => {
      submission.layerStates = [
        {
          provider: "Internal provider",
          dataset: "Internal utility reference",
          datasetId: "internal_utility_reference",
          status: "internal_reference_only",
          geometry: {
            type: "LineString",
            coordinates: [
              [174.7599, -36.85],
              [174.7601, -36.85],
            ],
          },
        },
      ];
      submission.report.reportData.provenance.datasets = [
        {
          id: "internal_utility_reference",
          provider: "Internal provider",
          dataset: "Internal utility reference",
          datasetIdentifier: "internal_utility_reference",
          status: "success",
          evidenceUse: "internal_reference",
          retrievedAt: createdAt,
          datasetDate: null,
          licence: "Internal reference only",
          attribution: null,
          confidence: "limited",
          availabilityNote: null,
        },
      ];
    });

    expect(report.layers[0]).toMatchObject({
      evidenceUse: "internal_reference",
      geometry: null,
    });
  });

  it("renders one saved map and assessed findings on page two", () => {
    const report = buildReport();
    const html = renderCanonicalPreliminaryReportHtml(report);

    expect(html.match(/<section class="page(?: page-two)?">/g)).toHaveLength(3);
    expect(html.match(/<img class="map"/g)).toHaveLength(1);
    const constraintsPage = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelectorAll(".page")[1]?.outerHTML;
    expect(constraintsPage).not.toContain('class="map-panel"');
    expect(constraintsPage).toContain('class="assessment-grid"');
    expect(constraintsPage).toContain('class="needs-checking"');
    expect(html).not.toContain("Page 1 of 3");
    expect(html).not.toContain("Page 2 of 3");
    expect(html).not.toContain("Page 3 of 3");
    expect(html).toContain(`${report.reference} - 1/3`);
    expect(html).toContain(`${report.reference} - 2/3`);
    expect(html).toContain(`${report.reference} - 3/3`);
    expect(html).toContain(`<h3>${report.property.address}</h3>`);
    expect(html).toContain("At a glance");
    expect(html).not.toContain("Feasibility score");
    expect(html).not.toContain("Scenario results");
    expect(html).toContain("What we checked");
    expect(html).toContain("Key findings");
    expect(html).toContain("Still needs checking");
    expect(html).toContain("Recommended next stage");
    expect(html).toContain("What your pool builder will confirm");
    expect(html).toContain("Arrange an onsite visit with a pool builder");
    expect(html).toContain(report.overall.summary);
    expect(html).toContain(report.overall.recommendedStage);
    expect(html).not.toContain("Mapping information &amp; licences");
    expect(html).toContain("PoolReady");
    expect(html).toContain("Powered by Blue Haven");
    expect(html).not.toContain('alt="Blue Haven"');
    expect(html).toContain("Captured map layers");
    expect(html).toContain('class="map-legend"');
    expect(html.lastIndexOf('class="map-legend"')).toBeGreaterThan(
      html.lastIndexOf('class="map-visual"'),
    );
    expect(html).toContain(
      ".map-legend-list{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))",
    );
    expect(html).toContain("Mapped property boundary");
    expect(html).toContain(report.keyFindings[0]!.title);
    expect(html).toContain("Preliminary assessment");
    expect(html).toContain("Preliminary assessment only.");
    expect(html).not.toContain("Evidence to confirm");
    expect(html).toContain(
      "Preliminary Feasibility Report — indicative desktop screening",
    );
    expect(html).not.toMatch(/provider error|query status|returned|ArcGIS/i);
    expect(html).not.toContain("Page 4");
    const overallRule = html.match(/\.overall\{([^}]*)\}/)?.[1];
    expect(overallRule).not.toContain("background");
    expect(overallRule).not.toContain("border-radius");
  });

  it("keeps excavation and access detail on page two without changing page three", () => {
    const route = {
      type: "LineString" as const,
      coordinates: [
        [174.7598, -36.8502],
        [174.76, -36.85],
      ] as [number, number][],
    };
    const report = buildReport();
    report.reportAudience = "pool_builder";
    report.constructability = buildConstructabilitySnapshot({
      answers: {
        version: 1,
        estimatedDepthMetres: 1.5,
        excavationSideAllowanceMetres: 0.3,
        route: { provenance: "confirmed", geometry: route },
        accessConditions: ["gate_or_narrow_passage"],
        nearbyFeatures: ["none_of_these"],
      },
      suggestedRoute: route,
      routePolicyVersion: 1,
      routeFacts: {
        valid: true,
        length: { status: "assessed", value: 18.4 },
        elevationChange: { status: "assessed", value: 1.2 },
        steepestGradient: { status: "assessed", value: 8.5 },
        parcelDeparture: { status: "assessed", value: false },
        buildings: { status: "assessed", value: false },
        services: { status: "not_assessed", reason: "data_unavailable" },
      },
      excavation: {
        dimensions: { lengthMetres: 6.5, widthMetres: 3 },
        terrainAdjustment: "available_separate",
      },
      mappedEvidence: [
        {
          id: "mapped-access",
          category: "access_excavation",
          status: "no_concern",
          provider: "Auckland Council",
          dataset: "Mapped access check",
        },
      ],
      providerAvailability: [
        {
          category: "access_excavation",
          provider: "Auckland Council",
          dataset: "Mapped access check",
          status: "available",
        },
      ],
    });

    const pages = new DOMParser()
      .parseFromString(
        renderCanonicalPreliminaryReportHtml(report),
        "text/html",
      )
      .querySelectorAll(".page");
    const pageTwo = pages[1];
    const pageThree = pages[2];

    expect(pageTwo?.textContent).toContain("Site constructability");
    expect(pageTwo?.textContent).toContain(
      "Excavation and construction access",
    );
    expect(
      pageTwo?.querySelector(".constructability-card.access_excavation"),
    ).not.toBeNull();
    expect(pageTwo?.textContent).toContain("Estimated pool depth");
    expect(pageTwo?.textContent).toContain(
      "300 mm selected side-clearance scenario",
    );
    expect(pageTwo?.textContent).toContain("Route length");
    expect(pageTwo?.textContent).toContain("Route elevation change");
    expect(pageTwo?.textContent).toContain("1.2 m");
    expect(pageTwo?.textContent).toContain("Steepest route gradient");
    expect(renderCanonicalPreliminaryReportHtml(report)).toContain(
      ".constructability-card{--card-heading-size:12pt;--card-body-size:8pt",
    );
    expect(renderCanonicalPreliminaryReportHtml(report)).toContain(
      ".constructability-card h3,.constructability-card h4{font-size:var(--card-heading-size)",
    );
    expect(renderCanonicalPreliminaryReportHtml(report)).toContain(
      "p,li{font-size:8pt",
    );
    expect(renderCanonicalPreliminaryReportHtml(report)).toContain(
      ".assessment-card h2{font-size:12pt",
    );
    expect(renderCanonicalPreliminaryReportHtml(report)).toContain(
      ".recommended-stage h2{font-size:12pt",
    );
    expect(renderCanonicalPreliminaryReportHtml(report)).toContain(
      ".report-brand span{color:var(--report-muted);font-size:8pt",
    );
    expect(renderCanonicalPreliminaryReportHtml(report)).toMatch(
      /footer\{[^}]*font-size:8pt\}/,
    );
    expect(pageTwo?.textContent).toContain("Mapped evidence");
    expect(pageTwo?.textContent).toContain("Your Site answer");
    expect(pageTwo?.textContent).toContain("Saved route analysis");
    expect(pageTwo?.textContent).toContain("Provider availability");
    expect(pageTwo?.textContent).toContain(
      "Mapped evidence and your Site answer are both retained",
    );
    expect(pageTwo?.textContent).toContain(
      "Indicative planning volumes only — not a quote, specification or upper bound. These figures use your selected side clearance but exclude base preparation, drainage, terrain, services and installation method. Confirm final excavation requirements onsite.",
    );
    expect(pageTwo?.textContent).not.toContain("Firth");
    expect(pageTwo?.textContent).not.toContain(
      "user-selected-side-clearance-v1",
    );
    expect(
      pageTwo?.querySelector(".constructability-card.access_excavation")
        ?.textContent,
    ).not.toContain("Saved assumption");
    expect(
      pageTwo?.querySelector(".constructability-card.access_excavation")
        ?.textContent,
    ).toContain("Confirm access, excavation and ground conditions onsite");
    expect(pageThree?.textContent).not.toContain("Site constructability");
    expect(
      Array.from(pageThree?.querySelectorAll("h2") ?? [], (heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual([
      "Recommended next stage",
      "Mapping information & licences",
      "Assumptions and limitations",
      "Preliminary assessment",
    ]);
  });

  it("identifies a user-adjusted clearance without exposing internal source notes", () => {
    const report = buildReport();
    report.reportAudience = "pool_builder";
    report.constructability = buildConstructabilitySnapshot({
      answers: {
        version: 1,
        estimatedDepthMetres: 1.5,
        excavationSideAllowanceMetres: 0.2,
        route: { provenance: "uncertain", geometry: null },
        accessConditions: ["none_of_these"],
        nearbyFeatures: ["none_of_these"],
      },
      excavation: {
        dimensions: { lengthMetres: 6.5, widthMetres: 3 },
        terrainAdjustment: "available_separate",
      },
    });

    const accessCard = new DOMParser()
      .parseFromString(
        renderCanonicalPreliminaryReportHtml(report),
        "text/html",
      )
      .querySelector(".constructability-card.access_excavation");

    expect(accessCard?.textContent).toContain(
      "200 mm selected side-clearance scenario",
    );
    expect(accessCard?.textContent).toContain(
      "Indicative planning volumes only — not a quote, specification or upper bound. These figures use your selected side clearance but exclude base preparation, drainage, terrain, services and installation method. Confirm final excavation requirements onsite.",
    );
    expect(accessCard?.textContent).not.toContain("Firth-derived");
    expect(accessCard?.textContent).not.toContain(
      "user-selected-side-clearance-v1",
    );
  });

  it("prints the generated timestamp on every page", () => {
    const pages = new DOMParser()
      .parseFromString(
        renderCanonicalPreliminaryReportHtml(buildReport()),
        "text/html",
      )
      .querySelectorAll(".page");

    expect(pages).toHaveLength(3);
    for (const page of pages) {
      expect(page.textContent).toContain("13 Aug 2026, 2:00 pm");
      expect(
        page.querySelector(
          ".report-heading strong, .continuation-header span:last-child",
        )?.textContent,
      ).toBe("Preliminary Feasibility Report");
    }
  });

  it("retains specific missing information without adding it to page three", () => {
    const report = buildReport((submission) => {
      submission.report.reportData.missingInformation = [
        {
          id: "title_review",
          label: "Current title and registered easements",
          status: "unverified",
        },
        {
          id: "driveway_review",
          label: "Confirm driveway clearance onsite",
          status: "unverified",
        },
      ];
    });
    const html = renderCanonicalPreliminaryReportHtml(report);
    const pageThree = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelectorAll(".page")[2];
    expect(report.missingInformation.map((item) => item.label)).toEqual([
      "Current title and registered easements",
      "Confirm driveway clearance onsite",
    ]);
    expect(report.laterVerification).toContain(
      "Geotechnical and groundwater conditions",
    );
    expect(
      Array.from(pageThree?.querySelectorAll("h2") ?? [], (heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual([
      "Recommended next stage",
      "What your pool builder will confirm",
      "Recommended next step",
      "Preliminary assessment",
    ]);
    expect(pageThree?.textContent).not.toContain(
      "Confirm driveway clearance onsite",
    );
  });

  it("shows the saved layer legend and pool-shell clearances below the PDF map", () => {
    const shownReport = buildReport();
    shownReport.reportAudience = "pool_builder";
    const shown = renderCanonicalPreliminaryReportHtml(shownReport);
    expect(shown).toContain("Captured map layers");
    expect(shown).toContain('class="map-legend"');
    expect(shown).toContain("Indicative mapped pool-shell clearances");
    expect(shown).toMatch(/Side 1: [\d.]+ m/);
    expect(shown).toMatch(/Side 4: [\d.]+ m/);

    const hiddenReport = buildReport((submission) => {
      submission.poolLayout.clearancesVisible = false;
    });
    hiddenReport.reportAudience = "pool_builder";
    const hidden = renderCanonicalPreliminaryReportHtml(hiddenReport);
    expect(hidden).not.toContain("Indicative mapped pool-shell clearances");
  });

  it("uses a human-readable address-based PDF filename", () => {
    const report = buildReport();
    expect(preliminaryReportFilename(report)).toBe(
      "preliminary-pool-feasibility-1-mt-249-test-street.pdf",
    );
  });
});
