import { describe, expect, it, vi } from "vitest";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";

describe("assessment report HTML delivery", () => {
  it("sends one homeowner HTML email without a PDF attachment", async () => {
    const report = buildTestPreliminaryReport();
    const store: AssessmentDeliveryStore = {
      claim: vi.fn().mockResolvedValue({
        channel: "homeowner",
        claimToken: "homeowner-claim",
        homeownerName: "Jane Homeowner",
        homeownerEmail: "jane@example.com",
        report,
      }),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const send = vi.fn().mockResolvedValue({ id: "email-homeowner" });

    const outcome = await deliverAssessmentReport(report.reference, {
      store,
      send,
      from: "Royal Glass <reports@example.com>",
    });

    expect(outcome).toEqual({
      homeowner: "sent",
      internal_test_report: "unchanged",
    });
    expect(store.claim).toHaveBeenCalledWith(report.reference, "homeowner");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
        idempotencyKey: `assessment-report/${report.reference}/homeowner`,
      }),
    );
    const email = send.mock.calls[0]?.[0];
    expect(email).not.toHaveProperty("attachment");
    expect(email).not.toHaveProperty("filename");
    expect(email.html).toContain(report.property.address);
    expect(email.text).toContain(report.overall.recommendedStage);
  });
});
