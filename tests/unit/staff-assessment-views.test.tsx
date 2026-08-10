import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SavedPreliminaryReportView } from "@/components/saved-preliminary-report-view";
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
        "New homeowner submissions will appear here in submitted order.",
      ),
    ).toBeVisible();
  });

  it("shows the required submission fields and text-backed saved-state badges", () => {
    const base = {
      homeownerAddress: "1 Test Street, Auckland",
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
        feasibilityState: "needs_checking",
      },
      {
        ...base,
        id: "blocked",
        reference: "GF-2026-000003",
        homeownerName: "Blake Blocked",
        feasibilityState: "blocked",
      },
    ];

    render(<StaffAssessmentDashboard assessments={assessments} />);

    expect(screen.getByText("Nora Warning")).toBeVisible();
    expect(screen.getAllByText("1 Test Street, Auckland")).toHaveLength(3);
    expect(screen.getAllByText("3 months")).toHaveLength(3);
    expect(screen.getAllByText("29 Jul 2026, 1:30 pm")).toHaveLength(3);
    for (const state of ["No Warning", "Needs Checking", "Blocked"]) {
      expect(
        screen.getByLabelText(
          `${state}: saved 6.5 by 3 metre pool at 24 degrees with 2 evidence records.`,
        ),
      ).toBeVisible();
    }
    expect(
      screen.getByRole("link", { name: "Open GF-2026-000003" }),
    ).toHaveAttribute("href", "/staff/blocked");
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
      <SavedPreliminaryReportView
        report={savedPreliminaryReport}
        delivery={{ homeowner: "sent", internal_test_report: "pending" }}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByAltText("Saved property and pool map")).toHaveAttribute(
      "src",
      SAVED_MAP_IMAGE_DATA_URL,
    );
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
    expect(screen.getByText(savedPreliminaryReport.summary)).toBeVisible();
    expect(screen.getByAltText("Saved property and pool map")).toHaveAttribute(
      "src",
      savedPreliminaryReport.mapImageDataUrl,
    );
    expect(screen.getByText("6.5 m × 3 m")).toBeVisible();
    expect(screen.getByText("24°")).toBeVisible();
    expect(screen.getByText("Mapped wastewater conflict")).toBeVisible();
    expect(screen.getByText(/Move the pool:/)).toBeVisible();
    expect(screen.getByText("Wastewater assets")).toBeVisible();
    expect(screen.getByText(/Auckland Council.*returned.*high/i)).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Preliminary pool feasibility report",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Preliminary desktop assessment only."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /move|rotate|save|edit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
