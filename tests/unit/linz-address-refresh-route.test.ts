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
});
