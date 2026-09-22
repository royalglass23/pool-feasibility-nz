import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const configuredHandler = vi.hoisted(() =>
  vi.fn(async () => new Response(null, { status: 204 })),
);
vi.mock("@/modules/address-search/run-configured-linz-address-refresh", () => ({
  handleLinzAddressRefreshRequest: configuredHandler,
}));

import { GET } from "@/app/api/cron/linz-address-refresh/route";
import { createLinzAddressRefreshHandler } from "@/modules/address-search/handle-linz-address-refresh-request";

describe("LINZ address refresh cron route", () => {
  it("fails closed without the cron secret and runs only when authorized", async () => {
    const runRefresh = vi.fn(async () => ({
      changedCount: 12,
      refreshedThrough: new Date("2026-09-11T00:00:00.000Z"),
      status: "completed" as const,
    }));
    const missingSecret = createLinzAddressRefreshHandler({
      cronSecret: undefined,
      runRefresh,
    });
    const handler = createLinzAddressRefreshHandler({
      cronSecret: "a-secure-cron-secret",
      runRefresh,
    });

    const unconfigured = await missingSecret(
      new Request("https://pool.example/api/cron/linz-address-refresh"),
    );
    const denied = await handler(
      new Request("https://pool.example/api/cron/linz-address-refresh", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    const authorized = await handler(
      new Request("https://pool.example/api/cron/linz-address-refresh", {
        headers: { Authorization: "Bearer a-secure-cron-secret" },
      }),
    );

    expect(unconfigured.status).toBe(503);
    expect(denied.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("Cache-Control")).toBe("no-store");
    await expect(authorized.json()).resolves.toMatchObject({
      data: {
        changedCount: 12,
        refreshedThrough: "2026-09-11T00:00:00.000Z",
      },
    });
    expect(runRefresh).toHaveBeenCalledOnce();
  });

  it("wires the scheduled route to the configured handler", async () => {
    const request = new Request(
      "https://pool.example/api/cron/linz-address-refresh",
    );
    await expect(GET(request)).resolves.toMatchObject({ status: 204 });
    expect(configuredHandler).toHaveBeenCalledWith(request);
  });

  it("sends an alert only when the post-refresh health check needs attention", async () => {
    const runRefresh = vi.fn(async () => ({
      changedCount: 3,
      refreshedThrough: new Date("2026-09-22T14:30:00.000Z"),
      status: "completed" as const,
    }));
    const healthyReport = {
      status: "healthy" as const,
      checkedAt: new Date("2026-09-22T14:31:00.000Z"),
      latestCompletedAt: new Date("2026-09-22T14:30:00.000Z"),
      latestRun: null,
      databaseBytes: 250_000_000,
      storageLimitBytes: 500_000_000,
      storageUsedPercent: 50,
      issues: [],
    };
    const unhealthyReport = {
      ...healthyReport,
      status: "needs_attention" as const,
      issues: [
        {
          code: "DATABASE_STORAGE_HIGH" as const,
          message: "Database storage is above the configured alert threshold.",
        },
      ],
    };
    const checkHealth = vi
      .fn()
      .mockResolvedValueOnce(healthyReport)
      .mockResolvedValueOnce(unhealthyReport);
    const sendHealthAlert = vi.fn(async () => undefined);
    const handler = createLinzAddressRefreshHandler({
      cronSecret: "a-secure-cron-secret",
      runRefresh,
      checkHealth,
      sendHealthAlert,
    });
    const request = () =>
      new Request("https://pool.example/api/cron/linz-address-refresh", {
        headers: { Authorization: "Bearer a-secure-cron-secret" },
      });

    const healthy = await handler(request());
    const unhealthy = await handler(request());

    expect(healthy.status).toBe(200);
    expect(unhealthy.status).toBe(200);
    expect(checkHealth).toHaveBeenCalledTimes(2);
    expect(sendHealthAlert).toHaveBeenCalledOnce();
    expect(sendHealthAlert).toHaveBeenCalledWith(unhealthyReport);
  });

  it("does not undo a completed refresh when monitoring itself fails", async () => {
    const handler = createLinzAddressRefreshHandler({
      cronSecret: "a-secure-cron-secret",
      runRefresh: vi.fn(async () => ({
        changedCount: 3,
        refreshedThrough: new Date("2026-09-22T14:30:00.000Z"),
        status: "completed" as const,
      })),
      checkHealth: vi.fn(async () => {
        throw new Error("MONITORING_UNAVAILABLE");
      }),
      sendHealthAlert: vi.fn(async () => undefined),
    });

    const response = await handler(
      new Request("https://pool.example/api/cron/linz-address-refresh", {
        headers: { Authorization: "Bearer a-secure-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { monitoring: "failed" },
    });
  });

  it("still evaluates and sends the health alert when the refresh fails", async () => {
    const unhealthyReport = {
      status: "needs_attention" as const,
      checkedAt: new Date("2026-09-22T14:31:00.000Z"),
      latestCompletedAt: new Date("2026-09-20T14:30:00.000Z"),
      latestRun: {
        status: "running",
        startedAt: new Date("2026-09-22T14:30:00.000Z"),
        errorCode: "LINZ_ADDRESS_IMPORT_HTTP_ERROR",
      },
      databaseBytes: 250_000_000,
      storageLimitBytes: 500_000_000,
      storageUsedPercent: 50,
      issues: [
        {
          code: "LINZ_REFRESH_ERROR" as const,
          message: "The latest refresh failed.",
        },
      ],
    };
    const sendHealthAlert = vi.fn(async () => undefined);
    const handler = createLinzAddressRefreshHandler({
      cronSecret: "a-secure-cron-secret",
      runRefresh: vi.fn(async () => {
        throw new Error("LINZ_ADDRESS_IMPORT_HTTP_ERROR");
      }),
      checkHealth: vi.fn(async () => unhealthyReport),
      sendHealthAlert,
    });

    const response = await handler(
      new Request("https://pool.example/api/cron/linz-address-refresh", {
        headers: { Authorization: "Bearer a-secure-cron-secret" },
      }),
    );

    expect(response.status).toBe(500);
    expect(sendHealthAlert).toHaveBeenCalledWith(unhealthyReport);
  });
});
