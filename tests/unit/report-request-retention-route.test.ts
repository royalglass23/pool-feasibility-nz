import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const configuredHandler = vi.hoisted(() =>
  vi.fn(async () => new Response(null, { status: 204 })),
);
vi.mock("@/modules/reporting/run-configured-report-request-retention", () => ({
  handleReportRequestRetentionRequest: configuredHandler,
}));

import { createReportRequestRetentionHandler } from "@/modules/reporting/handle-report-request-retention-request";
import { GET } from "@/app/api/cron/report-request-retention/route";

const run = {
  runId: "018f1f55-fb85-7f99-b7e5-8f2924473f9c",
  ranAt: new Date("2026-08-05T03:00:00.000Z"),
  cutoffAt: new Date("2025-08-05T03:00:00.000Z"),
  deletedCount: 2,
};

describe("report request retention cron route", () => {
  it("fails closed without the configured bearer secret and runs once when authorized", async () => {
    const runRetention = vi.fn(async () => run);
    const missingSecretHandler = createReportRequestRetentionHandler({
      cronSecret: undefined,
      runRetention,
    });
    const handler = createReportRequestRetentionHandler({
      cronSecret: "a-secure-cron-secret",
      runRetention,
    });

    const unconfigured = await missingSecretHandler(
      new Request("https://pool.example/api/cron/report-request-retention"),
    );
    const denied = await handler(
      new Request("https://pool.example/api/cron/report-request-retention", {
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    const authorized = await handler(
      new Request("https://pool.example/api/cron/report-request-retention", {
        headers: { Authorization: "Bearer a-secure-cron-secret" },
      }),
    );

    expect(unconfigured.status).toBe(503);
    expect(denied.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("Cache-Control")).toBe("no-store");
    await expect(authorized.json()).resolves.toMatchObject({
      data: {
        run: {
          runId: run.runId,
          ranAt: run.ranAt.toISOString(),
          cutoffAt: run.cutoffAt.toISOString(),
          deletedCount: 2,
        },
      },
    });
    expect(runRetention).toHaveBeenCalledOnce();
  });

  it("wires the scheduled GET route to the configured retention handler", async () => {
    const request = new Request(
      "https://pool.example/api/cron/report-request-retention",
    );

    await expect(GET(request)).resolves.toMatchObject({ status: 204 });
    expect(configuredHandler).toHaveBeenCalledWith(request);
  });
});
