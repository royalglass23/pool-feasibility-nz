import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HomeownerSubmissionForm,
} from "@/components/homeowner-submission-form";
import { SavedAssessmentReportPanel } from "@/components/saved-assessment-report-panel";
import {
  buildTestPreliminaryReport,
  TEST_MAP_IMAGE_DATA_URL,
} from "../fixtures/preliminary-report";

const context = {
  addressEvidence: {
    selectedAddressId: "linz-123",
    formattedAddress: "1 Test Street, Auckland",
    latitude: -36.85,
    longitude: 174.76,
    boundaryStatus: "provisional",
    boundaryAreaSquareMetres: 842,
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
  layerStates: [],
  warnings: [
    {
      state: "needs_checking" as const,
      code: "POOL_NEEDS_CHECKING",
      title: "Pool placement needs checking",
      message: "Some mapped evidence is unavailable or uncertain.",
    },
  ],
  recommendations: [],
  report: {
    analysisVersion: "mt-249-v1",
    title: "Preliminary pool feasibility assessment",
    summary: "Some mapped evidence is unavailable or uncertain.",
    feasibilityState: "needs_checking",
    reportData: {
      recommendation: "Confirm the mapped evidence.",
      preliminaryFeasibilityWording: "Preliminary only.",
      risks: [],
      actions: [],
      missingInformation: [],
      limitations: ["Detailed official checks have not been loaded."],
      provenance: { datasets: [] },
    },
  },
};

const report = buildTestPreliminaryReport({
  summary: "Some mapped evidence is unavailable or uncertain.",
  warnings: context.warnings,
  mainRecommendation: "Confirm the saved evidence before concept design.",
  recommendations: [
    {
      phase: "before_quotations",
      priority: 1,
      title: "Review access",
      reason: "Confirm construction access before pricing.",
    },
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("homeowner report submission", () => {
  it("submits the saved map and hands the complete report to the browser immediately", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assessment: {
            id: "assessment-1",
            reference: report.reference,
            status: "new_enquiry",
            created: true,
            report,
            delivery: { homeowner: "pending", servicem8: "pending" },
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", request);

    render(
      <HomeownerSubmissionForm
        assessmentSnapshot="server-issued-assessment-snapshot"
        placement={{
          position: [174.76, -36.85],
          rotationDegrees: 12,
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          poolGeometry: null,
          warning: {
            status: "needs_checking",
            label: "Needs Checking",
            text: "Some mapped evidence is unavailable or uncertain.",
            recommendation: null,
            conflictingDatasets: [],
            checkingDatasets: [],
          },
        }}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Jane Homeowner");
    await user.type(screen.getByLabelText("Phone"), "021 555 1234");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Save and show my report" }),
    );

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({
        id: "assessment-1",
        reference: report.reference,
        status: "new_enquiry",
        created: true,
        report,
        delivery: { homeowner: "pending", servicem8: "pending" },
      }),
    );
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      assessmentSnapshot: "server-issued-assessment-snapshot",
      poolLayout: { lengthMetres: 6.5, widthMetres: 3 },
    });
    expect(body).not.toHaveProperty("report");
  });

  it("shows the returned shared report while both deliveries continue independently", () => {
    render(
      <SavedAssessmentReportPanel
        assessment={{
          id: "assessment-1",
          reference: report.reference,
          status: "new_enquiry",
          created: true,
          report,
          delivery: { homeowner: "pending", servicem8: "failed" },
        }}
        showReport
        onOpen={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Preliminary pool feasibility report",
      }),
    ).toBeVisible();
    expect(screen.getByText("GF-2026-000123")).toBeVisible();
    expect(screen.getByText("1 Test Street, Auckland")).toBeVisible();
    expect(screen.getByText("Pool placement needs checking")).toBeVisible();
    expect(
      screen.getByText("Confirm the saved evidence before concept design."),
    ).toBeVisible();
    expect(screen.getByText("Generated 29 Jul 2026, 2:03 pm")).toBeVisible();
    expect(screen.getByText("Review access:")).toBeVisible();
    expect(screen.getByText("Homeowner email: Processing")).toBeVisible();
    expect(screen.getByText("ServiceM8 forwarding: Needs retry")).toBeVisible();
  });
});
