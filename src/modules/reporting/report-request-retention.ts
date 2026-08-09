import { randomUUID } from "node:crypto";

export type ReportRequestRetentionRun = {
  runId: string;
  ranAt: Date;
  cutoffAt: Date;
  deletedCount: number;
};

export interface ReportRequestRetentionStore {
  deleteEligibleAndRecordRun(
    run: Omit<ReportRequestRetentionRun, "deletedCount">,
  ): Promise<number>;
}

export async function runReportRequestRetention(
  store: ReportRequestRetentionStore,
  {
    now = new Date(),
    runId = randomUUID(),
  }: { now?: Date; runId?: string } = {},
): Promise<ReportRequestRetentionRun> {
  const run = {
    runId,
    ranAt: new Date(now),
    cutoffAt: twelveMonthsBefore(now),
  };
  const deletedCount = await store.deleteEligibleAndRecordRun(run);
  return { ...run, deletedCount };
}

function twelveMonthsBefore(value: Date): Date {
  const year = value.getUTCFullYear() - 1;
  const month = value.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(value.getUTCDate(), lastDayOfMonth),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
}
