import { describe, expect, it } from "vitest";
import {
  buildSavedPreliminaryReport,
  preliminaryReportFilename,
} from "@/modules/reporting/preliminary-report";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
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
    expect(html).toContain("Assumptions and limitations");
    expect(html).toContain(report.overall.summary);
    expect(html).toContain(report.overall.recommendedStage);
    expect(html).toContain("Mapping information &amp; licences");
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
      "Mapping information & licences",
      "Assumptions and limitations",
      "Preliminary assessment",
    ]);
    expect(pageThree?.textContent).not.toContain(
      "Confirm driveway clearance onsite",
    );
  });

  it("shows the saved layer legend and pool-shell clearances below the PDF map", () => {
    const shown = renderCanonicalPreliminaryReportHtml(buildReport());
    expect(shown).toContain("Captured map layers");
    expect(shown).toContain('class="map-legend"');
    expect(shown).toContain("Indicative mapped pool-shell clearances");
    expect(shown).toMatch(/Side 1: [\d.]+ m/);
    expect(shown).toMatch(/Side 4: [\d.]+ m/);

    const hidden = renderCanonicalPreliminaryReportHtml(
      buildReport((submission) => {
        submission.poolLayout.clearancesVisible = false;
      }),
    );
    expect(hidden).not.toContain("Indicative mapped pool-shell clearances");
  });

  it("uses a human-readable address-based PDF filename", () => {
    const report = buildReport();
    expect(preliminaryReportFilename(report)).toBe(
      "preliminary-pool-feasibility-1-mt-249-test-street.pdf",
    );
  });
});
