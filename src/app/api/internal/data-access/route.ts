import "server-only";
import { executeConfiguredAssessmentRequest } from "@/modules/assessment/execute-configured-assessment-request";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  BodyLimitError,
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
    if (body.reason === "too_large") {
      return apiErrorResponse(
        {
          code: "REQUEST_TOO_LARGE",
          message: "The submitted request is too large.",
        },
        413,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }

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

  const response = await executeConfiguredAssessmentRequest(body.value);

  if (response.ok) {
    return apiJsonResponse(
      { data: response.data },
      response.status,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  return apiErrorResponse(response.error, response.status, correlationId, {
    "Cache-Control": "no-store",
  });
}

async function readJsonRequest(
  request: Request,
): Promise<
  { ok: true; value: unknown } | { ok: false; reason: "invalid" | "too_large" }
> {
  let bytes: Uint8Array;
  try {
    bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof BodyLimitError && error.code === "BODY_TOO_LARGE"
          ? "too_large"
          : "invalid",
    };
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
