import "server-only";
import { executeFastPropertyViewRequest } from "@/modules/data-access-spike/execute-fast-property-view-request";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  readRequestBytesWithinLimit,
  BodyLimitError,
  providerTimeoutMs,
} from "@/shared/http/provider-runtime";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed)
    return internalAccessDeniedResponse(access, correlationId);
  let body: unknown;
  try {
    const bytes = await readRequestBytesWithinLimit(request, 2_048);
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return apiErrorResponse(
      {
        code:
          error instanceof BodyLimitError
            ? "REQUEST_TOO_LARGE"
            : "INVALID_REQUEST",
        message: "Submit one New Zealand property address.",
      },
      error instanceof BodyLimitError ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  const response = await executeFastPropertyViewRequest({
    body,
    gateway: new OfficialGisGateway({ timeoutMs: providerTimeoutMs() }),
    basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
  });
  if (response.ok)
    return apiJsonResponse({ data: response.data }, 200, correlationId, {
      "Cache-Control": "no-store",
    });
  return apiErrorResponse(response.error, response.status, correlationId, {
    "Cache-Control": "no-store",
  });
}
