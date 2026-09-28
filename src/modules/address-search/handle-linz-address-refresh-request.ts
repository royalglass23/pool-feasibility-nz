import pino from "pino";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import type { LinzAddressHealthReport } from "./linz-address-health";

const logger = pino({ base: undefined });

type RefreshResult = {
  changedCount: number;
  refreshedThrough: Date;
  status: "completed" | "pending";
};

export function createLinzAddressRefreshHandler(input: {
  cronSecret: string | undefined;
  runRefresh: () => Promise<RefreshResult>;
  checkHealth?: () => Promise<LinzAddressHealthReport>;
  sendHealthAlert?: (report: LinzAddressHealthReport) => Promise<void>;
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

    const runMonitoring = async (): Promise<
      "healthy" | "alerted" | "failed" | undefined
    > => {
      let monitoring: "healthy" | "alerted" | "failed" | undefined;
      if (input.checkHealth && input.sendHealthAlert) {
        try {
          const report = await input.checkHealth();
          if (report.status === "needs_attention") {
            await input.sendHealthAlert(report);
            monitoring = "alerted";
          } else {
            monitoring = "healthy";
          }
          logger.info({
            event: "linz_address_health",
            outcome: monitoring,
            correlationId,
            issues: report.issues.map((issue) => issue.code),
            databaseBytes: report.databaseBytes,
            storageUsedPercent: report.storageUsedPercent,
          });
        } catch (error) {
          monitoring = "failed";
          logger.error({
            event: "linz_address_health",
            outcome: "failed",
            correlationId,
            errorCode:
              error instanceof Error ? error.message : "LINZ_HEALTH_FAILED",
          });
        }
      }
      return monitoring;
    };

    try {
      const result = await input.runRefresh();
      const monitoring = await runMonitoring();
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
            ...(monitoring ? { monitoring } : {}),
          },
        },
        200,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.message : "LINZ_ADDRESS_REFRESH_FAILED";
      const monitoring = await runMonitoring();
      logger.error({
        event: "linz_address_refresh",
        outcome: "failed",
        correlationId,
        errorCode,
        monitoring,
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
