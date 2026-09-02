import "server-only";
import { executeFastPropertyViewRequest } from "@/modules/data-access-spike/execute-fast-property-view-request";
import { issueAssessmentSnapshot } from "@/modules/assessment/assessment-snapshot";
import {
  AddressIndexUnavailableError,
  type AddressSearch,
} from "@/modules/address-search/address-search";
import { NeonLinzAddressSearch } from "@/modules/address-search/neon-linz-address-search";
import type { OfficialPropertyLayers } from "@/modules/data-access-spike/data-access-gateway";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
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

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
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
  let addressSearch: AddressSearch;
  try {
    addressSearch = new NeonLinzAddressSearch();
  } catch (error) {
    return apiErrorResponse(
      {
        code:
          error instanceof AddressIndexUnavailableError
            ? "TEMPORARILY_UNAVAILABLE"
            : "DATA_PROVIDER_ERROR",
        message:
          error instanceof AddressIndexUnavailableError
            ? "Please try again shortly."
            : "The Property Check is temporarily unavailable.",
      },
      error instanceof AddressIndexUnavailableError ? 503 : 502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  const provider = new OfficialGisGateway({ timeoutMs: providerTimeoutMs() });
  const response = await executeFastPropertyViewRequest({
    body,
    addressSearch,
    propertyLayers: provider satisfies OfficialPropertyLayers,
    basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
  });
  if (response.ok)
    return apiJsonResponse(
      {
        data: response.data,
        assessmentSnapshot: issueAssessmentSnapshot(response.data),
      },
      200,
      correlationId,
      {
        "Cache-Control": "no-store",
      },
    );
  return apiErrorResponse(response.error, response.status, correlationId, {
    "Cache-Control": "no-store",
  });
}
