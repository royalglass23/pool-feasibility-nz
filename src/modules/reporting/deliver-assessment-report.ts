import "server-only";

import { getDb } from "@/db/client";
import { createAssessmentDeliveryStore } from "@/db/repositories/homeowner-assessment-repository";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryOutcome,
} from "@/modules/reporting/assessment-report-delivery";
import {
  ReportEmailDeliveryError,
  sendResendEmail,
} from "@/modules/reporting/resend-email-gateway";

export async function deliverAssessmentReportByReference(
  reference: string,
): Promise<
  Record<"homeowner" | "internal_test_report", AssessmentDeliveryOutcome>
> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = configuredReportFromEmail();

  return deliverAssessmentReport(reference, {
    store: createAssessmentDeliveryStore(getDb()),
    from: from || "unconfigured",
    send: async (input) => {
      if (!apiKey || !from) {
        throw new ReportEmailDeliveryError("EMAIL_CONFIGURATION_MISSING");
      }
      return sendResendEmail({ ...input, apiKey, from });
    },
  });
}

export async function startAssessmentReportDeliveryByReference(
  reference: string,
): Promise<"delivered"> {
  await deliverAssessmentReportByReference(reference);
  return "delivered";
}

function configuredReportFromEmail(): string | undefined {
  if (process.env.VERCEL_ENV === "preview") {
    const previewFrom = process.env.PREVIEW_REPORT_FROM_EMAIL?.trim();
    if (previewFrom) return previewFrom;
  }
  return process.env.REPORT_FROM_EMAIL?.trim();
}
