import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
    LINZ_DATA_SERVICE_API_KEY: "test-linz-key",
  },
}));

import { linzAddressQueryUrl } from "@/modules/address-search/linz-address-import";
import { createRefreshStore } from "@/modules/address-search/run-configured-linz-address-refresh";
import * as schema from "@/db/schema";

function indexedAddress(addressId: string, fullAddress: string) {
  return {
    addressId,
    sourceObjectId: Number(addressId),
    fullAddress,
    fullAddressNumber: fullAddress.split(" ")[0]!,
    unit: null,
    territorialAuthority: "Auckland",
    suburbLocality: "Ranui",
    townCity: "Auckland",
    postcode: null,
    searchText: fullAddress.toLowerCase(),
    longitude: 174.6,
    latitude: -36.8,
    isCurrent: true,
  };
}

describe("LINZ address refresh store", () => {
  it("starts incremental refresh from the initial import watermark, not its later completion time", async () => {
    const importStartedAt = new Date("2026-09-01T00:00:00.000Z");
    const importCompletedAt = new Date("2026-09-03T12:00:00.000Z");
    const db = {
      query: {
        linzAddressIndexRuns: {
          findFirst: vi.fn(async () => ({
            status: "completed",
            sourceSnapshotUrl: linzAddressQueryUrl,
            sourceSnapshotAt: importStartedAt,
            sourceUpdatedAt: importCompletedAt,
            completedAt: importCompletedAt,
          })),
        },
      },
    };

    await expect(
      createRefreshStore(db as never).latestCompletedCursor(),
    ).resolves.toEqual(importStartedAt);
  });

  it("upserts inserted and changed addresses, retires missing records, and advances the checkpoint", async () => {
    const inserts: Array<{
      table: unknown;
      values: unknown[];
      conflict: { target: unknown; set: Record<string, unknown> };
    }> = [];
    const updates: Array<{
      table: unknown;
      values: Record<string, unknown>;
      where: unknown;
    }> = [];
    const db = {
      insert: (table: unknown) => ({
        values: (values: unknown[]) => ({
          onConflictDoUpdate: async (conflict: {
            target: unknown;
            set: Record<string, unknown>;
          }) => {
            inserts.push({ table, values, conflict });
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async (where: unknown) => {
            updates.push({ table, values, where });
          },
        }),
      }),
    };
    const syncedAt = new Date("2026-09-11T00:00:00.000Z");
    const inserted = indexedAddress("1", "1 New Road, Auckland");
    const changed = indexedAddress("2", "2 Renamed Road, Auckland");

    await createRefreshStore(db as never).applyPage({
      runId: "refresh-run",
      changes: [
        { action: "INSERT", addressId: "1" },
        { action: "UPDATE", addressId: "2" },
        { action: "DELETE", addressId: "3" },
      ],
      currentAddresses: [inserted, changed],
      syncedAt,
      nextOffset: 3,
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      table: schema.linzAddressIndex,
      values: [
        { addressId: "1", fullAddress: inserted.fullAddress, syncedAt },
        { addressId: "2", fullAddress: changed.fullAddress, syncedAt },
      ],
      conflict: {
        target: schema.linzAddressIndex.addressId,
        set: expect.objectContaining({
          fullAddress: expect.anything(),
          searchText: expect.anything(),
          isCurrent: expect.anything(),
          syncedAt: expect.anything(),
        }),
      },
    });

    const retirement = updates.find(
      (update) => update.table === schema.linzAddressIndex,
    );
    expect(retirement?.values).toEqual({ isCurrent: false, syncedAt });
    const compiledRetirement = new PgDialect().sqlToQuery(
      retirement!.where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(compiledRetirement.sql).toContain('"address_id" in ($1)');
    expect(compiledRetirement.params).toEqual(["3"]);

    const checkpoint = updates.find(
      (update) => update.table === schema.linzAddressIndexRuns,
    );
    expect(checkpoint?.values).toEqual({
      lastObjectId: 3,
      acceptedCount: 3,
      errorCode: null,
    });
  });

  it("records a page failure without making the checkpoint unresumable", async () => {
    let persistedValues: Record<string, unknown> | undefined;
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            persistedValues = values;
          },
        }),
      }),
    };

    await createRefreshStore(db as never).recordRefreshFailure({
      runId: "resumable-run",
      errorCode: "LINZ_TEMPORARY_FAILURE",
    });

    expect(persistedValues).toEqual({
      errorCode: "LINZ_TEMPORARY_FAILURE",
    });
    expect(persistedValues).not.toHaveProperty("status");
  });
});
