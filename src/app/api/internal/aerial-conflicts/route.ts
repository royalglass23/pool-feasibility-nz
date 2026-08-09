import "server-only";

import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { POST as handleAerialConflictsRequest } from "@/modules/spatial/handle-aerial-conflicts-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, requestCorrelationId(request));
  }
  return handleAerialConflictsRequest(request);
}
