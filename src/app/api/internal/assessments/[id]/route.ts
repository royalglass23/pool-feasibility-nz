import { getDb } from "@/db/client";
import {
  getHomeownerAssessmentById,
  getSavedPreliminaryReportById,
} from "@/db/repositories/homeowner-assessment-repository";
import { isDevelopmentStaffAccessAllowed } from "@/modules/staff/development-staff-access";
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
  if (!isDevelopmentStaffAccessAllowed()) {
    return apiErrorResponse(
      {
        code: "ACCESS_CONTROL_MISCONFIGURED",
        message: "The development-only staff detail is unavailable.",
      },
      503,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

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
