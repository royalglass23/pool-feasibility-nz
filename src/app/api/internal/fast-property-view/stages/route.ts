import "server-only";
import { executeFastPropertyStagesRequest } from "@/modules/data-access-spike/execute-fast-property-stages-request";
import { executeFastPropertyDetailsRequest } from "@/modules/data-access-spike/execute-fast-property-details";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import { authorizeInternalRequest, internalAccessDeniedResponse } from "@/modules/internal-access/authorize-internal-request";
import { apiErrorResponse, apiJsonResponse, requestCorrelationId } from "@/shared/http/api-response";
import { BodyLimitError, providerTimeoutMs, readRequestBytesWithinLimit } from "@/shared/http/provider-runtime";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed) return internalAccessDeniedResponse(access, correlationId);
  let body: unknown;
  try {
    const bytes = await readRequestBytesWithinLimit(request, 1_024);
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return apiErrorResponse({ code: error instanceof BodyLimitError ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST", message: "Submit one selected address point." }, error instanceof BodyLimitError ? 413 : 400, correlationId, { "Cache-Control": "no-store" });
  }
  const gateway = new OfficialGisGateway({ timeoutMs: providerTimeoutMs() });
  const response =
    typeof body === "object" && body !== null && "mode" in body && body.mode === "detailed"
      ? await executeFastPropertyDetailsRequest({ body, gateway, timeoutMs: providerTimeoutMs() })
      : await executeFastPropertyStagesRequest({ body, gateway, basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined });
  if (response.ok) return apiJsonResponse({ data: response.data }, 200, correlationId, { "Cache-Control": "no-store" });
  return apiErrorResponse(response.error, response.status, correlationId, { "Cache-Control": "no-store" });
}
