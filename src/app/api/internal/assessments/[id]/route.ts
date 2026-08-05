import { getDb } from "@/db/client";
import {
  getHomeownerAssessmentById,
  getSavedPreliminaryReportById,
} from "@/db/repositories/homeowner-assessment-repository";
import { staffSessionDeniedResponse } from "@/modules/staff/staff-session";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = requestCorrelationId(request);
  const sessionDenied = await staffSessionDeniedResponse(request, correlationId);
  if (sessionDenied) return sessionDenied;

  const { id } = await params;
  const db = getDb();
  const [assessment, report] = await Promise.all([
    getHomeownerAssessmentById(db, id),
    getSavedPreliminaryReportById(db, id),
  ]);
  if (!assessment || !report) {
    return apiErrorResponse(
      {
        code: "ASSESSMENT_NOT_FOUND",
        message: "The saved assessment was not found.",
      },
      404,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  return apiJsonResponse(
    { data: { assessment: { ...assessment, report } } },
    200,
    correlationId,
    { "Cache-Control": "no-store" },
  );
}
