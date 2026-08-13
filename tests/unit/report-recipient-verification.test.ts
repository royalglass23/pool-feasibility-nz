import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { requestReportRecipientVerificationByReference } from "@/modules/reporting/report-recipient-verification";

const recipient = {
  id: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
  reference: "GF-2026-000123",
  name: "Jane <Homeowner>",
  email: "jane@example.com",
};
const production = {
  mode: "production",
  vercelEnvironment: "production",
  nodeEnvironment: "production",
} as const;

describe("report recipient verification", () => {
  it("sends a verification-only email to the submitted recipient with a fragment-bound token", async () => {
    const send = vi.fn().mockResolvedValue({ id: "resend-verification" });

    await expect(
      requestReportRecipientVerificationByReference(recipient.reference, {
        deliveryEnvironment: production,
        baseUrl: "https://pool-feasibility.vercel.app",
        apiKey: "re_test",
        from: "Royal Glass <reports@example.com>",
        getRecipient: vi.fn().mockResolvedValue(recipient),
        issueToken: vi.fn().mockReturnValue("opaque-verification-token"),
        send,
      }),
    ).resolves.toBe("verification_required");

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "re_test",
        to: "jane@example.com",
        subject: "Confirm your email to receive your preliminary pool report",
        idempotencyKey: "assessment-report-verification/GF-2026-000123",
      }),
    );
    const sent = send.mock.calls[0][0];
    expect(sent).not.toHaveProperty("attachments");
    expect(sent.html).toContain("Jane &lt;Homeowner&gt;");
    expect(sent.text).toContain(
      "https://pool-feasibility.vercel.app/report/verify#opaque-verification-token",
    );
    expect(sent.text).not.toContain("?");
  });

  it("fails closed outside the explicit Production policy", async () => {
    await expect(
      requestReportRecipientVerificationByReference(recipient.reference, {
        deliveryEnvironment: {
          mode: "synthetic_test",
          vercelEnvironment: "preview",
          nodeEnvironment: "production",
        },
      }),
    ).rejects.toMatchObject({
      code: "REPORT_RECIPIENT_VERIFICATION_NOT_REQUIRED",
    });
  });

  it("requires a public HTTPS base URL", async () => {
    await expect(
      requestReportRecipientVerificationByReference(recipient.reference, {
        deliveryEnvironment: production,
        baseUrl: "http://localhost:3000",
        apiKey: "re_test",
        from: "Royal Glass <reports@example.com>",
        getRecipient: vi.fn().mockResolvedValue(recipient),
        issueToken: vi.fn().mockReturnValue("opaque-verification-token"),
      }),
    ).rejects.toMatchObject({ code: "REPORT_VERIFICATION_URL_MISCONFIGURED" });
  });

  it("keeps Preview verification links on the Preview deployment", async () => {
    const send = vi.fn().mockResolvedValue({ id: "resend-verification" });
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "preview-id.vercel.app");
    vi.stubEnv("APP_BASE_URL", "https://pool-feasibility.vercel.app");

    try {
      await requestReportRecipientVerificationByReference(recipient.reference, {
        deliveryEnvironment: {
          mode: "production_test",
          vercelEnvironment: "preview",
          nodeEnvironment: "production",
        },
        apiKey: "re_test",
        from: "Royal Glass <reports@example.com>",
        getRecipient: vi.fn().mockResolvedValue(recipient),
        issueToken: vi.fn().mockReturnValue("opaque-verification-token"),
        send,
      });
    } finally {
      vi.unstubAllEnvs();
    }

    expect(send.mock.calls[0][0].text).toContain(
      "https://preview-id.vercel.app/report/verify#opaque-verification-token",
    );
  });

  it("uses a Preview-only sender override for verification", async () => {
    const send = vi.fn().mockResolvedValue({ id: "resend-verification" });
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "preview-id.vercel.app");
    vi.stubEnv("PREVIEW_REPORT_FROM_EMAIL", "Pool Lab <reports@example.com>");
    vi.stubEnv("REPORT_FROM_EMAIL", "Legacy <legacy@example.com>");

    try {
      await requestReportRecipientVerificationByReference(recipient.reference, {
        deliveryEnvironment: {
          mode: "production_test",
          vercelEnvironment: "preview",
          nodeEnvironment: "production",
        },
        apiKey: "re_test",
        getRecipient: vi.fn().mockResolvedValue(recipient),
        issueToken: vi.fn().mockReturnValue("opaque-verification-token"),
        send,
      });
    } finally {
      vi.unstubAllEnvs();
    }

    expect(send.mock.calls[0][0].from).toBe("Pool Lab <reports@example.com>");
  });
});
