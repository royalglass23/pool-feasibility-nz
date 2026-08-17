import "server-only";

import { z } from "zod";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
  providerTimeoutMs,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";

const MAX_REQUEST_BYTES = 512;
const requestSchema = z
  .object({ query: z.string().trim().min(3).max(100) })
  .strict();

export async function handleAddressSuggestionsRequest(
  request: Request,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  let input: unknown;
  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return apiErrorResponse(
      {
        code:
          error instanceof BodyLimitError
            ? "REQUEST_TOO_LARGE"
            : "INVALID_REQUEST",
        message: "Enter at least three address characters.",
      },
      error instanceof BodyLimitError ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
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
    }).suggestAddresses(parsed.data.query);
    return apiJsonResponse(
      {
        suggestions: suggestions
          .slice(0, 8)
          .map(
            ({
              addressId,
              fullAddress,
              fullAddressNumber,
              unit,
              territorialAuthority,
              coordinates,
            }) => ({
              addressId,
              fullAddress,
              fullAddressNumber,
              unit,
              territorialAuthority,
              coordinates,
            }),
          ),
      },
      200,
      correlationId,
      { "Cache-Control": "no-store" },
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
