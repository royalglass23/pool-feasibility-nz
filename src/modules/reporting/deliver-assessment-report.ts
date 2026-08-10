import "server-only";

import { getDb } from "@/db/client";
import { createAssessmentDeliveryStore } from "@/db/repositories/homeowner-assessment-repository";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryOutcome,
} from "@/modules/reporting/assessment-report-delivery";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";
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
  const from = process.env.REPORT_FROM_EMAIL?.trim();

  return deliverAssessmentReport(reference, {
    store: createAssessmentDeliveryStore(getDb()),
    renderPdf: generatePreliminaryReportPdf,
    from: from || "unconfigured",
    deliveryEnvironment: {
      mode: process.env.REPORT_DELIVERY_MODE,
      vercelEnvironment: process.env.VERCEL_ENV,
      nodeEnvironment: process.env.NODE_ENV,
    },
    send: async (input) => {
      if (!apiKey || !from) {
        throw new ReportEmailDeliveryError("EMAIL_CONFIGURATION_MISSING");
      }
      return sendResendEmail({ ...input, apiKey, from });
    },
  });
}
