import "server-only";

import { POST as handleFastPropertyViewRequest } from "@/modules/data-access-spike/handle-fast-property-view-request";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, requestCorrelationId(request));
  }
  return handleFastPropertyViewRequest(request);
}
