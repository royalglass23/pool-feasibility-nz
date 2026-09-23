import { describe, expect, it, vi } from "vitest";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryClaim,
  type AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";

const controlledTestDeliveryEnvironment = {
  mode: "synthetic_test",
  vercelEnvironment: "preview",
  nodeEnvironment: "production",
} as const;

describe("assessment report delivery", () => {
  it("encodes submitted HTML as text in both delivery channels", async () => {
    const payload = '<img src=x onerror="alert(1)">';
    const report = buildTestPreliminaryReport();
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve<AssessmentDeliveryClaim>({
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: payload,
          homeownerPhone: "0211234567",
          homeownerEmail: "jane@example.com",
          builderCompanyName: null,
          visitorType: "other",
          visitorTypeOtherDetail: payload,
          desiredTiming: "other",
          desiredTimingOtherDetail: payload,
          additionalInfo: payload,
          report,
        }),
      ),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const send = vi.fn().mockResolvedValue({ id: "test-email" });
    await deliverAssessmentReport(report.reference, {
      store,
      send,
      from: "PoolReady <reports@example.com>",
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-test")),
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });
    expect(send).toHaveBeenCalledTimes(2);
    for (const [email] of send.mock.calls) {
      expect(email.html).not.toContain(payload);
      expect(email.html).toContain(
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
      );
    }
  });

  it("sends the same PDF attachment to the synthetic test user and support", async () => {
    const report = buildTestPreliminaryReport();
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve<AssessmentDeliveryClaim>({
          channel,
          claimToken: `${channel}-claim`,
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
        }),
      ),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const pdf = Buffer.from("%PDF-shared");
    const renderPdf = vi.fn().mockResolvedValue(pdf);
    const send = vi
      .fn()
      .mockResolvedValueOnce({ id: "email-homeowner" })
      .mockResolvedValueOnce({ id: "email-royal-glass" });

    const outcome = await deliverAssessmentReport(report.reference, {
      store,
      send,
      from: "Royal Glass <reports@example.com>",
      brandLogoUrl: "https://poolready.example/brand/pool-ready-logo.png",
      renderPdf,
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(outcome).toEqual({
      homeowner: "sent",
      internal_test_report: "sent",
    });
    expect(store.claim).toHaveBeenCalledWith(report.reference, "homeowner");
    expect(store.claim).toHaveBeenCalledWith(
      report.reference,
      "internal_test_report",
    );
    expect(renderPdf).toHaveBeenCalledOnce();
    expect(renderPdf).toHaveBeenCalledWith(report);
    expect(send).toHaveBeenCalledTimes(2);
    const homeownerEmail = send.mock.calls.find(
      ([email]) => email.to === "jane@example.com",
    )?.[0];
    const supportEmail = send.mock.calls.find(
      ([email]) => email.to === "support@bluehaven.nz",
    )?.[0];
    expect(homeownerEmail?.html).toContain("PoolReady");
    expect(homeownerEmail?.html).toContain(
      'src="https://poolready.example/brand/pool-ready-logo.png"',
    );
    expect(homeownerEmail?.html).toContain(
      'href="https://www.poolready.co.nz/" target="_blank"',
    );
    expect(homeownerEmail?.html).toContain(
      "background:#ffffff;border-radius:6px",
    );
    expect(homeownerEmail).toMatchObject({
      replyTo: "support@bluehaven.nz",
    });
    expect(homeownerEmail?.html).toContain(
      "Have questions? Let’s talk it through.",
    );
    expect(homeownerEmail?.html).toContain("Reply and talk with us");
    expect(homeownerEmail?.html).toContain("Recommended next step");
    expect(homeownerEmail?.text).toContain(
      "Have questions? Let’s talk it through.",
    );
    expect(homeownerEmail?.text).toContain("Recommended next step");
    expect(supportEmail).toMatchObject({
      replyTo: "jane@example.com",
      subject: "[PoolReady] Property check report requested - 1 Test Street",
    });
    expect(supportEmail?.html).toContain("Overall result");
    expect(supportEmail?.html).toContain("Main finding");
    expect(supportEmail?.html).not.toContain("Recommended next step");
    expect(supportEmail?.html).toContain("Submitted form answers");
    expect(supportEmail?.text).toContain("Phone: 021 123 4567");
    expect(send.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            to: "jane@example.com",
            subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
            attachment: pdf,
            filename: "preliminary-pool-feasibility-1-test-street.pdf",
            idempotencyKey: `assessment-report/${report.reference}/homeowner`,
          }),
        ],
        [
          expect.objectContaining({
            to: "support@bluehaven.nz",
            attachment: pdf,
            filename: "preliminary-pool-feasibility-1-test-street.pdf",
            idempotencyKey: `assessment-report/${report.reference}/internal_test_report`,
          }),
        ],
      ]),
    );
  });

  it("uses the persisted Homeowner audience for email content even when legacy visitor data disagrees", async () => {
    const report = buildTestPreliminaryReport({
      reportAudience: "homeowner",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          excavationSideAllowanceMetres: 0.3,
          route: {
            provenance: "suggested",
            geometry: {
              type: "LineString",
              coordinates: [
                [174.7598, -36.8502],
                [174.76, -36.85],
              ],
            },
          },
          accessConditions: ["gate_or_narrow_passage"],
          nearbyFeatures: ["fences"],
        },
        suggestedRoute: {
          type: "LineString",
          coordinates: [
            [174.7598, -36.8502],
            [174.76, -36.85],
          ],
        },
        routePolicyVersion: 1,
        excavation: {
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve<AssessmentDeliveryClaim>({
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: "Jane Homeowner",
          homeownerPhone: "021 123 4567",
          homeownerEmail: "jane@example.com",
          builderCompanyName: "North Shore Pools Ltd",
          visitorType: "pool_builder",
          visitorTypeOtherDetail: null,
          desiredTiming: "3_months",
          desiredTimingOtherDetail: null,
          additionalInfo: null,
          report,
        }),
      ),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const send = vi.fn().mockResolvedValue({ id: "email-homeowner" });

    await deliverAssessmentReport(report.reference, {
      store,
      send,
      from: "PoolReady <reports@example.com>",
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-homeowner")),
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    const homeownerEmail = send.mock.calls.find(
      ([email]) => email.to === "jane@example.com",
    )?.[0];
    expect(homeownerEmail?.html).toContain(
      "What your pool builder will confirm",
    );
    expect(homeownerEmail?.html).toContain(
      "Arrange an onsite visit with a pool builder",
    );
    expect(homeownerEmail?.text).toContain(
      "What your pool builder will confirm",
    );
    expect(homeownerEmail?.text).toContain(
      "Arrange an onsite visit with a pool builder",
    );
    expect(homeownerEmail?.html).not.toContain("Site constructability");
    expect(homeownerEmail?.text).not.toContain("Site constructability");
    for (const excluded of [
      "Estimated pool depth",
      "Saved route",
      "m³",
      "300 mm",
      "Firth",
      "user-selected-side-clearance-v1",
      "Provider availability",
    ]) {
      expect(homeownerEmail?.html).not.toContain(excluded);
      expect(homeownerEmail?.text).not.toContain(excluded);
    }
  });

  it("projects the persisted Pool Builder audience and company into the PDF and email without customer details", async () => {
    const report = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          excavationSideAllowanceMetres: 0.3,
          route: {
            provenance: "suggested",
            geometry: {
              type: "LineString",
              coordinates: [
                [174.7598, -36.8502],
                [174.76, -36.85],
              ],
            },
          },
          accessConditions: ["gate_or_narrow_passage"],
          nearbyFeatures: ["fences"],
        },
        mappedEvidence: [
          {
            id: "saved-ground-check",
            category: "terrain_ground",
            status: "no_concern",
            provider: "Auckland DEM",
            dataset: "Indicative terrain",
          },
        ],
        providerAvailability: [
          {
            category: "access_excavation",
            provider: "Vector",
            dataset: "Mapped services",
            status: "error",
          },
        ],
        suggestedRoute: {
          type: "LineString",
          coordinates: [
            [174.7598, -36.8502],
            [174.76, -36.85],
          ],
        },
        routePolicyVersion: 1,
        excavation: {
          dimensions: { lengthMetres: 6.5, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve<AssessmentDeliveryClaim>({
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: "Pat Builder",
          homeownerPhone: "021 123 4567",
          homeownerEmail: "pat@example.com",
          builderCompanyName: "North Shore Pools Ltd",
          visitorType: "pool_builder",
          visitorTypeOtherDetail: null,
          desiredTiming: "3_months",
          desiredTimingOtherDetail: null,
          additionalInfo: null,
          report,
        }),
      ),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const send = vi.fn().mockResolvedValue({ id: "email-builder" });
    const renderPdf = vi.fn().mockResolvedValue(Buffer.from("%PDF-builder"));

    await deliverAssessmentReport(report.reference, {
      store,
      send,
      from: "PoolReady <reports@example.com>",
      renderPdf,
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(renderPdf).toHaveBeenCalledWith(report, {
      builderCompanyName: "North Shore Pools Ltd",
    });
    const builderEmail = send.mock.calls.find(
      ([email]) => email.to === "pat@example.com",
    )?.[0];
    for (const expected of [
      "North Shore Pools Ltd",
      "Estimated pool depth",
      "1.50 m",
      "Gate or narrow passage",
      "Provider availability",
      "Indicative planning volumes only",
      "Confirm final excavation requirements onsite",
    ]) {
      expect(builderEmail?.html).toContain(expected);
      expect(builderEmail?.text).toContain(expected);
    }
    for (const excluded of [
      "Customer name",
      "Customer phone",
      "Customer email",
      "Firth masonry guidance",
      "user-selected-side-clearance-v1",
    ]) {
      expect(builderEmail?.html).not.toContain(excluded);
      expect(builderEmail?.text).not.toContain(excluded);
    }
  });

  it("fails closed instead of mixing audience projections across delivery claims", async () => {
    const builderReport = buildTestPreliminaryReport({
      reportAudience: "pool_builder",
    });
    const homeownerReport = buildTestPreliminaryReport({
      reportAudience: "homeowner",
    });
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve<AssessmentDeliveryClaim>({
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: "Pat Builder",
          homeownerPhone: "021 123 4567",
          homeownerEmail: "pat@example.com",
          builderCompanyName:
            channel === "homeowner" ? "North Shore Pools Ltd" : null,
          visitorType: "pool_builder",
          visitorTypeOtherDetail: null,
          desiredTiming: "3_months",
          desiredTimingOtherDetail: null,
          additionalInfo: null,
          report: channel === "homeowner" ? builderReport : homeownerReport,
        }),
      ),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const send = vi.fn().mockResolvedValue({ id: "must-not-send" });
    const renderPdf = vi.fn().mockResolvedValue(Buffer.from("%PDF-wrong"));

    await expect(
      deliverAssessmentReport(builderReport.reference, {
        store,
        send,
        from: "PoolReady <reports@example.com>",
        renderPdf,
        deliveryEnvironment: controlledTestDeliveryEnvironment,
      }),
    ).resolves.toEqual({ homeowner: "failed", internal_test_report: "failed" });
    expect(renderPdf).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledTimes(2);
    expect(store.markFailed).toHaveBeenCalledWith(
      builderReport.reference,
      "homeowner",
      "homeowner-claim",
      "REPORT_PROJECTION_MISMATCH",
    );
    expect(store.markFailed).toHaveBeenCalledWith(
      builderReport.reference,
      "internal_test_report",
      "internal_test_report-claim",
      "REPORT_PROJECTION_MISMATCH",
    );
  });

  it("still notifies support when the homeowner email fails", async () => {
    const report = buildTestPreliminaryReport();
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve<AssessmentDeliveryClaim>({
          channel,
          claimToken: `${channel}-claim`,
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
        }),
      ),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const send = vi.fn(async (input: { to: string }) => {
      if (input.to === "jane@example.com")
        throw new Error("Resend unavailable");
      return { id: "email-royal-glass" };
    });

    const outcome = await deliverAssessmentReport(report.reference, {
      store,
      send,
      from: "Royal Glass <reports@example.com>",
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-shared")),
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(outcome).toEqual({
      homeowner: "failed",
      internal_test_report: "sent",
    });
    expect(store.markFailed).toHaveBeenCalledWith(
      report.reference,
      "homeowner",
      "homeowner-claim",
      "EMAIL_DELIVERY_FAILED",
    );
    expect(store.markSent).toHaveBeenCalledWith(
      report.reference,
      "internal_test_report",
      "internal_test_report-claim",
      "email-royal-glass",
    );
  });
});
