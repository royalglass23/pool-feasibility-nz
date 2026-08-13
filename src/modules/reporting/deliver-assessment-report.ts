import "server-only";

import { getDb } from "@/db/client";
import { createAssessmentDeliveryStore } from "@/db/repositories/homeowner-assessment-repository";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryOutcome,
} from "@/modules/reporting/assessment-report-delivery";
import {
  resolveReportDeliveryPolicy,
  type ReportDeliveryEnvironment,
} from "@/modules/reporting/report-delivery-policy";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";
import { requestReportRecipientVerificationByReference } from "@/modules/reporting/report-recipient-verification";
import {
  ReportEmailDeliveryError,
  sendResendEmail,
} from "@/modules/reporting/resend-email-gateway";

export async function deliverAssessmentReportByReference(
  reference: string,
  options: { recipientVerified?: boolean } = {},
): Promise<
  Record<"homeowner" | "internal_test_report", AssessmentDeliveryOutcome>
> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REPORT_FROM_EMAIL?.trim();

  return deliverAssessmentReport(reference, {
    store: createAssessmentDeliveryStore(getDb()),
    renderPdf: generatePreliminaryReportPdf,
    from: from || "unconfigured",
    deliveryEnvironment: reportDeliveryEnvironment(),
    recipientVerified: options.recipientVerified,
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
): Promise<"verification_required" | "delivered"> {
  const environment = reportDeliveryEnvironment();
  const policy = resolveReportDeliveryPolicy(environment);
  if (policy.requiresRecipientVerification) {
    await requestReportRecipientVerificationByReference(reference, {
      deliveryEnvironment: environment,
    });
    return "verification_required";
  }
  await deliverAssessmentReportByReference(reference);
  return "delivered";
}

export function reportDeliveryEnvironment(): ReportDeliveryEnvironment {
  return {
    mode: process.env.REPORT_DELIVERY_MODE,
    vercelEnvironment: process.env.VERCEL_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    previewRecipientVerificationEnabled:
      process.env.PREVIEW_REPORT_DELIVERY_TEST === "true",
  };
}
