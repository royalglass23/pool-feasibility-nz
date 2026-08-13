import "server-only";

import { getDb } from "@/db/client";
import { getReportRecipientByReference } from "@/db/repositories/homeowner-assessment-repository";
import {
  issueReportRecipientVerificationToken,
  type ReportRecipientVerification,
} from "@/modules/reporting/report-recipient-verification-token";
import {
  resolveReportDeliveryPolicy,
  type ReportDeliveryEnvironment,
} from "@/modules/reporting/report-delivery-policy";
import {
  ReportEmailDeliveryError,
  sendResendEmail,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";

type ReportRecipient = ReportRecipientVerification & {
  name: string;
  email: string;
};

export async function requestReportRecipientVerificationByReference(
  reference: string,
  dependencies: {
    deliveryEnvironment: ReportDeliveryEnvironment;
    baseUrl?: string;
    apiKey?: string;
    from?: string;
    getRecipient?: (reference: string) => Promise<ReportRecipient | null>;
    issueToken?: (input: ReportRecipientVerification) => string;
    send?: (
      input: Parameters<typeof sendResendEmail>[0],
    ) => Promise<ReportEmailResult>;
  },
): Promise<"verification_required"> {
  const policy = resolveReportDeliveryPolicy(dependencies.deliveryEnvironment);
  if (!policy.requiresRecipientVerification) {
    throw new ReportEmailDeliveryError(
      "REPORT_RECIPIENT_VERIFICATION_NOT_REQUIRED",
    );
  }

  const apiKey = dependencies.apiKey ?? process.env.RESEND_API_KEY?.trim();
  const from = dependencies.from ?? process.env.REPORT_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new ReportEmailDeliveryError("EMAIL_CONFIGURATION_MISSING");
  }
  const recipient = await (dependencies.getRecipient ?? defaultRecipient)(
    reference,
  );
  if (!recipient) throw new ReportEmailDeliveryError("ASSESSMENT_NOT_FOUND");

  const verificationUrl = verificationUrlFor(
    dependencies.baseUrl ?? process.env.APP_BASE_URL,
    (dependencies.issueToken ?? issueReportRecipientVerificationToken)(
      recipient,
    ),
  );
  const message = verificationEmailFor(recipient, verificationUrl, from);
  const send: NonNullable<typeof dependencies.send> =
    dependencies.send ?? ((input) => sendResendEmail(input));
  await send({ ...message, apiKey });
  return "verification_required";
}

async function defaultRecipient(
  reference: string,
): Promise<ReportRecipient | null> {
  const recipient = await getReportRecipientByReference(getDb(), reference);
  if (!recipient) return null;
  return { ...recipient, assessmentId: recipient.id };
}

function verificationUrlFor(
  baseUrl: string | undefined,
  token: string,
): string {
  let url: URL;
  try {
    url = new URL("/report/verify", baseUrl);
  } catch {
    throw new ReportEmailDeliveryError("REPORT_VERIFICATION_URL_MISCONFIGURED");
  }
  if (url.protocol !== "https:" || url.hostname === "localhost") {
    throw new ReportEmailDeliveryError("REPORT_VERIFICATION_URL_MISCONFIGURED");
  }
  url.hash = token;
  return url.toString();
}

function verificationEmailFor(
  recipient: ReportRecipient,
  verificationUrl: string,
  from: string,
) {
  const safeName = escapeHtml(recipient.name);
  const safeUrl = escapeHtml(verificationUrl);
  return {
    from,
    to: recipient.email,
    subject: "Confirm your email to receive your preliminary pool report",
    text: `Kia ora ${recipient.name},\n\nConfirm this email address to receive your preliminary pool feasibility report:\n${verificationUrl}\n\nThis confirmation link expires in one hour. If you did not request this report, you can ignore this email.`,
    html: `<p>Kia ora ${safeName},</p><p>Confirm this email address to receive your preliminary pool feasibility report.</p><p><a href="${safeUrl}">Confirm email and send my report</a></p><p><small>This confirmation link expires in one hour. If you did not request this report, you can ignore this email.</small></p>`,
    idempotencyKey: `assessment-report-verification/${recipient.reference}`,
  };
}
