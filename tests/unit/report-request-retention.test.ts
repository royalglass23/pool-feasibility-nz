import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  runReportRequestRetention,
  type ReportRequestRetentionRun,
  type ReportRequestRetentionStore,
} from "@/modules/reporting/report-request-retention";
import { createReportRequestRetentionStore } from "@/db/repositories/homeowner-assessment-repository";

class InMemoryRetentionStore implements ReportRequestRetentionStore {
  readonly audits: ReportRequestRetentionRun[] = [];

  constructor(readonly requests: Array<{ id: string; createdAt: Date }>) {}

  async deleteEligibleAndRecordRun(
    run: Omit<ReportRequestRetentionRun, "deletedCount">,
  ): Promise<number> {
    const eligibleIds = new Set(
      this.requests
        .filter((request) => request.createdAt <= run.cutoffAt)
        .map((request) => request.id),
    );
    const retained = this.requests.filter(
      (request) => !eligibleIds.has(request.id),
    );
    this.requests.splice(0, this.requests.length, ...retained);
    this.audits.push({ ...run, deletedCount: eligibleIds.size });
    return eligibleIds.size;
  }
}

describe("report request retention", () => {
  it("deletes requests at 12 months, preserves newer requests, and safely records a repeat run", async () => {
    const now = new Date("2026-08-05T03:00:00.000Z");
    const store = new InMemoryRetentionStore([
      { id: "older", createdAt: new Date("2025-08-04T23:59:59.999Z") },
      { id: "exact", createdAt: new Date("2025-08-05T03:00:00.000Z") },
      { id: "newer", createdAt: new Date("2025-08-05T03:00:00.001Z") },
    ]);

    const first = await runReportRequestRetention(store, {
      now,
      runId: "retention-run-1",
    });
    const repeat = await runReportRequestRetention(store, {
      now,
      runId: "retention-run-2",
    });

    expect(first).toEqual({
      runId: "retention-run-1",
      ranAt: now,
      cutoffAt: new Date("2025-08-05T03:00:00.000Z"),
      deletedCount: 2,
    });
    expect(repeat.deletedCount).toBe(0);
    expect(store.requests).toEqual([
      { id: "newer", createdAt: new Date("2025-08-05T03:00:00.001Z") },
    ]);
    expect(store.audits).toEqual([first, repeat]);
    expect(Object.keys(store.audits[0] ?? {}).sort()).toEqual([
      "cutoffAt",
      "deletedCount",
      "ranAt",
      "runId",
    ]);
  });

  it("uses one Neon HTTP statement to skip active deliveries and record a PII-free audit", async () => {
    let statement: unknown;
    let transactionCalls = 0;
    const store = createReportRequestRetentionStore({
      transaction: async () => {
        transactionCalls += 1;
        throw new Error("Neon HTTP callback transactions are unsupported");
      },
      execute: async (query: unknown) => {
        statement = query;
        return { rows: [{ deleted_count: "2" }] };
      },
    } as unknown as Parameters<typeof createReportRequestRetentionStore>[0]);
    const run = {
      runId: "018f1f55-fb85-7f99-b7e5-8f2924473f9c",
      ranAt: new Date("2026-08-05T03:00:00.000Z"),
      cutoffAt: new Date("2025-08-05T03:00:00.000Z"),
    };

    await expect(store.deleteEligibleAndRecordRun(run)).resolves.toBe(2);

    expect(transactionCalls).toBe(0);
    expect(statement).toBeDefined();
    const compiled = new PgDialect().sqlToQuery(
      statement as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(compiled.sql).toContain('with "deleted" as');
    expect(compiled.sql).toContain('"created_at" <=');
    expect(compiled.sql).toContain('"email_delivery_state" <>');
    expect(compiled.sql).toContain('"email_delivery_last_attempted_at" <=');
    expect(compiled.sql).toContain('"forwarding_state" <>');
    expect(compiled.sql).toContain('"forwarding_last_attempted_at" <=');
    expect(compiled.sql).toContain(
      'insert into "report_request_retention_runs"',
    );
    expect(compiled.sql).not.toContain("homeowner_name");
    expect(compiled.params).toContain("sending");
    expect(compiled.params).toContainEqual(
      new Date("2026-08-05T02:55:00.000Z"),
    );
  });
});
