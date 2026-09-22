import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  evaluateLinzAddressHealth,
  linzAddressHealthAlertEmail,
  type LinzAddressHealthReport,
} from "./linz-address-health";
import { sendResendEmail } from "@/modules/reporting/resend-email-gateway";

export async function runConfiguredLinzAddressHealthCheck(): Promise<LinzAddressHealthReport> {
  const db = getDb();
  const [latestCompleted, latestRun, databaseSizeResult] = await Promise.all([
    db.query.linzAddressIndexRuns.findFirst({
      columns: { completedAt: true },
      where: eq(schema.linzAddressIndexRuns.status, "completed"),
      orderBy: [desc(schema.linzAddressIndexRuns.completedAt)],
    }),
    db.query.linzAddressIndexRuns.findFirst({
      columns: { status: true, startedAt: true, errorCode: true },
      orderBy: [desc(schema.linzAddressIndexRuns.startedAt)],
    }),
    db.execute(
      sql`select pg_database_size(current_database())::bigint as database_bytes`,
    ),
  ]);
  const databaseSizeRow = databaseSizeResult.rows[0] as
    { database_bytes?: string | number | bigint } | undefined;
  const databaseBytes = Number(databaseSizeRow?.database_bytes);
  if (!Number.isFinite(databaseBytes) || databaseBytes < 0) {
    throw new Error("LINZ_HEALTH_DATABASE_SIZE_UNAVAILABLE");
  }

  return evaluateLinzAddressHealth({
    checkedAt: new Date(),
    latestCompletedAt: latestCompleted?.completedAt ?? null,
    latestRun: latestRun ?? null,
    databaseBytes,
    storageLimitBytes: env.DATABASE_STORAGE_LIMIT_MIB
      ? env.DATABASE_STORAGE_LIMIT_MIB * 1024 * 1024
      : null,
  });
}

export async function sendConfiguredLinzAddressHealthAlert(
  report: LinzAddressHealthReport,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.REPORT_FROM_EMAIL) {
    throw new Error("LINZ_HEALTH_ALERT_EMAIL_NOT_CONFIGURED");
  }
  await sendResendEmail({
    ...linzAddressHealthAlertEmail(report, env.REPORT_FROM_EMAIL),
    apiKey: env.RESEND_API_KEY,
  });
}
