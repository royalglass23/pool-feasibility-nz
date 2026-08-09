import pino from "pino";
import type { ReportRequestRetentionRun } from "@/modules/reporting/report-request-retention";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

const logger = pino({ base: undefined });

export function createReportRequestRetentionHandler({
  cronSecret,
  runRetention,
}: {
  cronSecret: string | undefined;
  runRetention: () => Promise<ReportRequestRetentionRun>;
}) {
  return async function handleReportRequestRetention(request: Request) {
    const correlationId = requestCorrelationId(request);
    if (!cronSecret) {
      return apiErrorResponse(
        {
          code: "RETENTION_NOT_CONFIGURED",
          message: "Report request retention is not configured.",
        },
        503,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return apiErrorResponse(
        { code: "UNAUTHORIZED", message: "Not authorized." },
        401,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }

    try {
      const run = await runRetention();
      logger.info({
        event: "report_request_retention",
        outcome: "completed",
        correlationId,
        runId: run.runId,
        cutoffAt: run.cutoffAt.toISOString(),
        deletedCount: run.deletedCount,
      });
      return apiJsonResponse(
        {
          data: {
            run: {
              ...run,
              ranAt: run.ranAt.toISOString(),
              cutoffAt: run.cutoffAt.toISOString(),
            },
          },
        },
        200,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    } catch {
      logger.error({
        event: "report_request_retention",
        outcome: "failed",
        correlationId,
      });
      return apiErrorResponse(
        {
          code: "RETENTION_FAILED",
          message: "Report request retention could not be completed.",
        },
        500,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
  };
}
