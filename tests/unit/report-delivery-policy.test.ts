import { describe, expect, it } from "vitest";
import { resolveReportDeliveryPolicy } from "@/modules/reporting/report-delivery-policy";

describe("report delivery policy", () => {
  it("permits test fan-out only in Preview", () => {
    expect(
      resolveReportDeliveryPolicy({
        mode: "synthetic_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      }),
    ).toEqual({
      mode: "synthetic_test",
      channels: ["homeowner", "internal_test_report"],
      requiresRecipientVerification: false,
    });
  });

  it("permits Production delivery only in Vercel Production and includes the support PDF notification", () => {
    expect(
      resolveReportDeliveryPolicy({
        mode: "production",
        vercelEnvironment: "production",
        nodeEnvironment: "production",
      }),
    ).toEqual({
      mode: "production",
      channels: ["homeowner", "internal_test_report"],
      requiresRecipientVerification: true,
    });
  });

  it("permits the verified-recipient test path only in Vercel Preview", () => {
    expect(
      resolveReportDeliveryPolicy({
        mode: "production_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      }),
    ).toEqual({
      mode: "production_test",
      channels: ["homeowner"],
      requiresRecipientVerification: true,
    });
  });

  it("uses the dedicated Preview verification-test flag without changing the shared delivery mode", () => {
    expect(
      resolveReportDeliveryPolicy({
        mode: "synthetic_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
        previewRecipientVerificationEnabled: true,
      }),
    ).toEqual({
      mode: "production_test",
      channels: ["homeowner"],
      requiresRecipientVerification: true,
    });
  });

  it.each([
    { mode: undefined, vercelEnvironment: "production" },
    { mode: "synthetic_test", vercelEnvironment: "production" },
    { mode: "production", vercelEnvironment: "preview" },
    { mode: "production_test", vercelEnvironment: "production" },
    {
      mode: "synthetic_test",
      vercelEnvironment: "production",
      previewRecipientVerificationEnabled: true,
    },
    { mode: "production", nodeEnvironment: "production" },
  ])("fails closed for %#", (environment) => {
    expect(() => resolveReportDeliveryPolicy(environment)).toThrow(
      "REPORT_DELIVERY_MODE_DISABLED",
    );
  });
});
