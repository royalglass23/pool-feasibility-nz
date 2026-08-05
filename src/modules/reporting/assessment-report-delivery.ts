import { getProjectTimingLabel } from "@/modules/assessment/visitor-context";
import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import { getVisitorTypeLabel } from "@/modules/assessment/visitor-type";
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

type AssessmentDeliveryClaimBase = {
  claimToken: string;
};

type HomeownerDeliveryClaim = AssessmentDeliveryClaimBase & {
  channel: "homeowner";
  homeownerName: string;
  homeownerEmail: string;
  report: SavedPreliminaryReport;
};

export type ServiceM8AssessmentNotification = {
  reference: string;
  name: string;
  phone: string;
  email: string;
  checkedAddress: string;
  visitorType: PersistedAssessmentSubmission["homeowner"]["visitorType"] | null;
  visitorTypeOtherDetail?: string;
  desiredTiming: PersistedAssessmentSubmission["homeowner"]["desiredTiming"];
  desiredTimingOtherDetail?: string;
};

type ServiceM8DeliveryClaim = AssessmentDeliveryClaimBase & {
  channel: "servicem8";
  notification: ServiceM8AssessmentNotification;
};

export type AssessmentDeliveryClaim =
  HomeownerDeliveryClaim | ServiceM8DeliveryClaim;

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

  await Promise.all(
    activeClaims.map(async (claim) => {
      let pdf: Buffer | undefined;
      if (claim.channel === "homeowner") {
        try {
          pdf = await dependencies.renderPdf(claim.report);
        } catch {
          await dependencies.store.markFailed(
            reference,
            claim.channel,
            claim.claimToken,
            "REPORT_PDF_GENERATION_FAILED",
          );
          outcomes[claim.channel] = "failed";
          return;
        }
      }

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
  pdf: Buffer | undefined,
  dependencies: Pick<
    AssessmentReportDeliveryDependencies,
    "from" | "serviceM8Email"
  >,
): ReportEmailInput {
  const homeowner = claim.channel === "homeowner";
  if (!homeowner) {
    const notification = claim.notification;
    const facts = [
      ["Reference", notification.reference],
      ["Name", notification.name],
      ["Phone", notification.phone],
      ["Email", notification.email],
      ["Checked Property Address", notification.checkedAddress],
      ["Visitor type", visitorTypeLabel(notification)],
      ["Project Timing", desiredTimingLabel(notification)],
    ] as const;
    return {
      from: dependencies.from,
      to: dependencies.serviceM8Email,
      subject: `New pool feasibility enquiry ${notification.reference}`,
      html: `<p>${facts
        .map(
          ([label, value]) => `<strong>${label}:</strong> ${escapeHtml(value)}`,
        )
        .join("<br>")}</p>`,
      text: facts.map(([label, value]) => `${label}: ${value}`).join("\n"),
      idempotencyKey: `assessment-report/${notification.reference}/${claim.channel}`,
    };
  }

  if (!pdf) throw new Error("HOMEOWNER_REPORT_PDF_MISSING");

  const to = claim.homeownerEmail;
  const subject = `Your preliminary pool feasibility report - ${claim.report.reference}`;
  const greeting = `Kia ora ${claim.homeownerName},`;
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

function visitorTypeLabel(
  notification: ServiceM8AssessmentNotification,
): string {
  if (notification.visitorType === null) return "Not captured";
  return notification.visitorType === "other"
    ? `Other - ${notification.visitorTypeOtherDetail ?? "Not provided"}`
    : getVisitorTypeLabel(notification.visitorType);
}

function desiredTimingLabel(
  notification: ServiceM8AssessmentNotification,
): string {
  if (notification.desiredTiming === "other") {
    return `Other - ${notification.desiredTimingOtherDetail ?? "Not provided"}`;
  }
  return getProjectTimingLabel(notification.desiredTiming);
}
