import "server-only";

import { z } from "zod";
import { AddressIndexUnavailableError } from "@/modules/address-search/address-search";
import { NeonLinzAddressSearch } from "@/modules/address-search/neon-linz-address-search";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
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
    const suggestions = await new NeonLinzAddressSearch().search(
      parsed.data.query,
    );
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
            }) => ({
              addressId,
              fullAddress,
              fullAddressNumber,
              unit,
              territorialAuthority,
            }),
          ),
      },
      200,
      correlationId,
      { "Cache-Control": "no-store" },
    );
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
            : "The address suggestions are temporarily unavailable.",
      },
      error instanceof AddressIndexUnavailableError ? 503 : 502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
