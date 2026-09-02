import { describe, expect, it, vi } from "vitest";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";

const controlledTestDeliveryEnvironment = {
  mode: "synthetic_test",
  vercelEnvironment: "preview",
  nodeEnvironment: "production",
} as const;

describe("assessment report delivery", () => {
  it("sends the same PDF attachment to the synthetic test user and support", async () => {
    const report = buildTestPreliminaryReport();
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve({
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: "Jane Homeowner",
          homeownerEmail: "jane@example.com",
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
    for (const [email] of send.mock.calls) {
      expect(email.html).toContain("PoolReady");
      expect(email.text).toContain("PoolReady");
      expect(email.html).toContain(
        'src="https://poolready.example/brand/pool-ready-logo.png"',
      );
      expect(email.html).toContain(
        'href="https://www.poolready.co.nz/" target="_blank"',
      );
    }
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
            to: "support@royalglass.co.nz",
            attachment: pdf,
            filename: "preliminary-pool-feasibility-1-test-street.pdf",
            idempotencyKey: `assessment-report/${report.reference}/internal_test_report`,
          }),
        ],
      ]),
    );
  });

  it("still notifies support when the homeowner email fails", async () => {
    const report = buildTestPreliminaryReport();
    const store: AssessmentDeliveryStore = {
      claim: vi.fn((_: string, channel) =>
        Promise.resolve({
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: "Jane Homeowner",
          homeownerEmail: "jane@example.com",
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
