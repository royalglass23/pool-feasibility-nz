import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { preliminaryReportFilename } from "@/modules/reporting/preliminary-report";
import {
  ReportEmailDeliveryError,
  type ReportEmailInput,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";

export type AssessmentDeliveryChannel = "homeowner" | "servicem8";
export type AssessmentDeliveryOutcome = "sent" | "failed" | "unchanged";

export type AssessmentDeliveryClaim = {
  channel: AssessmentDeliveryChannel;
  claimToken: string;
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
  renderPdf: (report: SavedPreliminaryReport) => Promise<Buffer>;
  send: (input: ReportEmailInput) => Promise<ReportEmailResult>;
  from: string;
  serviceM8Email: string;
};

export async function deliverAssessmentReport(
  reference: string,
  dependencies: AssessmentReportDeliveryDependencies,
): Promise<Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome>> {
  const claims = await Promise.all(
    (["homeowner", "servicem8"] as const).map((channel) =>
      dependencies.store.claim(reference, channel),
    ),
  );
  const activeClaims = claims.filter(
    (claim): claim is AssessmentDeliveryClaim => claim !== null,
  );
  const outcomes: Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome> =
    {
      homeowner: "unchanged",
      servicem8: "unchanged",
    };
  if (activeClaims.length === 0) return outcomes;

  let pdf: Buffer;
  try {
    pdf = await dependencies.renderPdf(activeClaims[0].report);
  } catch {
    await Promise.all(
      activeClaims.map(async (claim) => {
        outcomes[claim.channel] = "failed";
        await dependencies.store.markFailed(
          reference,
          claim.channel,
          claim.claimToken,
          "REPORT_PDF_GENERATION_FAILED",
        );
      }),
    );
    return outcomes;
  }

  await Promise.all(
    activeClaims.map(async (claim) => {
      try {
        const result = await dependencies.send(
          emailForClaim(claim, pdf, dependencies),
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

  return outcomes;
}

function emailForClaim(
  claim: AssessmentDeliveryClaim,
  pdf: Buffer,
  dependencies: Pick<
    AssessmentReportDeliveryDependencies,
    "from" | "serviceM8Email"
  >,
): ReportEmailInput {
  const homeowner = claim.channel === "homeowner";
  const to = homeowner ? claim.homeownerEmail : dependencies.serviceM8Email;
  const subject = homeowner
    ? `Your preliminary pool feasibility report – ${claim.report.reference}`
    : `New pool feasibility enquiry ${claim.report.reference} – ${claim.report.property.address}`;
  const greeting = homeowner
    ? `Kia ora ${claim.homeownerName},`
    : "Kia ora Royal Glass team,";
  const text = `${greeting}\n\nThe preliminary pool feasibility report for ${claim.report.property.address} is attached.\n\nReference: ${claim.report.reference}\nStatus: ${claim.report.warningState.replaceAll("_", " ")}\n\nThis is a preliminary assessment, not approval or construction advice.`;
  const html = `<p>${escapeHtml(greeting)}</p><p>The preliminary pool feasibility report for <strong>${escapeHtml(claim.report.property.address)}</strong> is attached.</p><p><strong>Reference:</strong> ${escapeHtml(claim.report.reference)}<br><strong>Status:</strong> ${escapeHtml(claim.report.warningState.replaceAll("_", " "))}</p><p>This is a preliminary assessment, not approval or construction advice.</p>`;

  return {
    from: dependencies.from,
    to,
    subject,
    html,
    text,
    attachment: pdf,
    filename: preliminaryReportFilename(claim.report),
    idempotencyKey: `assessment-report/${claim.report.reference}/${claim.channel}`,
  };
}
