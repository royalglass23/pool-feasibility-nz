import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeownerSubmissionForm } from "@/components/homeowner-submission-form";
import { SavedAssessmentReportPanel } from "@/components/saved-assessment-report-panel";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

const trackAnonymousFunnelEvent = vi.hoisted(() => vi.fn());

vi.mock("@/modules/anonymous-funnel-analytics", () => ({
  trackAnonymousFunnelEvent,
}));

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

const validPoolGeometry = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [174.7599, -36.8501],
        [174.7601, -36.8501],
        [174.7601, -36.8499],
        [174.7599, -36.8499],
        [174.7599, -36.8501],
      ],
    ],
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  trackAnonymousFunnelEvent.mockReset();
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
            reportAccessToken: "saved-report-access-token",
            delivery: {
              homeowner: "pending",
              internal_test_report: "pending",
            },
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
          poolGeometry: validPoolGeometry,
          constructionEnvelopeGeometry: validPoolGeometry,
          constructionEnvelopeWithinMappedArea: true,
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

    expect(trackAnonymousFunnelEvent).toHaveBeenCalledWith({
      name: "report_form_viewed",
    });

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
        reportAccessToken: "saved-report-access-token",
        delivery: {
          homeowner: "pending",
          internal_test_report: "pending",
        },
      }),
    );
    expect(trackAnonymousFunnelEvent).toHaveBeenCalledWith({
      name: "report_request_submitted",
    });
    expect(trackAnonymousFunnelEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "report_delivery_outcome" }),
    );
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      assessmentSnapshot: "server-issued-assessment-snapshot",
      poolLayout: { lengthMetres: 6.5, widthMetres: 3 },
    });
    expect(body).not.toHaveProperty("report");
  });

  it("does not submit a placement whose construction envelope is outside the mapped property", async () => {
    const user = userEvent.setup();
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json({ assessment: { report } }, { status: 201 }),
      );
    vi.stubGlobal("fetch", request);

    render(
      <HomeownerSubmissionForm
        assessmentSnapshot="server-issued-assessment-snapshot"
        placement={{
          position: [174.76, -36.85],
          rotationDegrees: 12,
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          poolGeometry: validPoolGeometry,
          constructionEnvelopeGeometry: validPoolGeometry,
          constructionEnvelopeWithinMappedArea: false,
          warning: {
            status: "needs_checking",
            label: "Needs Checking",
            text: "The construction envelope is outside the mapped property.",
            recommendation: null,
            conflictingDatasets: [],
            checkingDatasets: [],
          },
        }}
        onSaved={() => undefined}
      />,
    );

    const form = within(screen.getAllByRole("form").at(-1)!);
    await user.type(form.getByLabelText("Name"), "Jane Homeowner");
    await user.type(form.getByLabelText("Phone"), "021 555 1234");
    await user.type(form.getByLabelText("Email"), "jane@example.com");
    await user.click(form.getByRole("checkbox"));
    await user.click(
      form.getByRole("button", { name: "Save and show my report" }),
    );

    expect(await form.findByRole("alert")).toHaveTextContent(
      "Move or resize the pool so the full construction envelope stays inside the mapped property before saving.",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("collects visitor context and explains Other selections before requesting the report", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assessment: {
            id: "assessment-2",
            reference: report.reference,
            status: "new_enquiry",
            created: true,
            report,
            reportAccessToken: "saved-report-access-token",
            delivery: {
              homeowner: "pending",
              internal_test_report: "pending",
            },
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
          poolGeometry: validPoolGeometry,
          constructionEnvelopeGeometry: validPoolGeometry,
          constructionEnvelopeWithinMappedArea: true,
          warning: {
            status: "needs_checking",
            label: "Needs Checking",
            text: "Some mapped evidence is unavailable or uncertain.",
            recommendation: null,
            conflictingDatasets: [],
            checkingDatasets: [],
          },
        }}
        onSaved={() => undefined}
      />,
    );

    const form = within(screen.getAllByRole("form").at(-1)!);
    expect(form.getByRole("option", { name: "Homeowner" })).toHaveValue(
      "homeowner",
    );
    expect(form.getByRole("option", { name: "Pool Builder" })).toHaveValue(
      "pool_builder",
    );
    await user.type(form.getByLabelText("Name"), "Roxy Builder");
    await user.type(form.getByLabelText("Phone"), "021 555 4567");
    await user.type(form.getByLabelText("Email"), "roxy@example.com");
    await user.selectOptions(form.getByLabelText("I am a"), "other");
    await user.type(
      form.getByLabelText("Tell us who you are"),
      "Landscape architect",
    );
    await user.selectOptions(
      form.getByLabelText("When do you need it?"),
      "other",
    );
    await user.type(
      form.getByLabelText("Tell us when you need it"),
      "Next summer",
    );
    await user.click(form.getByRole("checkbox"));
    await user.click(
      form.getByRole("button", { name: "Save and show my report" }),
    );

    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      homeowner: {
        visitorType: "other",
        visitorTypeOtherDetail: "Landscape architect",
        desiredTiming: "other",
        desiredTimingOtherDetail: "Next summer",
      },
    });
  });

  it("downloads the saved report through the public token boundary with centered button content", async () => {
    const user = userEvent.setup();
    const createObjectUrl = vi.fn(() => "blob:report-pdf");
    const revokeObjectUrl = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectUrl },
      revokeObjectURL: { configurable: true, value: revokeObjectUrl },
    });
    const request = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("/delivery")
          ? Response.json({
              delivery: {
                homeowner: "pending",
                internal_test_report: "failed",
              },
            })
          : new Response(new Blob(["%PDF-public"]), {
              status: 200,
              headers: { "Content-Type": "application/pdf" },
            }),
      ),
    );
    vi.stubGlobal("fetch", request);

    render(
      <SavedAssessmentReportPanel
        assessment={{
          id: "assessment-1",
          reference: report.reference,
          status: "new_enquiry",
          created: true,
          report,
          reportAccessToken: "saved-report-access-token",
          delivery: {
            homeowner: "pending",
            internal_test_report: "failed",
          },
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
    expect(
      screen.getByText("Internal report email: Needs retry"),
    ).toBeVisible();
    const reportMapPanel = screen
      .getByAltText("Saved property and pool map")
      .closest("figure");
    expect(reportMapPanel).toHaveClass(
      "grid",
      "lg:grid-cols-[minmax(0,1fr)_20rem]",
    );
    const mapKey = screen.getByText("Map layers").closest("figcaption");
    expect(mapKey).not.toBeNull();
    expect(mapKey).toHaveClass("lg:border-l", "lg:border-t-0");
    expect(within(mapKey!).getByText("Mapped property boundary")).toBeVisible();
    expect(within(mapKey!).getByText("Selected pool")).toBeVisible();
    expect(
      within(mapKey!).getByText("Indicative investigation buffer"),
    ).toBeVisible();

    const download = screen.getByRole("button", { name: "Download PDF" });
    expect(download).toHaveClass("items-center", "justify-center");
    expect(
      screen.queryByRole("link", { name: "Download PDF" }),
    ).not.toBeInTheDocument();

    await user.click(download);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/api/public/assessments/report/pdf",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ accessToken: "saved-report-access-token" }),
        }),
      ),
    );
  });
});
