import {
  act,
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
import {
  buildTestPreliminaryReport,
  TEST_MAP_IMAGE_DATA_URL,
} from "../fixtures/preliminary-report";

const trackAnonymousFunnelEvent = vi.hoisted(() => vi.fn());
const hasAnalyticsConsent = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/modules/anonymous-funnel-analytics", () => ({
  trackAnonymousFunnelEvent,
  hasAnalyticsConsent,
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  trackAnonymousFunnelEvent.mockReset();
  hasAnalyticsConsent.mockReset();
  hasAnalyticsConsent.mockReturnValue(false);
});

describe("homeowner report submission", () => {
  it("shows the saved Pool Builder company name in the web report", () => {
    render(
      <SavedAssessmentReportPanel
        assessment={{
          id: "assessment-builder",
          reference: report.reference,
          status: "new_enquiry",
          created: true,
          builderCompanyName: "North Shore Pools Ltd",
          report: { ...report, reportAudience: "pool_builder" },
          reportAccessToken: "saved-report-access-token",
          delivery: { homeowner: "pending", internal_test_report: "pending" },
        }}
        showReport
        onOpen={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(
      screen.getByText("Company / trading name: North Shore Pools Ltd"),
    ).toBeVisible();
  });

  it.each([
    ["sent", "sent", "delivered"],
    ["sent", "failed", "partial"],
    ["failed", "failed", "failed"],
  ] as const)(
    "tracks confirmed %s/%s delivery as %s without starting delivery",
    async (homeowner, internal_test_report, outcomeCategory) => {
      hasAnalyticsConsent.mockReturnValue(true);
      const request = vi
        .fn()
        .mockResolvedValue(
          Response.json({ delivery: { homeowner, internal_test_report } }),
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
            delivery: { homeowner: "pending", internal_test_report: "pending" },
          }}
          showReport
          onOpen={() => undefined}
          onBack={() => undefined}
        />,
      );

      await waitFor(() =>
        expect(trackAnonymousFunnelEvent).toHaveBeenCalledWith({
          name: "report_delivery_outcome",
          outcomeCategory,
        }),
      );
      expect(request).toHaveBeenCalledOnce();
      expect(request.mock.calls[0]?.[0]).toBe(
        "/api/public/assessments/report/delivery/status",
      );
      expect(request.mock.calls[0]?.[1]).toMatchObject({
        method: "POST",
        body: JSON.stringify({ accessToken: "saved-report-access-token" }),
      });
    },
  );

  it("does not report delivery while either channel is still pending", async () => {
    hasAnalyticsConsent.mockReturnValue(true);
    const request = vi.fn().mockResolvedValue(
      Response.json({
        delivery: { homeowner: "sent", internal_test_report: "pending" },
      }),
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
          delivery: { homeowner: "pending", internal_test_report: "pending" },
        }}
        showReport
        onOpen={() => undefined}
        onBack={() => undefined}
      />,
    );

    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(trackAnonymousFunnelEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "report_delivery_outcome" }),
    );
  });

  it("rechecks pending delivery before reporting a confirmed outcome", async () => {
    hasAnalyticsConsent.mockReturnValue(true);
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          delivery: { homeowner: "sent", internal_test_report: "pending" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          delivery: { homeowner: "sent", internal_test_report: "sent" },
        }),
      );
    vi.stubGlobal("fetch", request);
    vi.useFakeTimers();

    render(
      <SavedAssessmentReportPanel
        assessment={{
          id: "assessment-1",
          reference: report.reference,
          status: "new_enquiry",
          created: true,
          report,
          reportAccessToken: "saved-report-access-token",
          delivery: { homeowner: "pending", internal_test_report: "pending" },
        }}
        showReport
        onOpen={() => undefined}
        onBack={() => undefined}
      />,
    );

    await act(async () => {});
    expect(request).toHaveBeenCalledOnce();
    expect(trackAnonymousFunnelEvent).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(trackAnonymousFunnelEvent).toHaveBeenCalledWith({
      name: "report_delivery_outcome",
      outcomeCategory: "delivered",
    });
  });
  it("submits the saved map and hands the complete report to the browser immediately", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          assessmentSnapshot: "audience-signed-assessment-snapshot",
        }),
      )
      .mockResolvedValueOnce(
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
        reportAudience="homeowner"
        mapImageDataUrl={TEST_MAP_IMAGE_DATA_URL}
        mapVisibleLayerKeys={["wastewater_assets"]}
        placement={{
          position: [174.76, -36.85],
          rotationDegrees: 12,
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          poolGeometry: validPoolGeometry,
          constructionEnvelopeGeometry: validPoolGeometry,
          constructionEnvelopeWithinMappedArea: true,
          clearancesVisible: false,
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
    expect(
      screen.queryByLabelText("Company / trading name (optional)"),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Jane Homeowner");
    await user.type(screen.getByLabelText("Phone"), "abcdefg");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Save and show my report" }),
    );
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText(
        "Enter a valid NZ mobile or landline number starting with 0.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Enter a valid NZ mobile or landline number starting with 0.",
      ).parentElement,
    ).toHaveAttribute("data-slot", "field-validation-message");
    await user.clear(screen.getByRole("textbox", { name: "Phone" }));
    await user.type(screen.getByLabelText("Phone"), "+64 21 555 1234");
    await user.click(
      screen.getByRole("button", { name: "Save and show my report" }),
    );
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await user.clear(screen.getByRole("textbox", { name: "Phone" }));
    await user.type(screen.getByLabelText("Phone"), "021 555 1234");
    expect(
      screen.queryByText(
        "Enter a valid NZ mobile or landline number starting with 0.",
      ),
    ).not.toBeInTheDocument();
    const additionalInfo = screen.getByLabelText("Additional Info (optional)");
    await user.type(additionalInfo, "SELECT * FROM users;");
    await user.click(
      screen.getByRole("button", { name: "Save and show my report" }),
    );
    expect(request).not.toHaveBeenCalled();
    expect(additionalInfo).toHaveFocus();
    expect(additionalInfo).toHaveAttribute("aria-invalid", "true");
    expect(additionalInfo).toHaveAccessibleDescription(
      "Please use plain text and common punctuation only.",
    );
    await user.clear(additionalInfo);
    await user.type(additionalInfo, "Please call before visiting.");
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
    expect(request.mock.calls[0]?.[0]).toBe(
      "/api/public/assessment-snapshot/audience",
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
      assessmentSnapshot: "server-issued-assessment-snapshot",
      reportAudience: "homeowner",
    });
    const body = JSON.parse(String(request.mock.calls[1]?.[1]?.body));
    expect(body).toMatchObject({
      assessmentSnapshot: "audience-signed-assessment-snapshot",
      mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
      mapVisibleLayerKeys: ["wastewater_assets"],
      poolLayout: {
        lengthMetres: 6.5,
        widthMetres: 3,
        clearancesVisible: false,
      },
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
        reportAudience="homeowner"
        mapImageDataUrl={TEST_MAP_IMAGE_DATA_URL}
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

  it("collects the optional builder company without restoring the visitor-type question", async () => {
    const user = userEvent.setup();
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          assessmentSnapshot: "audience-signed-assessment-snapshot",
        }),
      )
      .mockResolvedValueOnce(
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
        reportAudience="pool_builder"
        mapImageDataUrl={TEST_MAP_IMAGE_DATA_URL}
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
    expect(form.queryByLabelText("I am a")).not.toBeInTheDocument();
    await user.type(form.getByLabelText("Name"), "Roxy Builder");
    await user.type(
      form.getByLabelText("Company / trading name (optional)"),
      "  North Shore Pools Ltd  ",
    );
    await user.type(form.getByLabelText("Phone"), "021 555 4567");
    await user.type(form.getByLabelText("Email"), "roxy@example.com");
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

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
      assessmentSnapshot: "server-issued-assessment-snapshot",
      reportAudience: "pool_builder",
    });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toMatchObject({
      homeowner: {
        visitorType: "pool_builder",
        builderCompanyName: "North Shore Pools Ltd",
        desiredTiming: "other",
        desiredTimingOtherDetail: "Next summer",
      },
    });
  });

  it("shows the saved report without PDF download controls or requests", () => {
    const request = vi.fn();
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
        name: "Preliminary Pool Feasibility Report",
      }),
    ).toBeVisible();
    expect(screen.getByText("GF-2026-000123")).toBeVisible();
    expect(screen.getByText("1 Test Street, Auckland")).toBeVisible();
    expect(screen.getByText("Pool position requires checking")).toBeVisible();
    expect(
      screen.getByText(
        "The proposed pool appears worth progressing, but some mapped evidence requires checking.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/Generated 29 Jul 2026, 2:03 pm/)).toBeVisible();
    expect(screen.getByText("Confirm the pool position")).toBeVisible();
    expect(
      screen.queryByText("Emailing the saved report to the client..."),
    ).not.toBeInTheDocument();
    const reportMapPanel = screen.getByRole("region", {
      name: "Saved assessment map",
    });
    expect(reportMapPanel).toHaveClass("rounded-xl", "border-pool-200");
    expect(
      within(reportMapPanel).getByText("Captured map layers"),
    ).toBeVisible();
    expect(
      within(reportMapPanel).getByText("Mapped property boundary"),
    ).toBeVisible();
    expect(within(reportMapPanel).getByText("Selected pool")).toBeVisible();
    expect(
      within(reportMapPanel).getByText("Indicative investigation buffer"),
    ).toBeVisible();
    expect(
      within(reportMapPanel).queryByRole("checkbox"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Download PDF" }),
    ).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it("shows the background-email message without a confirmation request", async () => {
    const request = vi.fn().mockResolvedValue(
      Response.json(
        {
          delivery: {
            homeowner: "pending",
            internal_test_report: "pending",
          },
          recipientVerification: "required",
        },
        { status: 202 },
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
            internal_test_report: "pending",
          },
        }}
        showReport
        onOpen={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        "We will email a summary of this preliminary report shortly. Check Spam or Promotions if it is not in your inbox.",
      ),
    ).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });

  it("offers Start again at the end of the saved report", async () => {
    const user = userEvent.setup();
    const onStartAgain = vi.fn();

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
            internal_test_report: "pending",
          },
        }}
        showReport
        onOpen={() => undefined}
        onBack={() => undefined}
        onStartAgain={onStartAgain}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start again" }));

    expect(onStartAgain).toHaveBeenCalledOnce();
  });
});
