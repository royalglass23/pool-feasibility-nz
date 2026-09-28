import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeownerFeasibilityReportView } from "@/components/homeowner-feasibility-report-view";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryClaim,
  type AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
import { assessmentStatusLabel } from "@/modules/reporting/pool-feasibility-report";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

afterEach(cleanup);

describe("web, PDF and email report consistency", () => {
  it("uses a colour-coded description without naming the colour", () => {
    expect(assessmentStatusLabel("red")).toBe("Potential Constraint");
    expect(assessmentStatusLabel("amber")).toBe(
      "Further investigation required",
    );
    expect(assessmentStatusLabel("green")).toBe("Appears suitable");
  });

  it("presents the same saved result without recalculating the assessment", async () => {
    const report = buildTestPreliminaryReport({
      reference: "GF-2026-000019",
      property: { address: "42A Bahari Drive, Rānui, Auckland" },
      pool: { lengthMetres: 6.5, widthMetres: 3 },
      overall: {
        status: "amber",
        headline: "Further investigation required",
        summary:
          "The proposed pool appears feasible, but mapped wastewater infrastructure should be checked before the position is finalised.",
        recommendedStage: "Site verification",
      },
      keyFindings: [
        {
          id: "wastewater-nearby",
          category: "wastewater",
          severity: "red",
          title: "Wastewater infrastructure near the proposed pool",
          clientSummary:
            "Mapped wastewater infrastructure is located close to the proposed pool area.",
        },
      ],
      sources: [
        {
          provider: "Auckland Council",
          dataset: "Stormwater",
          status: "unavailable",
          queryStatus: "unavailable",
          evidenceUse: "unavailable",
          licence: "Not available for this check.",
          attribution: null,
          sourceUrl: null,
          retrievedAt: null,
        },
        {
          provider: "Watercare",
          dataset: "Wastewater",
          status: "error",
          queryStatus: "error",
          evidenceUse: "unavailable",
          licence: "Not available for this check.",
          attribution: null,
          sourceUrl: null,
          retrievedAt: null,
        },
        {
          provider: "Vector",
          dataset: "Electricity",
          status: "empty",
          queryStatus: "empty",
          evidenceUse: "report_allowed",
          licence: "Fixture licence.",
          attribution: null,
          sourceUrl: null,
          retrievedAt: null,
        },
      ],
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={{ homeowner: "sent", internal_test_report: "sent" }}
        onBack={() => undefined}
      />,
    );
    const pdfHtml = renderCanonicalPreliminaryReportHtml(report);

    const send = vi.fn().mockResolvedValue({ id: "email-1" });
    const store: AssessmentDeliveryStore = {
      claim: vi.fn(
        async (_reference, channel): Promise<AssessmentDeliveryClaim | null> =>
          channel === "homeowner"
            ? {
                channel,
                claimToken: "homeowner-claim",
                homeownerName: "Jane Homeowner",
                homeownerPhone: "021 123 4567",
                homeownerEmail: "jane@example.com",
                builderCompanyName: null,
                visitorType: "homeowner",
                visitorTypeOtherDetail: null,
                desiredTiming: "3_months",
                desiredTimingOtherDetail: null,
                additionalInfo: null,
                report,
              }
            : null,
      ),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    await deliverAssessmentReport(report.reference, {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-same-snapshot")),
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: {
        mode: "synthetic_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      },
    });
    const email = send.mock.calls[0]?.[0] as {
      subject: string;
      html: string;
      text: string;
      replyTo: string;
      attachment?: Buffer;
    };

    for (const value of [
      report.reference,
      report.property.address,
      report.overall.summary,
      report.keyFindings[0]!.title,
    ]) {
      expect(pdfHtml).toContain(value);
      expect(email.html).toContain(value);
      expect(email.text).toContain(value);
    }
    const selectedLayout = "Compact — 6.5 x 3 m";
    expect(
      screen.getByText(`Proposed pool: ${selectedLayout}`, { exact: false }),
    ).toBeVisible();
    expect(pdfHtml).toContain(`Proposed pool: ${selectedLayout}`);
    expect(email.html).toContain(selectedLayout);
    expect(email.text).toContain(selectedLayout);
    expect(pdfHtml).toContain(report.overall.recommendedStage);
    // The email invites a reply; the detailed report retains the recommended stage.
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Have questions? Let’s talk it through.");
      expect(body).toContain(
        "Whether it’s about your report, your site or what to do next, simply reply to this email.",
      );
    }
    expect(email.replyTo).toBe("support@bluehaven.nz");
    expect(
      screen.getByRole("heading", {
        name: "Preliminary Pool Feasibility Report",
      }),
    ).toBeVisible();
    expect(screen.getByText(report.property.address)).toBeVisible();
    expect(screen.getByText(report.overall.summary)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "How this assessment works" }),
    ).toBeVisible();
    expect(screen.getByText("Check the mapped evidence")).toBeInTheDocument();
    expect(screen.getByText("Open guide")).toBeVisible();
    expect(
      screen.getByText(/This is not automatically a no\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This is an indicative desktop screen based on mapped information/i,
      ),
    ).toBeVisible();
    expect(screen.queryByText("Evidence to confirm")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Does this property appear worth progressing?"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(report.keyFindings[0]!.title)).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: "Overall assessment",
      }),
    ).toHaveTextContent(report.overall.recommendedStage);
    expect(pdfHtml).toContain(assessmentStatusLabel(report.overall.status));
    expect(pdfHtml).toContain(
      "Confirm property boundaries, services, site levels and approval requirements before design or construction.",
    );
    expect(pdfHtml).not.toContain("Evidence to confirm");
    expect(`${email.html}\n${email.text}`).toContain(
      assessmentStatusLabel(report.overall.status),
    );
    expect(email.subject).toBe(
      "Your Preliminary Pool Feasibility Report - 42A Bahari Drive",
    );
    expect(email.attachment).toEqual(Buffer.from("%PDF-same-snapshot"));
  });

  it.each([
    {
      label: "Custom — 6.5 x 3 m",
      pool: {
        layoutId: "custom" as const,
        layoutName: "Custom",
        lengthMetres: 6.5,
        widthMetres: 3,
      },
    },
    {
      label: "Saved pool layout — 6.5 x 3 m",
      pool: {
        layoutId: null,
        layoutName: "Saved pool layout",
        lengthMetres: 6.5,
        widthMetres: 3,
      },
    },
  ])(
    "keeps $label unchanged across saved projections",
    async ({ label, pool }) => {
      const report = buildTestPreliminaryReport({ pool });
      render(
        <HomeownerFeasibilityReportView
          report={report}
          delivery={{ homeowner: "sent", internal_test_report: "sent" }}
          onBack={() => undefined}
        />,
      );
      const pdfHtml = renderCanonicalPreliminaryReportHtml(report);
      const send = vi.fn().mockResolvedValue({ id: "layout-email" });
      const store: AssessmentDeliveryStore = {
        claim: vi.fn(
          async (
            _reference,
            channel,
          ): Promise<AssessmentDeliveryClaim | null> =>
            channel === "homeowner"
              ? {
                  channel,
                  claimToken: "layout-claim",
                  homeownerName: "Jane Homeowner",
                  homeownerPhone: "021 123 4567",
                  homeownerEmail: "jane@example.com",
                  builderCompanyName: null,
                  visitorType: "homeowner",
                  visitorTypeOtherDetail: null,
                  desiredTiming: "3_months",
                  desiredTimingOtherDetail: null,
                  additionalInfo: null,
                  report,
                }
              : null,
        ),
        markSent: vi.fn(async () => undefined),
        markFailed: vi.fn(async () => undefined),
      };

      await deliverAssessmentReport(report.reference, {
        store,
        renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-layout")),
        send,
        from: "PoolReady <reports@example.com>",
        deliveryEnvironment: {
          mode: "synthetic_test",
          vercelEnvironment: "preview",
          nodeEnvironment: "production",
        },
      });
      const email = send.mock.calls[0]?.[0] as { html: string; text: string };

      expect(
        screen.getByText(`Proposed pool: ${label}`, { exact: false }),
      ).toBeVisible();
      expect(pdfHtml).toContain(`Proposed pool: ${label}`);
      expect(email.html).toContain(label);
      expect(email.text).toContain(label);
    },
  );

  it("keeps saved constructability status and provenance consistent across web, PDF and email", async () => {
    const user = userEvent.setup();
    const route = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85],
        [174.76015, -36.8499],
      ] as [number, number][],
    };
    const report = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      reference: "GF-2026-000343",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          route: { provenance: "confirmed", geometry: route },
          accessConditions: ["rocky_ground"],
          nearbyFeatures: ["fences"],
        },
        suggestedRoute: route,
        routePolicyVersion: 1,
        mappedEvidence: [
          {
            id: "ground-clear",
            category: "terrain_ground",
            status: "no_concern",
            provider: "Auckland DEM",
            dataset: "Indicative terrain",
          },
          {
            id: "barrier-feature",
            category: "barrier",
            status: "concern",
            provider: "Saved placement",
            dataset: "Nearby features",
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
            provider: "Saved placement",
            dataset: "Nearby features",
            status: "available",
          },
          {
            category: "access_excavation",
            provider: "Vector",
            dataset: "Mapped services",
            status: "error",
          },
        ],
        assumptions: ["Route policy v1 retained from the saved assessment."],
        excavation: {
          dimensions: { lengthMetres: 6, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        builderCompanyName="North Shore Pools Ltd"
        delivery={{ homeowner: "sent", internal_test_report: "sent" }}
        onBack={() => undefined}
      />,
    );
    const pdfHtml = renderCanonicalPreliminaryReportHtml(report);
    const send = vi.fn().mockResolvedValue({ id: "email-343" });
    const store: AssessmentDeliveryStore = {
      claim: vi.fn(
        async (_reference, channel): Promise<AssessmentDeliveryClaim | null> =>
          channel === "homeowner"
            ? {
                channel,
                claimToken: "homeowner-343",
                homeownerName: "Jane Homeowner",
                homeownerPhone: "021 123 4567",
                homeownerEmail: "jane@example.com",
                builderCompanyName: null,
                visitorType: "homeowner",
                visitorTypeOtherDetail: null,
                desiredTiming: "3_months",
                desiredTimingOtherDetail: null,
                additionalInfo: null,
                report,
              }
            : null,
      ),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    await deliverAssessmentReport(report.reference, {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-343")),
      send,
      from: "PoolReady <reports@example.com>",
      deliveryEnvironment: {
        mode: "synthetic_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      },
    });
    const email = send.mock.calls[0]?.[0] as { html: string; text: string };

    await user.click(screen.getByRole("tab", { name: "Property findings" }));

    for (const heading of [
      "Terrain and ground conditions",
      "Pool barrier feasibility",
      "Excavation and construction access",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
      expect(pdfHtml).toContain(heading);
      expect(email.html).toContain(heading);
      expect(email.text).toContain(heading);
    }
    expect(screen.getAllByText("Needs checking")).not.toHaveLength(0);
    expect(
      screen.getByText("Company / trading name: North Shore Pools Ltd"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Indicative planning volumes only — not a quote, specification or upper bound. These figures use your selected side clearance but exclude base preparation, drainage, terrain, services and installation method. Confirm final excavation requirements onsite.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("user-selected-side-clearance-v1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Firth masonry guidance"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Apparently rocky ground")).not.toHaveLength(0);
    expect(screen.getByText("27.00 m³")).toBeVisible();
    expect(screen.getByText("35.64 m³")).toBeVisible();
    expect(pdfHtml).toContain("Mapped evidence");
    expect(pdfHtml).toContain("Your Site answer");
    expect(pdfHtml).toContain("27.00 m³");
    expect(pdfHtml).toContain("35.64 m³");
    expect(pdfHtml).toContain("user-selected-side-clearance-v1");
    expect(pdfHtml).toContain("FIR0744-Masonry-Swimming-Pools.pdf");
    expect(pdfHtml).toContain(
      "Base geometry estimate only — terrain adjustment unavailable",
    );
    expect(pdfHtml).not.toMatch(
      /spoil (?:volume|quantity)|price estimate: \$/i,
    );
  });

  it("projects a plain-language saved web report for homeowners", async () => {
    const user = userEvent.setup();
    const report = buildTestPreliminaryReport({
      reportAudience: "homeowner",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.7,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: ["not_sure"],
          nearbyFeatures: ["not_sure"],
        },
        suggestedRoute: null,
        routePolicyVersion: 1,
        mappedEvidence: [],
        providerAvailability: [
          {
            category: "access_excavation",
            provider: "Synthetic services",
            dataset: "Mapped services",
            status: "unavailable",
          },
        ],
        assumptions: ["Internal technical assumption"],
        excavation: {
          dimensions: { lengthMetres: 6, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={{ homeowner: "sent", internal_test_report: "sent" }}
        onBack={() => undefined}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Property findings" }));

    expect(
      screen.getByRole("heading", { name: "Assessment map" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Key findings" })).toBeVisible();
    expect(screen.getAllByText("Not assessed").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "What happens next" }));

    expect(
      screen.getByRole("heading", {
        name: "What your pool builder will confirm",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Arrange an onsite visit with a pool builder."),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Site constructability" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Estimated pool depth")).not.toBeInTheDocument();
    expect(
      screen.queryByText("user-selected-side-clearance-v1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Firth masonry guidance"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Mapping & data information" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    const overview = screen.getByRole("region", { name: "At a glance" });
    expect(within(overview).queryByText("Pool safety barrier")).toBeNull();
    expect(within(overview).queryByText("Construction access")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Property findings" }));
    const findings = screen.getByRole("region", { name: "Site assessment" });
    expect(within(findings).queryByText("Pool safety barrier")).toBeNull();
    expect(within(findings).queryByText("Construction access")).toBeNull();
  });
});
