import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  ReportEmailDeliveryError,
  type ReportEmailInput,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";
import { assessmentStatusLabel } from "@/modules/reporting/pool-feasibility-report";

export type AssessmentDeliveryChannel = "homeowner" | "internal_test_report";
export type AssessmentDeliveryOutcome = "sent" | "failed" | "unchanged";

export type AssessmentDeliveryClaim = {
  claimToken: string;
  channel: AssessmentDeliveryChannel;
  homeownerName: string;
  homeownerEmail: string;
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
  /** @deprecated PDF delivery is disabled while public HTML email is used. */
  renderPdf?: (report: SavedPreliminaryReport) => Promise<Buffer>;
  /** @deprecated Delivery no longer changes between Preview and Production. */
  deliveryEnvironment?: unknown;
  /** @deprecated Homeowner consent is captured at report submission. */
  recipientVerified?: boolean;
};

export async function deliverAssessmentReport(
  reference: string,
  dependencies: AssessmentReportDeliveryDependencies,
): Promise<Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome>> {
  const outcomes: Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome> =
    {
      homeowner: "unchanged",
      internal_test_report: "unchanged",
    };
  const claim = await dependencies.store.claim(reference, "homeowner");
  if (!claim) return outcomes;

  try {
    const result = await dependencies.send(emailForHomeowner(claim, dependencies));
    await dependencies.store.markSent(
      reference,
      claim.channel,
      claim.claimToken,
      result.id,
    );
    outcomes.homeowner = "sent";
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
    outcomes.homeowner = "failed";
  }

  return outcomes;
}

function emailForHomeowner(
  claim: AssessmentDeliveryClaim,
  dependencies: Pick<AssessmentReportDeliveryDependencies, "from">,
): ReportEmailInput {
  const shortAddress = claim.report.property.address.split(",")[0]?.trim();
  const subject = `Your Preliminary Pool Feasibility Report - ${shortAddress || claim.report.property.address}`;
  const greeting = `Kia ora ${claim.homeownerName},`;
  const overallStatus = assessmentStatusLabel(claim.report.overall.status);
  const mainFinding = claim.report.keyFindings[0];
  const mainFindingText = mainFinding
    ? `${mainFinding.title}: ${mainFinding.clientSummary}`
    : "No additional material mapped finding was identified.";
  const text = `${greeting}\n\nPreliminary Pool Feasibility Report\n${claim.report.property.address}\n\nOverall result:\n${overallStatus}\n\n${claim.report.overall.summary}\n\nMain finding:\n${mainFindingText}\n\nRecommended next step:\n${claim.report.overall.recommendedStage}\n\nReference: ${claim.report.reference}\n\nThis is a preliminary desktop assessment, not surveying, engineering advice, consent or approval to undertake construction.`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;color:#1f2937;background:#f1f5f9;padding:24px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td style="background:#173755;color:#ffffff;padding:28px 32px"><p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Royal Glass</p><h1 style="margin:0;font-size:25px;line-height:1.3">Your preliminary pool feasibility report</h1></td></tr><tr><td style="padding:28px 32px"><p>${escapeHtml(greeting)}</p><p><strong>${escapeHtml(claim.report.property.address)}</strong></p><p style="padding:16px;background:#eff6ff;border-radius:8px"><strong>Overall result:</strong><br>${escapeHtml(overallStatus)}</p><p>${escapeHtml(claim.report.overall.summary)}</p><p><strong>Main finding:</strong><br>${escapeHtml(mainFindingText)}</p><p><strong>Recommended next step:</strong><br>${escapeHtml(claim.report.overall.recommendedStage)}</p><p style="font-size:12px;color:#4b5563">Reference: ${escapeHtml(claim.report.reference)}. This is a preliminary desktop assessment, not surveying, engineering advice, consent or approval to undertake construction.</p></td></tr></table></td></tr></table>`;

  return {
    from: dependencies.from,
    to: claim.homeownerEmail,
    subject,
    html,
    text,
    idempotencyKey: `assessment-report/${claim.report.reference}/homeowner`,
  };
}
