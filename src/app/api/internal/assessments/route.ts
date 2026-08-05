import "server-only";

import {
  GET,
  POST as handleAssessmentSubmission,
} from "@/modules/assessment/handle-assessment-requests";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export { GET };
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, requestCorrelationId(request));
  }
  return handleAssessmentSubmission(request);
}
