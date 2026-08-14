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
const controlledTestDeliveryEnvironment = {
  mode: "synthetic_test",
  vercelEnvironment: "preview",
  nodeEnvironment: "production",
} as const;

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
        if (channel === "internal_test_report") {
          return {
            channel,
            claimToken: `${channel}-claim`,
            homeownerName: options.homeownerName ?? "Jane Homeowner",
            homeownerEmail: "jane@example.com",
            report: options.report ?? report,
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

describe("PDF assessment report delivery", () => {
  it.each([
    [
      "the explicit mode is missing",
      {
        mode: undefined,
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      },
    ],
    [
      "the deployment is production",
      {
        mode: "synthetic_test",
        vercelEnvironment: "production",
        nodeEnvironment: "production",
      },
    ],
  ] as const)(
    "fails closed before claiming reports when %s",
    async (_reason, deliveryEnvironment) => {
      const { store } = createDeliveryStore({
        homeowner: "pending",
        internal_test_report: "pending",
      });
      const renderPdf = vi.fn();
      const send = vi.fn();

      await expect(
        deliverAssessmentReport("GF-2026-000123", {
          store,
          renderPdf,
          send,
          from: "Royal Glass <reports@example.com>",
          deliveryEnvironment,
        }),
      ).rejects.toMatchObject({ code: "REPORT_DELIVERY_MODE_DISABLED" });
      expect(store.claim).not.toHaveBeenCalled();
      expect(renderPdf).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("sends the homeowner and support PDF notification directly in Production", async () => {
    const { store } = createDeliveryStore({
      homeowner: "pending",
      internal_test_report: "pending",
    });
    const send = vi.fn().mockResolvedValue({ id: "email-homeowner" });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-shared")),
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: {
        mode: "production",
        vercelEnvironment: "production",
        nodeEnvironment: "production",
      },
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com" }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "support@royalglass.co.nz",
        attachment: Buffer.from("%PDF-shared"),
        idempotencyKey: "assessment-report/GF-2026-000123/internal_test_report",
      }),
    );
    expect(store.claim).toHaveBeenCalledWith("GF-2026-000123", "homeowner");
    expect(store.claim).toHaveBeenCalledWith(
      "GF-2026-000123",
      "internal_test_report",
    );
    expect(result).toEqual({
      homeowner: "sent",
      internal_test_report: "sent",
    });
  });

  it("sends the same saved report PDF to the submitted test email and support", async () => {
    const { store } = createDeliveryStore({
      homeowner: "pending",
      internal_test_report: "pending",
    });
    const pdf = Buffer.from("%PDF-shared");
    const send = vi
      .fn()
      .mockResolvedValueOnce({ id: "email-homeowner" })
      .mockResolvedValueOnce({ id: "email-internal" });
    const renderPdf = vi.fn().mockResolvedValue(pdf);

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf,
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: {
        mode: "synthetic_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      },
    });

    expect(renderPdf).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
    const homeownerEmail = send.mock.calls.find(
      ([input]) => input.to === "jane@example.com",
    )?.[0];
    const internalEmail = send.mock.calls.find(
      ([input]) => input.to === "support@royalglass.co.nz",
    )?.[0];
    expect(homeownerEmail).toMatchObject({
      attachment: pdf,
      filename: "preliminary-pool-feasibility-1-test-street.pdf",
      subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
    });
    expect(internalEmail).toMatchObject({
      attachment: pdf,
      filename: "preliminary-pool-feasibility-1-test-street.pdf",
      subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
      idempotencyKey: "assessment-report/GF-2026-000123/internal_test_report",
    });
    expect(result).toEqual({
      homeowner: "sent",
      internal_test_report: "sent",
    });
  });

  it("keeps the support PDF notification independent when homeowner email fails", async () => {
    const { states, store } = createDeliveryStore({
      homeowner: "pending",
      internal_test_report: "pending",
    });
    const renderPdf = vi.fn().mockResolvedValue(Buffer.from("%PDF-shared"));
    const send = vi.fn(async (input: { to: string }) => {
      if (input.to === "jane@example.com") {
        throw new Error("provider unavailable");
      }
      return { id: "email-internal" };
    });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf,
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(renderPdf).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
    const homeownerEmail = send.mock.calls.find(
      ([input]) => input.to === "jane@example.com",
    )?.[0];
    const internalEmail = send.mock.calls.find(
      ([input]) => input.to === "support@royalglass.co.nz",
    )?.[0];
    expect(homeownerEmail).toMatchObject({
      to: "jane@example.com",
      filename: "preliminary-pool-feasibility-1-test-street.pdf",
      idempotencyKey: "assessment-report/GF-2026-000123/homeowner",
      attachment: Buffer.from("%PDF-shared"),
    });
    expect(internalEmail).toMatchObject({
      to: "support@royalglass.co.nz",
      subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
      attachment: Buffer.from("%PDF-shared"),
      filename: "preliminary-pool-feasibility-1-test-street.pdf",
      idempotencyKey: "assessment-report/GF-2026-000123/internal_test_report",
    });
    expect(states).toEqual({
      homeowner: "failed",
      internal_test_report: "sent",
    });
    expect(result).toEqual({
      homeowner: "failed",
      internal_test_report: "sent",
    });
  });

  it("retries only the failed destination and never resends a completed destination", async () => {
    const { store } = createDeliveryStore({
      homeowner: "failed",
      internal_test_report: "sent",
    });
    const send = vi.fn().mockResolvedValue({ id: "email-homeowner" });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-shared")),
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0].to).toBe("jane@example.com");
    expect(result).toEqual({
      homeowner: "sent",
      internal_test_report: "unchanged",
    });
  });

  it("keeps both destinations retryable when PDF generation fails", async () => {
    const { states, store } = createDeliveryStore({
      homeowner: "pending",
      internal_test_report: "pending",
    });
    const send = vi.fn();

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf: vi.fn().mockRejectedValue(new Error("renderer unavailable")),
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(send).not.toHaveBeenCalled();
    expect(states).toEqual({
      homeowner: "failed",
      internal_test_report: "failed",
    });
    expect(result).toEqual({
      homeowner: "failed",
      internal_test_report: "failed",
    });
    expect(store.markFailed).toHaveBeenCalledTimes(2);
    expect(store.markFailed).toHaveBeenCalledWith(
      "GF-2026-000123",
      "homeowner",
      "homeowner-claim",
      "REPORT_PDF_GENERATION_FAILED",
    );
    expect(store.markFailed).toHaveBeenCalledWith(
      "GF-2026-000123",
      "internal_test_report",
      "internal_test_report-claim",
      "REPORT_PDF_GENERATION_FAILED",
    );
  });

  it("retries only the support PDF notification with the saved PDF", async () => {
    const { store } = createDeliveryStore({
      homeowner: "sent",
      internal_test_report: "pending",
    });
    const pdf = Buffer.from("%PDF-shared");
    const renderPdf = vi.fn().mockResolvedValue(pdf);
    const send = vi.fn().mockResolvedValue({ id: "email-internal" });

    const result = await deliverAssessmentReport("GF-2026-000123", {
      store,
      renderPdf,
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    expect(renderPdf).toHaveBeenCalledOnce();
    expect(renderPdf).toHaveBeenCalledWith(report);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "support@royalglass.co.nz",
      attachment: pdf,
      filename: "preliminary-pool-feasibility-1-test-street.pdf",
      idempotencyKey: "assessment-report/GF-2026-000123/internal_test_report",
    });
    expect(result).toEqual({
      homeowner: "unchanged",
      internal_test_report: "sent",
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

  it("sends the support PDF notification through Resend with its independent idempotency key", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-internal" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await sendResendEmail(
      {
        apiKey: "re_test",
        from: "Royal Glass <reports@example.com>",
        to: "support@royalglass.co.nz",
        subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
        html: "<p>Your report is attached.</p>",
        text: "Your report is attached.",
        attachment: Buffer.from("%PDF-shared"),
        filename: "preliminary-pool-feasibility-1-test-street.pdf",
        idempotencyKey: "assessment-report/GF-2026-000123/internal_test_report",
      },
      fetchImplementation,
    );

    const [, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Royal Glass <reports@example.com>",
      to: ["support@royalglass.co.nz"],
      subject: "Your Preliminary Pool Feasibility Report - 1 Test Street",
      html: "<p>Your report is attached.</p>",
      text: "Your report is attached.",
      attachments: [
        {
          content: Buffer.from("%PDF-shared").toString("base64"),
          filename: "preliminary-pool-feasibility-1-test-street.pdf",
        },
      ],
    });
  });

  it("escapes homeowner and property text before placing it in email HTML", async () => {
    const { store } = createDeliveryStore(
      { homeowner: "pending", internal_test_report: "sent" },
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
      deliveryEnvironment: controlledTestDeliveryEnvironment,
    });

    const html = send.mock.calls[0]?.[0].html as string;
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script");
  });
});
