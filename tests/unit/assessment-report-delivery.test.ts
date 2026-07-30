import { describe, expect, it, vi } from "vitest";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryChannel,
  type AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";
import { sendResendEmail } from "@/modules/reporting/resend-email-gateway";

const report = buildTestPreliminaryReport({
  summary: "The selected pool needs checking.",
});

function createDeliveryStore(
  initial: Record<AssessmentDeliveryChannel, string>,
  options: {
    report?: SavedPreliminaryReport;
    homeownerName?: string;
  } = {},
) {
  const states: Record<AssessmentDeliveryChannel, string> = { ...initial };
  const store: AssessmentDeliveryStore = {
    claim: vi.fn(
      async (_reference: string, channel: AssessmentDeliveryChannel) => {
        if (states[channel] === "sent" || states[channel] === "sending")
          return null;
        states[channel] = "sending";
        return {
          channel,
          claimToken: `${channel}-claim`,
          homeownerName: options.homeownerName ?? "Jane Homeowner",
          homeownerEmail: "jane@example.com",
          report: options.report ?? report,
        };
      },
    ),
    markSent: vi.fn(
      async (_reference: string, channel: AssessmentDeliveryChannel) => {
        states[channel] = "sent";
      },
    ),
    markFailed: vi.fn(
      async (_reference: string, channel: AssessmentDeliveryChannel) => {
        states[channel] = "failed";
      },
    ),
  };
  return { states, store };
}

describe("assessment report delivery", () => {
  it("keeps one channel retryable when the other channel sends successfully", async () => {
    const { states, store } = createDeliveryStore({
      homeowner: "pending",
      servicem8: "pending",
    });
    const renderPdf = vi.fn().mockResolvedValue(Buffer.from("%PDF-shared"));
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({ id: "email-servicem8" });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf,
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    expect(renderPdf).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "jane@example.com",
      filename: "pool-feasibility-GF-2026-000123.pdf",
      idempotencyKey: "assessment-report/GF-2026-000123/homeowner",
      attachment: Buffer.from("%PDF-shared"),
    });
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      to: "inbox@servicem8.example",
      filename: "pool-feasibility-GF-2026-000123.pdf",
      idempotencyKey: "assessment-report/GF-2026-000123/servicem8",
      attachment: Buffer.from("%PDF-shared"),
    });
    expect(states).toEqual({ homeowner: "failed", servicem8: "sent" });
    expect(result).toEqual({ homeowner: "failed", servicem8: "sent" });
  });

  it("retries only the failed destination and never resends a completed destination", async () => {
    const { store } = createDeliveryStore({
      homeowner: "failed",
      servicem8: "sent",
    });
    const send = vi.fn().mockResolvedValue({ id: "email-homeowner" });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-shared")),
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0].to).toBe("jane@example.com");
    expect(result).toEqual({ homeowner: "sent", servicem8: "unchanged" });
  });

  it("records both destinations as retryable when the shared PDF cannot be generated", async () => {
    const { states, store } = createDeliveryStore({
      homeowner: "pending",
      servicem8: "pending",
    });
    const send = vi.fn();

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockRejectedValue(new Error("renderer unavailable")),
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    expect(send).not.toHaveBeenCalled();
    expect(states).toEqual({ homeowner: "failed", servicem8: "failed" });
    expect(result).toEqual({ homeowner: "failed", servicem8: "failed" });
    expect(store.markFailed).toHaveBeenCalledTimes(2);
    expect(store.markFailed).toHaveBeenCalledWith(
      "GF-2026-000123",
      "homeowner",
      "homeowner-claim",
      "REPORT_PDF_GENERATION_FAILED",
    );
    expect(store.markFailed).toHaveBeenCalledWith(
      "GF-2026-000123",
      "servicem8",
      "servicem8-claim",
      "REPORT_PDF_GENERATION_FAILED",
    );
  });

  it("sends a base64 PDF attachment through Resend with the provider idempotency key", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendResendEmail(
      {
        apiKey: "re_test",
        from: "Royal Glass <reports@example.com>",
        to: "jane@example.com",
        subject: "Your preliminary report",
        html: "<p>Your report is attached.</p>",
        text: "Your report is attached.",
        attachment: Buffer.from("%PDF-shared"),
        filename: "report.pdf",
        idempotencyKey: "assessment-report/GF-2026-000123/homeowner",
      },
      fetchImplementation,
    );

    expect(result).toEqual({ id: "email-123" });
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
      "Idempotency-Key": "assessment-report/GF-2026-000123/homeowner",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: "Royal Glass <reports@example.com>",
      to: ["jane@example.com"],
      attachments: [
        {
          content: Buffer.from("%PDF-shared").toString("base64"),
          filename: "report.pdf",
        },
      ],
    });
  });

  it("escapes homeowner and property text before placing it in email HTML", async () => {
    const { store } = createDeliveryStore(
      { homeowner: "pending", servicem8: "sent" },
      {
        homeownerName: '<img src=x onerror="alert(1)">',
        report: {
          ...report,
          property: {
            ...report.property,
            address: '<script>alert("address")</script>',
          },
        },
      },
    );
    const send = vi.fn().mockResolvedValue({ id: "email-homeowner" });

    await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-shared")),
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    const html = send.mock.calls[0]?.[0].html as string;
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script");
  });
});
