import pino from "pino";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

const logger = pino({ base: undefined });

type RefreshResult = {
  changedCount: number;
  refreshedThrough: Date;
  status: "completed" | "pending";
};

export function createLinzAddressRefreshHandler(input: {
  cronSecret: string | undefined;
  runRefresh: () => Promise<RefreshResult>;
}) {
  return async function handleLinzAddressRefresh(request: Request) {
    const correlationId = requestCorrelationId(request);
    if (!input.cronSecret) {
      return apiErrorResponse(
        {
          code: "LINZ_REFRESH_NOT_CONFIGURED",
          message: "LINZ address refresh is not configured.",
        },
        503,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    if (request.headers.get("authorization") !== `Bearer ${input.cronSecret}`) {
      return apiErrorResponse(
        { code: "UNAUTHORIZED", message: "Not authorized." },
        401,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }

    try {
      const result = await input.runRefresh();
      logger.info({
        event: "linz_address_refresh",
        outcome: result.status,
        correlationId,
        changedCount: result.changedCount,
        refreshedThrough: result.refreshedThrough.toISOString(),
      });
      return apiJsonResponse(
        {
          data: {
            changedCount: result.changedCount,
            refreshedThrough: result.refreshedThrough.toISOString(),
            status: result.status,
          },
        },
        200,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.message : "LINZ_ADDRESS_REFRESH_FAILED";
      logger.error({
        event: "linz_address_refresh",
        outcome: "failed",
        correlationId,
        errorCode,
      });
      return apiErrorResponse(
        {
          code: "LINZ_REFRESH_FAILED",
          message: "LINZ address refresh could not be completed.",
        },
        500,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
  };
}
