import { describe, expect, it, vi } from "vitest";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryChannel,
  type AssessmentDeliveryStore,
  type ServiceM8AssessmentNotification,
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
    notification?: Partial<ServiceM8AssessmentNotification>;
  } = {},
) {
  const states: Record<AssessmentDeliveryChannel, string> = { ...initial };
  const store: AssessmentDeliveryStore = {
    claim: vi.fn(
      async (_reference: string, channel: AssessmentDeliveryChannel) => {
        if (states[channel] === "sent" || states[channel] === "sending")
          return null;
        states[channel] = "sending";
        if (channel === "servicem8") {
          return {
            channel,
            claimToken: `${channel}-claim`,
            notification: {
              reference: "GF-2026-000123",
              name: options.homeownerName ?? "Jane Homeowner",
              phone: "021 555 1234",
              email: "jane@example.com",
              checkedAddress: "1 Test Street, Auckland",
              visitorType: "homeowner" as const,
              visitorTypeOtherDetail: undefined,
              desiredTiming: "3_months" as const,
              desiredTimingOtherDetail: undefined,
              ...options.notification,
            },
          };
        }
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
  it("sends the PDF only to the homeowner and an allowlisted notification to ServiceM8", async () => {
    const { states, store } = createDeliveryStore({
      homeowner: "pending",
      servicem8: "pending",
    });
    const renderPdf = vi.fn().mockResolvedValue(Buffer.from("%PDF-shared"));
    const send = vi.fn(async (input: { to: string }) => {
      if (input.to === "jane@example.com") {
        throw new Error("provider unavailable");
      }
      return { id: "email-servicem8" };
    });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf,
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    expect(renderPdf).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
    const homeownerEmail = send.mock.calls.find(
      ([input]) => input.to === "jane@example.com",
    )?.[0];
    const serviceM8Email = send.mock.calls.find(
      ([input]) => input.to === "inbox@servicem8.example",
    )?.[0];
    expect(homeownerEmail).toMatchObject({
      to: "jane@example.com",
      filename: "pool-feasibility-GF-2026-000123.pdf",
      idempotencyKey: "assessment-report/GF-2026-000123/homeowner",
      attachment: Buffer.from("%PDF-shared"),
    });
    expect(serviceM8Email).toEqual({
      from: "Royal Glass <reports@example.com>",
      to: "inbox@servicem8.example",
      subject: "New pool feasibility enquiry GF-2026-000123",
      html: "<p><strong>Reference:</strong> GF-2026-000123<br><strong>Name:</strong> Jane Homeowner<br><strong>Phone:</strong> 021 555 1234<br><strong>Email:</strong> jane@example.com<br><strong>Checked Property Address:</strong> 1 Test Street, Auckland<br><strong>Visitor type:</strong> Homeowner<br><strong>Project Timing:</strong> Within 3 months</p>",
      text: [
        "Reference: GF-2026-000123",
        "Name: Jane Homeowner",
        "Phone: 021 555 1234",
        "Email: jane@example.com",
        "Checked Property Address: 1 Test Street, Auckland",
        "Visitor type: Homeowner",
        "Project Timing: Within 3 months",
      ].join("\n"),
      idempotencyKey: "assessment-report/GF-2026-000123/servicem8",
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

  it("keeps the homeowner retryable and still notifies ServiceM8 when PDF generation fails", async () => {
    const { states, store } = createDeliveryStore({
      homeowner: "pending",
      servicem8: "pending",
    });
    const send = vi.fn().mockResolvedValue({ id: "email-servicem8" });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockRejectedValue(new Error("renderer unavailable")),
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "inbox@servicem8.example",
      idempotencyKey: "assessment-report/GF-2026-000123/servicem8",
    });
    expect(states).toEqual({ homeowner: "failed", servicem8: "sent" });
    expect(result).toEqual({ homeowner: "failed", servicem8: "sent" });
    expect(store.markFailed).toHaveBeenCalledOnce();
    expect(store.markFailed).toHaveBeenCalledWith(
      "GF-2026-000123",
      "homeowner",
      "homeowner-claim",
      "REPORT_PDF_GENERATION_FAILED",
    );
  });

  it("uses the saved Other details in the ServiceM8 notification without rendering a PDF", async () => {
    const { store } = createDeliveryStore(
      { homeowner: "sent", servicem8: "pending" },
      {
        notification: {
          visitorType: "other",
          visitorTypeOtherDetail: "Landscape architect",
          desiredTiming: "other",
          desiredTimingOtherDetail: "Next summer",
        },
      },
    );
    const renderPdf = vi.fn();
    const send = vi.fn().mockResolvedValue({ id: "email-servicem8" });

    await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf,
      send,
      from: "Royal Glass <reports@example.com>",
      serviceM8Email: "inbox@servicem8.example",
    });

    expect(renderPdf).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      text: expect.stringContaining(
        "Visitor type: Other - Landscape architect",
      ),
      html: expect.stringContaining(
        "Project Timing:</strong> Other - Next summer",
      ),
    });
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

  it("sends the ServiceM8 provider payload without an attachment field", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-servicem8" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await sendResendEmail(
      {
        apiKey: "re_test",
        from: "Royal Glass <reports@example.com>",
        to: "inbox@servicem8.example",
        subject: "New pool feasibility enquiry GF-2026-000123",
        html: "<p><strong>Reference:</strong> GF-2026-000123</p>",
        text: "Reference: GF-2026-000123",
        idempotencyKey: "assessment-report/GF-2026-000123/servicem8",
      },
      fetchImplementation,
    );

    const [, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Royal Glass <reports@example.com>",
      to: ["inbox@servicem8.example"],
      subject: "New pool feasibility enquiry GF-2026-000123",
      html: "<p><strong>Reference:</strong> GF-2026-000123</p>",
      text: "Reference: GF-2026-000123",
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
