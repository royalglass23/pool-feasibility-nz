import "server-only";

import { z } from "zod";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import { providerTimeoutMs } from "@/shared/http/provider-runtime";

export const runtime = "nodejs";

const querySchema = z.string().trim().min(3).max(100);

export async function GET(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, correlationId);
  }

  const query = querySchema.safeParse(
    new URL(request.url).searchParams.get("q") ?? "",
  );
  if (!query.success) {
    return apiErrorResponse(
      {
        code: "INVALID_QUERY",
        message: "Enter at least three address characters.",
      },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  try {
    const suggestions = await new OfficialGisGateway({
      timeoutMs: providerTimeoutMs(),
    }).suggestAddresses(query.data);
    return apiJsonResponse(
      {
        suggestions: suggestions.map(({ addressId, fullAddress }) => ({
          addressId,
          fullAddress,
        })),
      },
      200,
      correlationId,
      { "Cache-Control": "private, max-age=30" },
    );
  } catch {
    return apiErrorResponse(
      {
        code: "DATA_PROVIDER_ERROR",
        message: "The address suggestions are temporarily unavailable.",
      },
      502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
