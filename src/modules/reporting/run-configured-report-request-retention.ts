import "server-only";
import { getDb } from "@/db/client";
import { createReportRequestRetentionStore } from "@/db/repositories/homeowner-assessment-repository";
import { env } from "@/env";
import { createReportRequestRetentionHandler } from "@/modules/reporting/handle-report-request-retention-request";
import { runReportRequestRetention } from "@/modules/reporting/report-request-retention";

export const handleReportRequestRetentionRequest =
  createReportRequestRetentionHandler({
    cronSecret: env.CRON_SECRET,
    runRetention: () =>
      runReportRequestRetention(createReportRequestRetentionStore(getDb())),
  });
