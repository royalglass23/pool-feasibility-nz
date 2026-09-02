import "server-only";

import { getDb } from "@/db/client";
import { env } from "@/env";
import { createAssessmentDeliveryStore } from "@/db/repositories/homeowner-assessment-repository";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryOutcome,
} from "@/modules/reporting/assessment-report-delivery";
import {
  ReportEmailDeliveryError,
  sendResendEmail,
} from "@/modules/reporting/resend-email-gateway";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";

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
    brandLogoUrl: new URL(
      "/brand/pool-ready-logo.png",
      env.APP_BASE_URL,
    ).toString(),
    renderPdf: generatePreliminaryReportPdf,
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

export async function startAssessmentReportDeliveryByReference(
  reference: string,
): Promise<"delivered"> {
  await deliverAssessmentReportByReference(reference);
  return "delivered";
}

function configuredReportFromEmail(): string | undefined {
  if (process.env.VERCEL_ENV === "preview") {
    const previewFrom = process.env.PREVIEW_REPORT_FROM_EMAIL?.trim();
    if (previewFrom) return poolReadySender(previewFrom);
  }
  const reportFrom = process.env.REPORT_FROM_EMAIL?.trim();
  return reportFrom ? poolReadySender(reportFrom) : undefined;
}

function poolReadySender(configuredSender: string): string {
  const emailAddress =
    configuredSender.match(/<([^<>]+)>/)?.[1]?.trim() ?? configuredSender;
  return `PoolReady <${emailAddress}>`;
}
