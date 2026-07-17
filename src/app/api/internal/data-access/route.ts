import "server-only";
import { executeDataAccessRequest } from "@/modules/data-access-spike/execute-data-access-request";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  providerTimeoutMs,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 2_048;

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, correlationId);
  }

  const body = await readJsonRequest(request);
  if (!body.ok) {
    return apiErrorResponse(
      {
        code: "INVALID_REQUEST",
        message: "Submit one Auckland property address.",
      },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  const response = await executeDataAccessRequest({
    body: body.value,
    gateway: new OfficialGisGateway({ timeoutMs: providerTimeoutMs() }),
    basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
  });

  return response.ok
    ? apiJsonResponse({ data: response.data }, response.status, correlationId, {
        "Cache-Control": "no-store",
      })
    : apiErrorResponse(response.error, response.status, correlationId, {
        "Cache-Control": "no-store",
      });
}

async function readJsonRequest(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  let bytes: Uint8Array;
  try {
    bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
  } catch {
    return { ok: false };
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false };
  }
}
