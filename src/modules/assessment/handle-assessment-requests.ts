import { after } from "next/server";
import pino from "pino";
import { getDb } from "@/db/client";
import {
  getSavedPreliminaryReportById,
  listHomeownerAssessments,
  saveHomeownerAssessment,
} from "@/db/repositories/homeowner-assessment-repository";
import {
  buildServerAssessmentSubmission,
  parseBrowserAssessmentSaveRequest,
  ServerAssessmentSubmissionError,
} from "@/modules/assessment/server-assessment-submission";
import {
  AssessmentSnapshotValidationError,
  verifyAssessmentSnapshot,
} from "@/modules/assessment/assessment-snapshot";
import { startAssessmentReportDeliveryByReference } from "@/modules/reporting/deliver-assessment-report";
import { issueSavedReportAccessToken } from "@/modules/reporting/saved-report-access-token";
import { staffSessionDeniedResponse } from "@/modules/staff/staff-session";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import { ZodError } from "zod";

const MAX_BODY_BYTES = 6_500_000;
const logger = pino({ base: undefined });

export async function GET(request: Request) {
  const correlationId = requestCorrelationId(request);
  const sessionDenied = await staffSessionDeniedResponse(
    request,
    correlationId,
  );
  if (sessionDenied) return sessionDenied;

  const assessments = await listHomeownerAssessments(getDb());
  return apiJsonResponse({ data: { assessments } }, 200, correlationId, {
    "Cache-Control": "no-store",
  });
}

export async function POST(request: Request) {
  const correlationId = requestCorrelationId(request);
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    return apiErrorResponse(
      {
        code: "REQUEST_TOO_LARGE",
        message: "The submitted assessment is too large.",
      },
      413,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return apiErrorResponse(
      { code: "INVALID_REQUEST", message: "Submit one valid assessment." },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  let parsed;
  try {
    const browserRequest = parseBrowserAssessmentSaveRequest(input);
    const snapshot = verifyAssessmentSnapshot(
      browserRequest.assessmentSnapshot,
    );
    parsed = await buildServerAssessmentSubmission({
      request: browserRequest,
      snapshot,
    });
  } catch (error) {
    if (!(
      error instanceof ZodError ||
      error instanceof AssessmentSnapshotValidationError ||
      error instanceof ServerAssessmentSubmissionError
    )) {
      throw error;
    }
    return apiErrorResponse(
      {
        code: "INVALID_REQUEST",
        message: "The assessment details are incomplete or invalid.",
      },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  try {
    const db = getDb();
    const result = await saveHomeownerAssessment(db, parsed);
    const report = await getSavedPreliminaryReportById(
      db,
      result.assessment.id,
    );
    if (!report) {
      return apiErrorResponse(
        {
          code: "REPORT_GENERATION_FAILED",
          message: "The saved preliminary report is not available.",
        },
        500,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    const reportAccessToken = issueSavedReportAccessToken({
      assessmentId: result.assessment.id,
      reference: result.assessment.reference,
    });

    after(async () => {
      try {
        await startAssessmentReportDeliveryByReference(
          result.assessment.reference,
        );
      } catch {
        logger.error({
          event: "assessment_report_delivery",
          outcome: "failed",
          reference: result.assessment.reference,
          correlationId,
        });
      }
    });

    return apiJsonResponse(
      {
        assessment: {
          id: result.assessment.id,
          reference: result.assessment.reference,
          status: result.assessment.status,
          created: result.created,
          report,
          reportAccessToken,
          delivery: {
            homeowner: result.assessment.emailDeliveryState,
            internal_test_report: result.assessment.forwardingState,
          },
        },
      },
      result.created ? 201 : 200,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    const reportAccessUnavailable =
      error instanceof Error &&
      (error.message === "INTERNAL_REPORT_SIGNING_SECRET_REQUIRED" ||
        error.message === "SAVED_REPORT_SIGNING_KEY_TOO_SHORT");
    logger.error({
      event: "assessment_submission",
      outcome: "failed",
      reason: reportAccessUnavailable
        ? "report_access_unavailable"
        : "persistence_or_report_failure",
      correlationId,
    });
    return apiErrorResponse(
      {
        code: reportAccessUnavailable
          ? "REPORT_ACCESS_UNAVAILABLE"
          : "ASSESSMENT_SAVE_FAILED",
        message: reportAccessUnavailable
          ? "The saved report is temporarily unavailable. Please try again shortly."
          : "The assessment could not be saved. Please try again shortly.",
      },
      reportAccessUnavailable ? 503 : 500,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
