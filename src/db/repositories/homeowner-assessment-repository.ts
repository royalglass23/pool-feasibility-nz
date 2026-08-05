import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import {
  persistedAssessmentSubmissionSchema,
  type PersistedAssessmentSubmission,
} from "@/modules/assessment/persisted-assessment";
import type {
  AssessmentDeliveryChannel,
  AssessmentDeliveryClaim,
  AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";
import {
  buildSavedPreliminaryReport,
  type SavedPreliminaryReportSource,
} from "@/modules/reporting/preliminary-report";
import {
  parseStaffDeliveryState,
  type StaffAssessmentRecord,
  type StaffAssessmentSummary,
} from "@/modules/staff/staff-assessment-read-model";

type Database = NeonHttpDatabase<typeof schema>;

export async function listHomeownerAssessments(
  db: Database,
): Promise<StaffAssessmentSummary[]> {
  const assessments = await db.query.homeownerAssessments.findMany({
    columns: {
      id: true,
      reference: true,
      homeownerName: true,
      homeownerAddress: true,
      desiredTiming: true,
      feasibilityState: true,
      createdAt: true,
      archivedAt: true,
      poolLayout: true,
      layerStates: true,
    },
    where: isNull(schema.homeownerAssessments.archivedAt),
    orderBy: [desc(schema.homeownerAssessments.createdAt)],
  });

  return assessments.map((assessment) => {
    const parsedLayout =
      persistedAssessmentSubmissionSchema.shape.poolLayout.parse(
        assessment.poolLayout,
      );
    const parsedLayers =
      persistedAssessmentSubmissionSchema.shape.layerStates.parse(
        assessment.layerStates,
      );
    return {
      id: assessment.id,
      reference: assessment.reference,
      homeownerName: assessment.homeownerName,
      homeownerAddress: assessment.homeownerAddress,
      desiredTiming:
        persistedAssessmentSubmissionSchema.shape.homeowner.shape.desiredTiming.parse(
          assessment.desiredTiming,
        ),
      feasibilityState:
        persistedAssessmentSubmissionSchema.shape.report.shape.feasibilityState.parse(
          assessment.feasibilityState,
        ),
      createdAt: assessment.createdAt,
      poolLayout: {
        lengthMetres: parsedLayout.lengthMetres,
        widthMetres: parsedLayout.widthMetres,
        rotationDegrees: parsedLayout.rotationDegrees,
      },
      evidenceCount: parsedLayers.length,
    };
  });
}

export async function getHomeownerAssessmentById(
  db: Database,
  id: string,
): Promise<StaffAssessmentRecord | null> {
  const assessment = await db.query.homeownerAssessments.findFirst({
    columns: {
      id: true,
      reference: true,
      status: true,
      homeownerName: true,
      homeownerPhone: true,
      homeownerEmail: true,
      homeownerAddress: true,
      visitorType: true,
      visitorTypeOtherDetail: true,
      desiredTiming: true,
      desiredTimingOtherDetail: true,
      additionalInfo: true,
      boundaryStatus: true,
      feasibilityState: true,
      emailDeliveryState: true,
      forwardingState: true,
      createdAt: true,
      archivedAt: true,
    },
    where: and(
      eq(schema.homeownerAssessments.id, id),
      isNull(schema.homeownerAssessments.archivedAt),
    ),
  });

  if (!assessment || assessment.archivedAt !== null) return null;

  return {
    id: assessment.id,
    reference: assessment.reference,
    status: assessment.status,
    homeownerName: assessment.homeownerName,
    homeownerPhone: assessment.homeownerPhone,
    homeownerEmail: assessment.homeownerEmail,
    homeownerAddress: assessment.homeownerAddress,
    visitorType:
      assessment.visitorType === null
        ? null
        : persistedAssessmentSubmissionSchema.shape.homeowner.shape.visitorType.parse(
            assessment.visitorType,
          ),
    visitorTypeOtherDetail: assessment.visitorTypeOtherDetail,
    desiredTiming:
      persistedAssessmentSubmissionSchema.shape.homeowner.shape.desiredTiming.parse(
        assessment.desiredTiming,
      ),
    desiredTimingOtherDetail: assessment.desiredTimingOtherDetail,
    additionalInfo: assessment.additionalInfo,
    boundaryStatus:
      persistedAssessmentSubmissionSchema.shape.addressEvidence.shape.boundaryStatus.parse(
        assessment.boundaryStatus,
      ),
    feasibilityState:
      persistedAssessmentSubmissionSchema.shape.report.shape.feasibilityState.parse(
        assessment.feasibilityState,
      ),
    emailDeliveryState: parseStaffDeliveryState(assessment.emailDeliveryState),
    forwardingState: parseStaffDeliveryState(assessment.forwardingState),
    createdAt: assessment.createdAt,
  };
}

export async function getSavedPreliminaryReportById(db: Database, id: string) {
  const assessment = await db.query.homeownerAssessments.findFirst({
    where: and(
      eq(schema.homeownerAssessments.id, id),
      isNull(schema.homeownerAssessments.archivedAt),
    ),
  });
  if (
    !assessment ||
    assessment.archivedAt !== null ||
    !assessment.reportMapImageDataUrl
  ) {
    return null;
  }
  return buildSavedPreliminaryReport({
    reference: assessment.reference,
    createdAt: assessment.createdAt.toISOString(),
    submission: submissionFromRow(assessment, assessment.reportMapImageDataUrl),
  });
}

export async function saveHomeownerAssessment(
  db: Database,
  submission: PersistedAssessmentSubmission,
) {
  const existing = await db.query.homeownerAssessments.findFirst({
    where: eq(
      schema.homeownerAssessments.idempotencyKey,
      submission.idempotencyKey,
    ),
  });
  if (existing) return { created: false, assessment: existing };

  const sequenceResult = await db.execute<{ value: string }>(
    sql`select nextval('homeowner_assessment_reference_seq') as value`,
  );
  const value = sequenceResult.rows[0]?.value;
  if (!value)
    throw new Error("Assessment reference sequence returned no value.");
  const year = new Date().getUTCFullYear();
  const reference = `GF-${year}-${String(value).padStart(6, "0")}`;
  const id = randomUUID();

  const [assessment] = await db
    .insert(schema.homeownerAssessments)
    .values({
      id,
      reference,
      idempotencyKey: submission.idempotencyKey,
      homeownerName: submission.homeowner.name,
      homeownerPhone: submission.homeowner.phone,
      homeownerEmail: submission.homeowner.email,
      homeownerAddress: submission.homeowner.address,
      visitorType: submission.homeowner.visitorType,
      visitorTypeOtherDetail: submission.homeowner.visitorTypeOtherDetail,
      desiredTiming: submission.homeowner.desiredTiming,
      desiredTimingOtherDetail: submission.homeowner.desiredTimingOtherDetail,
      additionalInfo: submission.homeowner.additionalInfo,
      consentGiven: submission.homeowner.consentGiven,
      consentVersion: submission.homeowner.consentVersion,
      consentedAt: new Date(submission.homeowner.consentedAt),
      selectedAddressId: submission.addressEvidence.selectedAddressId,
      formattedAddress: submission.addressEvidence.formattedAddress,
      latitude: submission.addressEvidence.latitude,
      longitude: submission.addressEvidence.longitude,
      boundaryStatus: submission.addressEvidence.boundaryStatus,
      parcelIdentifier: submission.addressEvidence.parcelIdentifier,
      addressEvidence: submission.addressEvidence,
      poolLayout: submission.poolLayout,
      layerStates: submission.layerStates,
      warnings: submission.warnings,
      recommendations: submission.recommendations,
      reportData: submission.report.reportData,
      reportTitle: submission.report.title,
      reportSummary: submission.report.summary,
      reportMapImageDataUrl: submission.report.mapImageDataUrl,
      feasibilityState: submission.report.feasibilityState,
      analysisVersion: submission.report.analysisVersion,
    })
    .onConflictDoNothing({
      target: schema.homeownerAssessments.idempotencyKey,
    })
    .returning();

  if (assessment) return { created: true, assessment };

  const raced = await db.query.homeownerAssessments.findFirst({
    where: eq(
      schema.homeownerAssessments.idempotencyKey,
      submission.idempotencyKey,
    ),
  });
  if (!raced)
    throw new Error("Assessment idempotency conflict could not be resolved.");
  return { created: false, assessment: raced };
}

const DELIVERY_CLAIM_STALE_MS = 5 * 60 * 1_000;
const assessmentTable = schema.homeownerAssessments;
const deliveryChannelConfig = {
  homeowner: {
    state: assessmentTable.emailDeliveryState,
    lastAttemptedAt: assessmentTable.emailDeliveryLastAttemptedAt,
    claimToken: assessmentTable.emailDeliveryClaimToken,
    sendingValues: (attemptedAt: Date, claimToken: string) => ({
      emailDeliveryState: "sending",
      emailDeliveryAttemptCount: sql`${assessmentTable.emailDeliveryAttemptCount} + 1`,
      emailDeliveryLastAttemptedAt: attemptedAt,
      emailDeliveryLastErrorCode: null,
      emailDeliveryClaimToken: claimToken,
      updatedAt: attemptedAt,
    }),
    sentValues: (completedAt: Date, providerMessageId: string) => ({
      emailDeliveryState: "sent",
      emailDeliverySentAt: completedAt,
      emailDeliveryProviderMessageId: providerMessageId,
      emailDeliveryLastErrorCode: null,
      emailDeliveryClaimToken: null,
      updatedAt: completedAt,
    }),
    failedValues: (completedAt: Date, errorCode: string) => ({
      emailDeliveryState: "failed",
      emailDeliveryLastErrorCode: errorCode,
      emailDeliveryClaimToken: null,
      updatedAt: completedAt,
    }),
  },
  servicem8: {
    state: assessmentTable.forwardingState,
    lastAttemptedAt: assessmentTable.forwardingLastAttemptedAt,
    claimToken: assessmentTable.forwardingClaimToken,
    sendingValues: (attemptedAt: Date, claimToken: string) => ({
      forwardingState: "sending",
      forwardingAttemptCount: sql`${assessmentTable.forwardingAttemptCount} + 1`,
      forwardingLastAttemptedAt: attemptedAt,
      forwardingLastErrorCode: null,
      forwardingClaimToken: claimToken,
      updatedAt: attemptedAt,
    }),
    sentValues: (completedAt: Date, providerMessageId: string) => ({
      forwardingState: "sent",
      forwardingSentAt: completedAt,
      forwardingProviderMessageId: providerMessageId,
      forwardingLastErrorCode: null,
      forwardingClaimToken: null,
      updatedAt: completedAt,
    }),
    failedValues: (completedAt: Date, errorCode: string) => ({
      forwardingState: "failed",
      forwardingLastErrorCode: errorCode,
      forwardingClaimToken: null,
      updatedAt: completedAt,
    }),
  },
} as const;

export function createAssessmentDeliveryStore(
  db: Database,
  now: () => Date = () => new Date(),
): AssessmentDeliveryStore {
  return {
    claim: (reference, channel) =>
      claimAssessmentDelivery(db, reference, channel, now),
    markSent: (reference, channel, claimToken, providerMessageId) =>
      markAssessmentDeliverySent(
        db,
        reference,
        channel,
        claimToken,
        providerMessageId,
        now(),
      ),
    markFailed: (reference, channel, claimToken, errorCode) =>
      markAssessmentDeliveryFailed(
        db,
        reference,
        channel,
        claimToken,
        errorCode,
        now(),
      ),
  };
}

async function claimAssessmentDelivery(
  db: Database,
  reference: string,
  channel: AssessmentDeliveryChannel,
  now: () => Date,
): Promise<AssessmentDeliveryClaim | null> {
  const attemptedAt = now();
  const staleBefore = new Date(attemptedAt.getTime() - DELIVERY_CLAIM_STALE_MS);
  const claimToken = randomUUID();
  const config = deliveryChannelConfig[channel];
  const [assessment] = await db
    .update(assessmentTable)
    .set(config.sendingValues(attemptedAt, claimToken))
    .where(
      and(
        eq(assessmentTable.reference, reference),
        or(
          inArray(config.state, ["pending", "failed"]),
          and(
            eq(config.state, "sending"),
            or(
              isNull(config.lastAttemptedAt),
              lt(config.lastAttemptedAt, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning();
  if (!assessment) return null;
  if (channel === "servicem8") {
    return {
      channel,
      claimToken,
      notification: {
        reference: assessment.reference,
        name: assessment.homeownerName,
        phone: assessment.homeownerPhone,
        email: assessment.homeownerEmail,
        checkedAddress: assessment.formattedAddress,
        visitorType:
          assessment.visitorType === null
            ? null
            : persistedAssessmentSubmissionSchema.shape.homeowner.shape.visitorType.parse(
                assessment.visitorType,
              ),
        visitorTypeOtherDetail: assessment.visitorTypeOtherDetail ?? undefined,
        desiredTiming:
          persistedAssessmentSubmissionSchema.shape.homeowner.shape.desiredTiming.parse(
            assessment.desiredTiming,
          ),
        desiredTimingOtherDetail:
          assessment.desiredTimingOtherDetail ?? undefined,
      },
    };
  }
  if (!assessment.reportMapImageDataUrl) {
    await markAssessmentDeliveryFailed(
      db,
      reference,
      channel,
      claimToken,
      "REPORT_MAP_MISSING",
      attemptedAt,
    );
    return null;
  }

  return {
    channel,
    claimToken,
    homeownerName: assessment.homeownerName,
    homeownerEmail: assessment.homeownerEmail,
    report: buildSavedPreliminaryReport({
      reference: assessment.reference,
      createdAt: assessment.createdAt.toISOString(),
      submission: submissionFromRow(
        assessment,
        assessment.reportMapImageDataUrl,
      ),
    }),
  };
}

async function markAssessmentDeliverySent(
  db: Database,
  reference: string,
  channel: AssessmentDeliveryChannel,
  claimToken: string,
  providerMessageId: string,
  completedAt: Date,
): Promise<void> {
  const config = deliveryChannelConfig[channel];
  const rows = await db
    .update(assessmentTable)
    .set(config.sentValues(completedAt, providerMessageId))
    .where(
      and(
        eq(assessmentTable.reference, reference),
        eq(config.state, "sending"),
        eq(config.claimToken, claimToken),
      ),
    )
    .returning({ id: assessmentTable.id });
  if (rows.length === 0) throw new Error("ASSESSMENT_DELIVERY_CLAIM_LOST");
}

async function markAssessmentDeliveryFailed(
  db: Database,
  reference: string,
  channel: AssessmentDeliveryChannel,
  claimToken: string,
  errorCode: string,
  completedAt: Date,
): Promise<void> {
  const config = deliveryChannelConfig[channel];
  const rows = await db
    .update(assessmentTable)
    .set(config.failedValues(completedAt, errorCode))
    .where(
      and(
        eq(assessmentTable.reference, reference),
        eq(config.state, "sending"),
        eq(config.claimToken, claimToken),
      ),
    )
    .returning({ id: assessmentTable.id });
  if (rows.length === 0) throw new Error("ASSESSMENT_DELIVERY_CLAIM_LOST");
}

function submissionFromRow(
  assessment: schema.HomeownerAssessmentRow,
  mapImageDataUrl: string,
): SavedPreliminaryReportSource {
  return {
    addressEvidence:
      persistedAssessmentSubmissionSchema.shape.addressEvidence.parse(
        assessment.addressEvidence,
      ),
    poolLayout: persistedAssessmentSubmissionSchema.shape.poolLayout.parse(
      assessment.poolLayout,
    ),
    layerStates: persistedAssessmentSubmissionSchema.shape.layerStates.parse(
      assessment.layerStates,
    ),
    warnings: persistedAssessmentSubmissionSchema.shape.warnings.parse(
      assessment.warnings,
    ),
    recommendations:
      persistedAssessmentSubmissionSchema.shape.recommendations.parse(
        assessment.recommendations,
      ),
    report: {
      analysisVersion: assessment.analysisVersion,
      title: assessment.reportTitle,
      summary: assessment.reportSummary,
      feasibilityState: assessment.feasibilityState as
        "no_warning" | "needs_checking" | "blocked",
      mapImageDataUrl,
      reportData:
        persistedAssessmentSubmissionSchema.shape.report.shape.reportData.parse(
          assessment.reportData,
        ),
    },
  };
}
