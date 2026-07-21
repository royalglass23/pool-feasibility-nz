import "server-only";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  LinzAerialTileError,
  LinzAerialTileGateway,
  parseAerialTileCoordinate,
} from "@/modules/providers/linz/linz-aerial-tile-gateway";
import {
  apiErrorResponse,
  requestCorrelationId,
  responseHeaders,
} from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, correlationId);
  }

  const tile = parseAerialTileCoordinate(await context.params);
  if (!tile) {
    return tileError(
      400,
      "INVALID_TILE",
      "The requested map tile is invalid.",
      correlationId,
    );
  }

  try {
    const tileResponse = await new LinzAerialTileGateway({
      apiKey: process.env.LINZ_BASEMAPS_API_KEY,
    }).fetchTile(tile);

    return new Response(Uint8Array.from(tileResponse.bytes).buffer, {
      status: 200,
      headers: responseHeaders(correlationId, {
        "Cache-Control": "private, max-age=300",
        "Content-Type": tileResponse.contentType,
      }),
    });
  } catch (error) {
    if (
      error instanceof LinzAerialTileError &&
      error.code === "NOT_CONFIGURED"
    ) {
      return tileError(
        503,
        "AERIAL_IMAGERY_UNAVAILABLE",
        "LINZ aerial imagery is not configured.",
        correlationId,
      );
    }

    return tileError(
      502,
      "AERIAL_PROVIDER_ERROR",
      error instanceof LinzAerialTileError &&
        error.code === "PROVIDER_RESPONSE_INVALID"
        ? "LINZ aerial imagery returned an invalid tile."
        : "LINZ aerial imagery could not complete the request.",
      correlationId,
    );
  }
}

function tileError(
  status: 400 | 502 | 503,
  code: string,
  message: string,
  correlationId: string,
) {
  return apiErrorResponse({ code, message }, status, correlationId, {
    "Cache-Control": "no-store",
  });
}
