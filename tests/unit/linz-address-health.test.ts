import { describe, expect, it } from "vitest";
import {
  evaluateLinzAddressHealth,
  linzAddressHealthAlertEmail,
} from "@/modules/address-search/linz-address-health";

const checkedAt = new Date("2026-09-22T15:30:00.000Z");

describe("LINZ address health monitoring", () => {
  it("stays quiet when the latest refresh and storage usage are healthy", () => {
    const report = evaluateLinzAddressHealth({
      checkedAt,
      latestCompletedAt: new Date("2026-09-22T14:35:00.000Z"),
      latestRun: {
        status: "completed",
        startedAt: new Date("2026-09-22T14:30:00.000Z"),
        errorCode: null,
      },
      databaseBytes: 263_438_336,
      storageLimitBytes: 512 * 1024 * 1024,
    });

    expect(report.status).toBe("healthy");
    expect(report.issues).toEqual([]);
    expect(report.storageUsedPercent).toBeCloseTo(49.07, 1);
  });

  it("reports stale, stuck, failed, and high-storage conditions", () => {
    const report = evaluateLinzAddressHealth({
      checkedAt,
      latestCompletedAt: new Date("2026-09-19T15:29:59.000Z"),
      latestRun: {
        status: "running",
        startedAt: new Date("2026-09-20T03:29:59.000Z"),
        errorCode: "LINZ_ADDRESS_IMPORT_HTTP_ERROR",
      },
      databaseBytes: 430 * 1024 * 1024,
      storageLimitBytes: 512 * 1024 * 1024,
    });

    expect(report.status).toBe("needs_attention");
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "LINZ_INDEX_STALE",
      "LINZ_REFRESH_STUCK",
      "LINZ_REFRESH_ERROR",
      "DATABASE_STORAGE_HIGH",
    ]);
    expect(report.storageUsedPercent).toBeCloseTo(83.98, 1);
  });

  it("does not invent a storage alert when the plan limit is not configured", () => {
    const report = evaluateLinzAddressHealth({
      checkedAt,
      latestCompletedAt: checkedAt,
      latestRun: null,
      databaseBytes: 263_438_336,
      storageLimitBytes: null,
    });

    expect(report.status).toBe("healthy");
    expect(report.storageUsedPercent).toBeNull();
  });

  it("builds an idempotent support alert without exposing secrets", () => {
    const report = evaluateLinzAddressHealth({
      checkedAt,
      latestCompletedAt: new Date("2026-09-19T15:29:59.000Z"),
      latestRun: {
        status: "running",
        startedAt: new Date("2026-09-20T03:29:59.000Z"),
        errorCode: "LINZ_ADDRESS_IMPORT_HTTP_ERROR",
      },
      databaseBytes: 430 * 1024 * 1024,
      storageLimitBytes: 512 * 1024 * 1024,
    });

    const email = linzAddressHealthAlertEmail(
      report,
      "PoolReady <notifications@bluehaven.nz>",
    );

    expect(email.to).toBe("support@bluehaven.nz");
    expect(email.subject).toBe(
      "[PoolReady] LINZ address index needs attention",
    );
    expect(email.idempotencyKey).toContain("2026-09-22");
    expect(email.text).toContain("LINZ_REFRESH_ERROR");
    expect(email.text).toContain("83.98%");
  });
});
