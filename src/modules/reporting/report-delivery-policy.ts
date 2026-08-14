import { ReportEmailDeliveryError } from "@/modules/reporting/resend-email-gateway";

export type ReportDeliveryEnvironment = {
  mode?: string;
  vercelEnvironment?: string;
  nodeEnvironment?: string;
};

export type ReportDeliveryPolicy =
  | {
      mode: "synthetic_test";
      channels: readonly ["homeowner", "internal_test_report"];
    }
  | {
      mode: "production";
      channels: readonly ["homeowner", "internal_test_report"];
    };

export function resolveReportDeliveryPolicy(
  environment: ReportDeliveryEnvironment,
): ReportDeliveryPolicy {
  if (environment.mode === "synthetic_test") {
    if (environment.vercelEnvironment === "preview") {
      return {
        mode: "synthetic_test",
        channels: ["homeowner", "internal_test_report"],
      };
    }
    if (
      !environment.vercelEnvironment &&
      (environment.nodeEnvironment === "development" ||
        environment.nodeEnvironment === "test")
    ) {
      return {
        mode: "synthetic_test",
        channels: ["homeowner", "internal_test_report"],
      };
    }
  }

  if (
    environment.mode === "production" &&
    environment.vercelEnvironment === "production"
  ) {
    return {
      mode: "production",
      channels: ["homeowner", "internal_test_report"],
    };
  }

  throw new ReportEmailDeliveryError("REPORT_DELIVERY_MODE_DISABLED");
}
