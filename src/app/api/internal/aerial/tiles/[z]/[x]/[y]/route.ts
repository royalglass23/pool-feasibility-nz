import "server-only";

import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { GET as handleAerialTileRequest } from "@/modules/providers/linz/handle-aerial-tile-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, requestCorrelationId(request));
  }
  return handleAerialTileRequest(request, context);
}
