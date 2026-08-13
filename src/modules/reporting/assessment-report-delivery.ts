import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { preliminaryReportFilename } from "@/modules/reporting/preliminary-report";
import {
  ReportEmailDeliveryError,
  type ReportEmailInput,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";
import { assessmentStatusLabel } from "@/modules/reporting/pool-feasibility-report";

export type AssessmentDeliveryChannel = "homeowner" | "internal_test_report";
export type AssessmentDeliveryOutcome = "sent" | "failed" | "unchanged";
const INTERNAL_TEST_REPORT_RECIPIENT = "royalglass666@gmail.com";

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
  renderPdf: (report: SavedPreliminaryReport) => Promise<Buffer>;
  send: (input: ReportEmailInput) => Promise<ReportEmailResult>;
  from: string;
  deliveryEnvironment: {
    mode?: string;
    vercelEnvironment?: string;
    nodeEnvironment?: string;
  };
};

export async function deliverAssessmentReport(
  reference: string,
  dependencies: AssessmentReportDeliveryDependencies,
): Promise<Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome>> {
  if (!isControlledSyntheticTestDelivery(dependencies.deliveryEnvironment)) {
    throw new ReportEmailDeliveryError(
      "SYNTHETIC_TEST_REPORT_DELIVERY_DISABLED",
    );
  }

  const claims = await Promise.all(
    (["homeowner", "internal_test_report"] as const).map((channel) =>
      dependencies.store.claim(reference, channel),
    ),
  );
  const activeClaims = claims.filter(
    (claim): claim is AssessmentDeliveryClaim => claim !== null,
  );
  const outcomes: Record<AssessmentDeliveryChannel, AssessmentDeliveryOutcome> =
    {
      homeowner: "unchanged",
      internal_test_report: "unchanged",
    };
  if (activeClaims.length === 0) return outcomes;

  let pdf: Buffer;
  try {
    pdf = await dependencies.renderPdf(activeClaims[0].report);
  } catch {
    await Promise.all(
      activeClaims.map(async (claim) => {
        await dependencies.store.markFailed(
          reference,
          claim.channel,
          claim.claimToken,
          "REPORT_PDF_GENERATION_FAILED",
        );
        outcomes[claim.channel] = "failed";
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

function isControlledSyntheticTestDelivery(
  environment: AssessmentReportDeliveryDependencies["deliveryEnvironment"],
) {
  if (environment.mode !== "synthetic_test") return false;
  if (environment.vercelEnvironment) {
    return environment.vercelEnvironment === "preview";
  }
  return (
    environment.nodeEnvironment === "development" ||
    environment.nodeEnvironment === "test"
  );
}

function emailForClaim(
  claim: AssessmentDeliveryClaim,
  pdf: Buffer,
  dependencies: Pick<AssessmentReportDeliveryDependencies, "from">,
): ReportEmailInput {
  const to =
    claim.channel === "homeowner"
      ? claim.homeownerEmail
      : INTERNAL_TEST_REPORT_RECIPIENT;
  const shortAddress = claim.report.property.address.split(",")[0]?.trim();
  const subject = `Your Preliminary Pool Feasibility Report - ${shortAddress || claim.report.property.address}`;
  const greeting = `Kia ora ${claim.homeownerName},`;
  const overallStatus = assessmentStatusLabel(claim.report.overall.status);
  const mainFinding = claim.report.keyFindings[0];
  const mainFindingText = mainFinding
    ? `${mainFinding.title}: ${mainFinding.clientSummary}`
    : "No additional material mapped finding was identified.";
  const text = `${greeting}\n\nPreliminary Pool Feasibility Report\n${claim.report.property.address}\n\nOverall result:\n${overallStatus}\n\n${claim.report.overall.summary}\n\nMain finding:\n${mainFindingText}\n\nRecommended next step:\n${claim.report.overall.recommendedStage}\n\nA PDF copy of the saved report is attached.\nReference: ${claim.report.reference}\n\nThis is a preliminary desktop assessment, not surveying, engineering advice, consent or approval to undertake construction.`;
  const html = `<p>${escapeHtml(greeting)}</p><h1 style="font-size:20px;line-height:1.3;margin:20px 0 4px">Preliminary Pool Feasibility Report</h1><p style="margin-top:0"><strong>${escapeHtml(claim.report.property.address)}</strong></p><p><strong>Overall result:</strong><br>${escapeHtml(overallStatus)}</p><p>${escapeHtml(claim.report.overall.summary)}</p><p><strong>Main finding:</strong><br>${escapeHtml(mainFindingText)}</p><p><strong>Recommended next step:</strong><br>${escapeHtml(claim.report.overall.recommendedStage)}</p><p>A PDF copy of the saved report is attached.</p><p><small>Reference: ${escapeHtml(claim.report.reference)}. This is a preliminary desktop assessment, not surveying, engineering advice, consent or approval to undertake construction.</small></p>`;

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
