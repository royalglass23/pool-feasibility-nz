import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HomeownerFeasibilityReportView } from "@/components/homeowner-feasibility-report-view";
import { StaffAssessmentDashboard } from "@/components/staff/staff-assessment-dashboard";
import { StaffAssessmentDetail } from "@/components/staff/staff-assessment-detail";
import type { StaffAssessmentSummary } from "@/modules/staff/staff-assessment-read-model";
import {
  SAVED_MAP_IMAGE_DATA_URL,
  savedPreliminaryReport,
  staffAssessmentDetail,
} from "../fixtures/staff-assessment";

afterEach(cleanup);

describe("staff assessment dashboard", () => {
  it("gives staff a clear empty state when no assessments have been saved", () => {
    render(<StaffAssessmentDashboard assessments={[]} />);

    expect(
      screen.getByRole("heading", { name: "No saved assessments yet" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "New homeowner submissions will appear here once they are received.",
      ),
    ).toBeVisible();
  });

  it("shows staff a searchable, date-sortable assessment table", async () => {
    const user = userEvent.setup();
    const base = {
      homeownerAddress: "1 Test Street, Auckland",
      homeownerPhone: "021 555 1234",
      desiredTiming: "3_months",
      createdAt: new Date("2026-07-29T01:30:00.000Z"),
      poolLayout: {
        lengthMetres: 6.5,
        widthMetres: 3,
        rotationDegrees: 24,
      },
      evidenceCount: 2,
    } satisfies Pick<
      StaffAssessmentSummary,
      | "homeownerAddress"
      | "homeownerPhone"
      | "desiredTiming"
      | "createdAt"
      | "poolLayout"
      | "evidenceCount"
    >;
    const assessments: StaffAssessmentSummary[] = [
      {
        ...base,
        id: "no-warning",
        reference: "GF-2026-000001",
        homeownerName: "Nora Warning",
        feasibilityState: "no_warning",
      },
      {
        ...base,
        id: "needs-checking",
        reference: "GF-2026-000002",
        homeownerName: "Casey Checking",
        homeownerPhone: "021 555 5678",
        createdAt: new Date("2026-07-28T01:30:00.000Z"),
        feasibilityState: "needs_checking",
      },
      {
        ...base,
        id: "blocked",
        reference: "GF-2026-000003",
        homeownerName: "Blake Blocked",
        homeownerAddress: "2 Other Street, Auckland",
        homeownerPhone: "021 555 9012",
        createdAt: new Date("2026-07-27T01:30:00.000Z"),
        feasibilityState: "blocked",
      },
    ];

    render(<StaffAssessmentDashboard assessments={assessments} />);

    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByText("Nora Warning")).toBeVisible();
    expect(screen.getAllByText("1 Test Street, Auckland")[0]).toBeVisible();
    expect(screen.getByText("021 555 1234")).toBeVisible();
    for (const state of ["No Warning", "Needs Checking", "Blocked"]) {
      expect(screen.getByText(state)).toBeVisible();
    }
    expect(
      screen.getByRole("link", { name: "Open GF-2026-000003" }),
    ).toHaveAttribute("href", "/staff/blocked");

    await user.type(screen.getByRole("searchbox"), "5678");
    expect(screen.getByText("Casey Checking")).toBeVisible();
    expect(screen.queryByText("Nora Warning")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeVisible();

    await user.clear(screen.getByRole("searchbox"));
    await user.click(
      screen.getByRole("button", {
        name: "Sort by date submitted oldest first",
      }),
    );
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Blake Blocked");
  });

  it("paginates at five rows by default and lets staff choose a larger page", async () => {
    const user = userEvent.setup();
    const assessments = Array.from({ length: 6 }, (_, index) => ({
      id: `assessment-${index}`,
      reference: `GF-2026-00000${index}`,
      homeownerName: `Homeowner ${index}`,
      homeownerPhone: `021 555 12${index}`,
      homeownerAddress: `${index} Test Street, Auckland`,
      desiredTiming: "3_months" as const,
      feasibilityState: "no_warning" as const,
      createdAt: new Date(`2026-07-${20 + index}T01:30:00.000Z`),
      poolLayout: { lengthMetres: 6.5, widthMetres: 3, rotationDegrees: 24 },
      evidenceCount: 2,
    }));

    render(<StaffAssessmentDashboard assessments={assessments} />);

    expect(screen.getByText("Showing 1–5 of 6")).toBeVisible();
    expect(screen.queryByText("Homeowner 0")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Homeowner 0")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Rows per page"), "10");
    expect(screen.getByText("Showing 1–6 of 6")).toBeVisible();
  });
});

describe("staff assessment detail", () => {
  it("shows that a legacy visitor type was not captured", () => {
    render(
      <StaffAssessmentDetail
        assessment={{
          ...staffAssessmentDetail,
          visitorType: null,
          visitorTypeOtherDetail: null,
        }}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByText("Not captured")).toBeVisible();
  });

  it("renders saved Other details in plain language", () => {
    render(
      <StaffAssessmentDetail
        assessment={{
          ...staffAssessmentDetail,
          visitorType: "other",
          visitorTypeOtherDetail: "Landscape architect",
          desiredTiming: "other",
          desiredTimingOtherDetail: "Next summer",
        }}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByText("Landscape architect")).toBeVisible();
    expect(screen.getByText("Next summer")).toBeVisible();
  });

  it("renders Pool Builder as the canonical saved visitor type", () => {
    render(
      <StaffAssessmentDetail
        assessment={{
          ...staffAssessmentDetail,
          visitorType: "pool_builder",
          visitorTypeOtherDetail: null,
        }}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByText("Pool Builder")).toBeVisible();
  });

  it("renders the complete shared saved report without assessment edit controls", () => {
    const homeownerView = render(
      <HomeownerFeasibilityReportView
        report={savedPreliminaryReport}
        delivery={{ homeowner: "sent", internal_test_report: "pending" }}
        onBack={() => undefined}
      />,
    );
    expect(
      screen.getByAltText(
        "Saved aerial assessment map showing the mapped property and proposed pool",
      ),
    ).toHaveAttribute("src", SAVED_MAP_IMAGE_DATA_URL);
    homeownerView.unmount();

    render(
      <StaffAssessmentDetail
        assessment={staffAssessmentDetail}
        onBack={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Jane Homeowner" }),
    ).toBeVisible();
    expect(screen.getByText("I am a")).toBeVisible();
    expect(screen.getByText("Homeowner")).toBeVisible();
    expect(
      screen.getByText(savedPreliminaryReport.overall.summary),
    ).toBeVisible();
    expect(
      screen.getByAltText(
        "Saved aerial assessment map showing the mapped property and proposed pool",
      ),
    ).toHaveAttribute("src", savedPreliminaryReport.mapImageDataUrl);
    expect(screen.getByText(/Proposed pool: 6.5 x 3 m/)).toBeVisible();
    expect(
      screen.getByText("Wastewater infrastructure near the proposed pool"),
    ).toBeVisible();
    expect(
      screen.getByText("Verify water and wastewater infrastructure"),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Preliminary Pool Feasibility Report",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Preliminary assessment" }),
    ).toBeVisible();
    expect(screen.queryByText("24°")).not.toBeInTheDocument();
    expect(screen.queryByText(/feasibility score/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /move|rotate|save|edit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the saved Fast Property View capture and records its visible layers", () => {
    const report = structuredClone(savedPreliminaryReport);
    report.layers = [
      {
        id: "wastewater_assets",
        provider: "Watercare",
        dataset: "Wastewater Pipes",
        evidenceUse: "report_allowed",
        state: "returned",
        confidence: "limited",
        attribution: "Watercare",
        sourceUrl: null,
        geometry: {
          type: "LineString",
          coordinates: [
            [174.7599, -36.85],
            [174.7601, -36.85],
          ],
        },
      },
    ];
    report.mapVisibleLayerKeys = ["wastewater_assets"];
    report.mapImageSource = "fast_property_view_capture";

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={{ homeowner: "sent", internal_test_report: "pending" }}
        onBack={() => undefined}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Saved assessment map" }),
    ).toBeVisible();
    expect(screen.getByText("Captured map layers")).toBeVisible();
    expect(screen.getByText(/Saved Fast Property View capture/)).toBeVisible();
    expect(screen.getByText("Wastewater")).toBeVisible();
    expect(screen.getByText("Mapped")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
