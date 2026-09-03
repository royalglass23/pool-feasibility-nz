import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  getProjectTimingLabel,
  type ProjectTiming,
} from "@/modules/assessment/visitor-context";
import {
  getVisitorTypeLabel,
  type VisitorType,
} from "@/modules/assessment/visitor-type";
import {
  ReportEmailDeliveryError,
  type ReportEmailInput,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";
import { assessmentStatusLabel } from "@/modules/reporting/pool-feasibility-report";
import { preliminaryReportFilename } from "@/modules/reporting/preliminary-report";
import {
  resolveReportDeliveryPolicy,
  type ReportDeliveryEnvironment,
} from "@/modules/reporting/report-delivery-policy";

export type AssessmentDeliveryChannel = "homeowner" | "internal_test_report";
export type AssessmentDeliveryOutcome = "sent" | "failed" | "unchanged";

export type AssessmentDeliveryClaim = {
  claimToken: string;
  channel: AssessmentDeliveryChannel;
  homeownerName: string;
  homeownerPhone: string;
  homeownerEmail: string;
  visitorType: VisitorType | null;
  visitorTypeOtherDetail: string | null;
  desiredTiming: ProjectTiming;
  desiredTimingOtherDetail: string | null;
  additionalInfo: string | null;
  report: SavedPreliminaryReport;
};

export interface AssessmentDeliveryStore {
  claim(
    reference: string,
    channel: AssessmentDeliveryChannel,
  ): Promise<AssessmentDeliveryClaim | null>;
  markSent(
    reference: string,
    channel: AssessmentDeliveryChannel,
    claimToken: string,
    providerMessageId: string,
  ): Promise<void>;
  markFailed(
    reference: string,
    channel: AssessmentDeliveryChannel,
    claimToken: string,
    errorCode: string,
  ): Promise<void>;
}

export type AssessmentReportDeliveryDependencies = {
  store: AssessmentDeliveryStore;
  send: (input: ReportEmailInput) => Promise<ReportEmailResult>;
  from: string;
  brandLogoUrl?: string;
  renderPdf: (report: SavedPreliminaryReport) => Promise<Buffer>;
  deliveryEnvironment: ReportDeliveryEnvironment;
};

const SUPPORT_REPORT_EMAIL = "support@royalglass.co.nz";

export async function deliverAssessmentReport(
  reference: string,
  dependencies: AssessmentReportDeliveryDependencies,
): Promise<Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome>> {
  const policy = resolveReportDeliveryPolicy(dependencies.deliveryEnvironment);
  const outcomes: Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome> =
    {
      homeowner: "unchanged",
      internal_test_report: "unchanged",
    };
  const claims = (
    await Promise.all(
      policy.channels.map((channel) =>
        dependencies.store.claim(reference, channel),
      ),
    )
  ).filter((claim): claim is AssessmentDeliveryClaim => claim !== null);
  if (claims.length === 0) return outcomes;

  try {
    const pdf = await dependencies.renderPdf(claims[0]!.report);
    await Promise.all(
      claims.map(async (claim) => {
        try {
          const result = await dependencies.send(
            claim.channel === "homeowner"
              ? emailForHomeowner(claim, dependencies, pdf)
              : emailForInternalTestReport(claim, dependencies, pdf),
          );
          await dependencies.store.markSent(
            reference,
            claim.channel,
            claim.claimToken,
            result.id,
          );
          outcomes[claim.channel] = "sent";
        } catch (error) {
          const errorCode =
            error instanceof ReportEmailDeliveryError
              ? error.code
              : "EMAIL_DELIVERY_FAILED";
          await dependencies.store.markFailed(
            reference,
            claim.channel,
            claim.claimToken,
            errorCode,
          );
          outcomes[claim.channel] = "failed";
        }
      }),
    );
  } catch {
    await Promise.all(
      claims.map(async (claim) => {
        await dependencies.store.markFailed(
          reference,
          claim.channel,
          claim.claimToken,
          "REPORT_PDF_GENERATION_FAILED",
        );
        outcomes[claim.channel] = "failed";
      }),
    );
  }

  return outcomes;
}

function emailForHomeowner(
  claim: AssessmentDeliveryClaim,
  dependencies: Pick<
    AssessmentReportDeliveryDependencies,
    "from" | "brandLogoUrl"
  >,
  pdf: Buffer,
): ReportEmailInput {
  const shortAddress = claim.report.property.address.split(",")[0]?.trim();
  const subject = `Your Preliminary Pool Feasibility Report - ${shortAddress || claim.report.property.address}`;
  const greeting = `Kia ora ${claim.homeownerName},`;
  const overallStatus = assessmentStatusLabel(claim.report.overall.status);
  const mainFinding = claim.report.keyFindings[0];
  const mainFindingText = mainFinding
    ? `${mainFinding.title}: ${mainFinding.clientSummary}`
    : "No additional material mapped finding was identified.";
  const brandLogoUrl = escapeHtml(
    dependencies.brandLogoUrl ?? "/brand/pool-ready-logo.png",
  );
  const replyInvitation =
    "Whether it’s about your report, your site or what to do next, simply reply to this email. We’ll help you make sense of it and work out the best next step.";
  const text = `${greeting}\n\nPoolReady preliminary pool feasibility report\n${claim.report.property.address}\n\nOverall result:\n${overallStatus}\n\n${claim.report.overall.summary}\n\nMain finding:\n${mainFindingText}\n\nHave questions? Let’s talk it through.\n${replyInvitation}\n\nReference: ${claim.report.reference}\n\nThis is a preliminary desktop assessment, not surveying, engineering advice, consent or approval to undertake construction.`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;color:#1f2937;background:#f1f5f9;padding:24px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td style="background:#173755;color:#ffffff;padding:28px 32px"><a href="https://www.poolready.co.nz/" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#ffffff;border-radius:6px;padding:8px 12px"><img src="${brandLogoUrl}" alt="PoolReady" width="176" style="display:block;width:176px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none"></a><h1 style="margin:20px 0 0;font-size:25px;line-height:1.3">Your preliminary pool feasibility report</h1></td></tr><tr><td style="padding:28px 32px"><p>${escapeHtml(greeting)}</p><p><strong>${escapeHtml(claim.report.property.address)}</strong></p><p style="padding:16px;background:#eff6ff;border-radius:8px"><strong>Overall result:</strong><br>${escapeHtml(overallStatus)}</p><p>${escapeHtml(claim.report.overall.summary)}</p><p><strong>Main finding:</strong><br>${escapeHtml(mainFindingText)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 12px;border:1px solid #b9dddb;border-radius:12px;background:#effaf8"><tr><td style="padding:22px 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" style="width:42px;padding:2px 14px 0 0"><div style="width:38px;height:38px;border-radius:19px;background:#0f766e;color:#ffffff;font-size:23px;font-weight:bold;line-height:38px;text-align:center">↩</div></td><td><h2 style="margin:0 0 7px;color:#173755;font-size:19px;line-height:1.3">Have questions? Let’s talk it through.</h2><p style="margin:0 0 15px;color:#334155;font-size:15px;line-height:1.55">${escapeHtml(replyInvitation)}</p><span style="display:inline-block;border-radius:6px;background:#0f766e;padding:11px 16px;color:#ffffff;font-size:14px;font-weight:bold">Reply and talk with us</span></td></tr></table></td></tr></table><p style="font-size:12px;color:#4b5563">Reference: ${escapeHtml(claim.report.reference)}. This is a preliminary desktop assessment, not surveying, engineering advice, consent or approval to undertake construction.</p></td></tr></table></td></tr></table>`;

  return {
    from: dependencies.from,
    to: claim.homeownerEmail,
    replyTo: SUPPORT_REPORT_EMAIL,
    subject,
    html,
    text,
    attachment: pdf,
    filename: preliminaryReportFilename(claim.report),
    idempotencyKey: `assessment-report/${claim.report.reference}/homeowner`,
  };
}

function emailForInternalTestReport(
  claim: AssessmentDeliveryClaim,
  dependencies: Pick<
    AssessmentReportDeliveryDependencies,
    "from" | "brandLogoUrl"
  >,
  pdf: Buffer,
): ReportEmailInput {
  const shortAddress = claim.report.property.address.split(",")[0]?.trim();
  const subject = `New PoolReady report request - ${shortAddress || claim.report.property.address}`;
  const formAnswers = supportFormAnswers(claim);
  const overallStatus = assessmentStatusLabel(claim.report.overall.status);
  const mainFinding = claim.report.keyFindings[0];
  const mainFindingText = mainFinding
    ? `${mainFinding.title}: ${mainFinding.clientSummary}`
    : "No additional material mapped finding was identified.";
  const text = [
    "New PoolReady preliminary report request",
    "",
    "The preliminary report is attached.",
    `Reference: ${claim.report.reference}`,
    "",
    "Overall result:",
    overallStatus,
    claim.report.overall.summary,
    "",
    "Main finding:",
    mainFindingText,
    "",
    "Submitted form answers:",
    ...formAnswers.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlRows = formAnswers
    .map(
      ([label, value]) =>
        `<tr><th align="left" valign="top" style="padding:8px 16px 8px 0;color:#4b5563;font-weight:600">${escapeHtml(label)}</th><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return {
    from: dependencies.from,
    to: SUPPORT_REPORT_EMAIL,
    replyTo: claim.homeownerEmail,
    subject,
    text,
    html: `<h1>New PoolReady preliminary report request</h1><p>The preliminary report is attached.</p><p><strong>Reference:</strong> ${escapeHtml(claim.report.reference)}</p><h2>Overall result</h2><p><strong>${escapeHtml(overallStatus)}</strong></p><p>${escapeHtml(claim.report.overall.summary)}</p><h2>Main finding</h2><p>${escapeHtml(mainFindingText)}</p><h2>Submitted form answers</h2><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;color:#1f2937">${htmlRows}</table>`,
    attachment: pdf,
    filename: preliminaryReportFilename(claim.report),
    idempotencyKey: `assessment-report/${claim.report.reference}/internal_test_report`,
  };
}

function supportFormAnswers(
  claim: AssessmentDeliveryClaim,
): [string, string][] {
  return [
    ["Name", claim.homeownerName],
    ["Phone", claim.homeownerPhone],
    ["Email", claim.homeownerEmail],
    ["Property address", claim.report.property.address],
    ["I am a", visitorTypeAnswer(claim)],
    ["When do you need it?", desiredTimingAnswer(claim)],
    ["Additional info", claim.additionalInfo || "Not provided"],
  ];
}

function visitorTypeAnswer(claim: AssessmentDeliveryClaim): string {
  if (claim.visitorType === null) return "Not provided";
  const label = getVisitorTypeLabel(claim.visitorType);
  return claim.visitorTypeOtherDetail
    ? `${label}: ${claim.visitorTypeOtherDetail}`
    : label;
}

function desiredTimingAnswer(claim: AssessmentDeliveryClaim): string {
  if (claim.desiredTiming === "other") {
    return claim.desiredTimingOtherDetail
      ? `Other: ${claim.desiredTimingOtherDetail}`
      : "Other";
  }
  return getProjectTimingLabel(claim.desiredTiming);
}
