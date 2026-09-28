import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HomeownerFeasibilityReportView } from "@/components/homeowner-feasibility-report-view";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

afterEach(cleanup);

const delivery = { homeowner: "sent", internal_test_report: "sent" } as const;

describe("saved report views", () => {
  it("exposes exactly three associated tabs with one selected panel", async () => {
    const user = userEvent.setup();
    const report = buildTestPreliminaryReport();
    const originalReport = structuredClone(report);

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Property findings",
      "What happens next",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    const initialPanel = screen.getByRole("tabpanel");
    expect(initialPanel.id).toBe(tabs[0]!.getAttribute("aria-controls"));
    expect(initialPanel).toHaveAttribute("aria-labelledby", tabs[0]!.id);
    expect(
      within(initialPanel).getByRole("region", {
        name: "Overall assessment",
      }),
    ).toBeVisible();

    await user.click(tabs[1]!);

    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(
      within(screen.getByRole("tabpanel")).getByRole("heading", {
        name: "Assessment map",
      }),
    ).toBeVisible();
    expect(report).toEqual(originalReport);
  });

  it("moves selection and focus with arrow, Home, and End keys", async () => {
    const user = userEvent.setup();

    render(
      <HomeownerFeasibilityReportView
        report={buildTestPreliminaryReport()}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    const [overview, findings, next] = screen.getAllByRole("tab");
    overview!.focus();

    await user.keyboard("{ArrowRight}");
    expect(findings).toHaveFocus();
    expect(findings).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-selected", "true");
  });

  it("keeps every permitted warning, failed or uncertain result, and limitation in the Overview", () => {
    const report = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      overall: {
        status: "red",
        headline: "Potential Constraint",
        summary: "A failed placement condition needs specialist review.",
        recommendedStage: "Specialist review",
      },
      keyFindings: [
        {
          id: "failed-clearance",
          category: "pool_fit",
          severity: "red",
          title: "Construction envelope crosses the mapped area",
          clientSummary: "The failed placement condition must be resolved.",
        },
      ],
      limitations: ["Stormwater evidence was not available when saved."],
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.9,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: ["not_sure"],
          nearbyFeatures: ["fences"],
        },
        suggestedRoute: null,
        routePolicyVersion: 1,
        mappedEvidence: [],
        providerAvailability: [],
        assumptions: [],
        excavation: {
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    const overview = screen.getByRole("tabpanel", { name: "Overview" });
    expect(overview).toHaveTextContent(
      "A failed placement condition needs specialist review.",
    );
    expect(overview).toHaveTextContent(
      "Construction envelope crosses the mapped area",
    );
    expect(overview).toHaveTextContent("Not assessed");
    expect(overview).toHaveTextContent("Needs checking");
    expect(overview).toHaveTextContent(
      "Stormwater evidence was not available when saved.",
    );
  });

  it("summarises incomplete constructability evidence for homeowners without technical detail", () => {
    const report = buildTestPreliminaryReport({ reportAudience: "homeowner" });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    const overview = screen.getByRole("tabpanel", { name: "Overview" });
    expect(overview).toHaveTextContent("Site checks were not fully assessed");
    expect(overview).toHaveTextContent(
      "Some saved Site answers or mapped evidence were unavailable or uncertain.",
    );
    expect(overview).not.toHaveTextContent("Pool safety barrier");
    expect(overview).not.toHaveTextContent("Estimated pool depth");
  });

  it("summarises constructability conditions needing checks for homeowners", () => {
    const report = buildTestPreliminaryReport({
      reportAudience: "homeowner",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: ["not_sure"],
          nearbyFeatures: ["none_of_these"],
        },
        suggestedRoute: null,
        routePolicyVersion: 1,
        mappedEvidence: [],
        providerAvailability: [],
        assumptions: [],
      }),
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    const overview = screen.getByRole("tabpanel", { name: "Overview" });
    expect(overview).toHaveTextContent("Site checks need confirmation");
    expect(overview).toHaveTextContent(
      "Saved Site answers or mapped conditions identified potential site considerations.",
    );
    expect(overview).not.toHaveTextContent(
      "Excavation and construction access",
    );
  });

  it("keeps critical saved risks and missing information visible with next actions", async () => {
    const user = userEvent.setup();
    const report = buildTestPreliminaryReport({
      reportAudience: "homeowner",
      risks: [
        {
          id: "unverified-legal-site-information",
          category: "Legal and site due diligence",
          title: "Legal interests and site conditions remain unverified",
          severity: "high",
          evidence:
            "The saved desktop assessment did not include a current title review.",
          source: "Saved desktop assessment",
          confidence: "unavailable",
          impact: "Later checks may change the proposed position.",
          action: "Complete a current title review before concept design.",
          specialistReviewRequired: true,
        },
      ],
      missingInformation: [
        {
          id: "groundwater",
          label: "Groundwater conditions",
          status: "unverified",
        },
      ],
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    const overview = screen.getByRole("tabpanel", { name: "Overview" });
    expect(overview).toHaveTextContent(
      "Legal interests and site conditions remain unverified",
    );
    expect(overview).toHaveTextContent(
      "The saved desktop assessment did not include a current title review.",
    );
    expect(overview).toHaveTextContent("Groundwater conditions");

    await user.click(screen.getByRole("tab", { name: "What happens next" }));
    const next = screen.getByRole("tabpanel", { name: "What happens next" });
    expect(next).toHaveTextContent(
      "Complete a current title review before concept design.",
    );
    expect(next).toHaveTextContent(
      "Confirm groundwater conditions before final design or construction.",
    );
  });

  it("keeps builder-only evidence out of the homeowner views", async () => {
    const user = userEvent.setup();
    const report = buildTestPreliminaryReport({ reportAudience: "homeowner" });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={delivery}
        onBack={() => undefined}
      />,
    );

    expect(
      screen.getByRole("tabpanel", { name: "Overview" }),
    ).not.toHaveTextContent("Pool safety barrier");
    await user.click(screen.getByRole("tab", { name: "Property findings" }));
    expect(
      screen.getByRole("tabpanel", { name: "Property findings" }),
    ).not.toHaveTextContent("Site constructability");
    expect(screen.queryByText("Estimated pool depth")).not.toBeInTheDocument();
  });
});
