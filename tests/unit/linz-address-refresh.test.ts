import { describe, expect, it, vi } from "vitest";
import type { IndexedLinzAddress } from "@/modules/address-search/linz-address-import";
import {
  refreshLinzAddresses,
  type LinzAddressRefreshStore,
} from "@/modules/address-search/linz-address-refresh";

const cursor = new Date("2026-09-10T00:00:00.000Z");
const now = new Date("2026-09-11T00:00:00.000Z");

function address(addressId: string): IndexedLinzAddress {
  return {
    addressId,
    sourceObjectId: Number(addressId),
    fullAddress: "42A Bahari Drive, Ranui, Auckland",
    fullAddressNumber: "42A",
    unit: null,
    territorialAuthority: "Auckland",
    suburbLocality: "Ranui",
    townCity: "Auckland",
    postcode: null,
    searchText: "42a bahari drive ranui auckland",
    longitude: 174.6,
    latitude: -36.8,
    isCurrent: true,
  };
}

function store(overrides: Partial<LinzAddressRefreshStore> = {}) {
  return Object.assign<
    LinzAddressRefreshStore,
    Partial<LinzAddressRefreshStore>
  >(
    {
      findRunningRefresh: vi.fn(async () => null),
      hasOtherRunningImport: vi.fn(async () => false),
      latestCompletedCursor: vi.fn(async () => cursor),
      startRefresh: vi.fn(async () => undefined),
      applyPage: vi.fn(async () => undefined),
      completeRefresh: vi.fn(async () => undefined),
      recordRefreshFailure: vi.fn(async () => undefined),
    },
    overrides,
  );
}

describe("LINZ address refresh", () => {
  it("preserves a completed page checkpoint after failure and resumes from it", async () => {
    let running: {
      runId: string;
      from: Date;
      to: Date;
      nextOffset: number;
    } | null = null;
    let retrying = false;
    const refreshStore = {
      findRunningRefresh: vi.fn(async () => running),
      hasOtherRunningImport: vi.fn(async () => false),
      latestCompletedCursor: vi.fn(async () => cursor),
      startRefresh: vi.fn(async (run) => {
        running = { ...run };
      }),
      applyPage: vi.fn(async ({ nextOffset }) => {
        running = running ? { ...running, nextOffset } : null;
      }),
      completeRefresh: vi.fn(async () => {
        running = null;
      }),
      recordRefreshFailure: vi.fn(async () => undefined),
    } as unknown as LinzAddressRefreshStore;
    const firstPage = Array.from({ length: 1_000 }, (_, index) => ({
      action: "DELETE" as const,
      addressId: String(index + 1),
    }));
    const requestedOffsets: number[] = [];
    const source = {
      fetchChangesPage: vi.fn(async ({ startIndex }) => {
        requestedOffsets.push(startIndex);
        if (startIndex === 0) return firstPage;
        if (!retrying) throw new Error("LINZ_TEMPORARY_FAILURE");
        return [];
      }),
      fetchCurrentAddresses: vi.fn(async () => []),
    };

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source,
        createRunId: () => "resumable-run",
        now: () => now,
      }),
    ).rejects.toThrow("LINZ_TEMPORARY_FAILURE");

    retrying = true;
    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source,
        createRunId: () => "must-not-start-another-run",
        now: () => new Date("2026-09-12T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      changedCount: 1_000,
      refreshedThrough: now,
      status: "completed",
    });

    expect(requestedOffsets).toEqual([0, 1_000, 1_000]);
    expect(refreshStore.startRefresh).toHaveBeenCalledOnce();
  });

  it("stops at the invocation page budget and leaves the checkpoint resumable", async () => {
    const refreshStore = store();
    const changes = Array.from({ length: 1_000 }, (_, index) => ({
      action: "UPDATE" as const,
      addressId: String(index + 1),
    }));
    const fetchChangesPage = vi
      .fn()
      .mockResolvedValueOnce(changes)
      .mockRejectedValueOnce(new Error("UNBOUNDED_REFRESH"));

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage,
          fetchCurrentAddresses: vi.fn(async (addressIds) =>
            addressIds.map(address),
          ),
        },
        createRunId: () => "bounded-run",
        now: () => now,
        maxPagesPerInvocation: 1,
      }),
    ).resolves.toEqual({
      changedCount: 1_000,
      refreshedThrough: now,
      status: "pending",
    });

    expect(fetchChangesPage).toHaveBeenCalledOnce();
    expect(refreshStore.applyPage).toHaveBeenCalledWith(
      expect.objectContaining({ nextOffset: 1_000 }),
    );
    expect(refreshStore.completeRefresh).not.toHaveBeenCalled();
  });

  it("uses a one-day overlap and advances freshness after applying the delta", async () => {
    const refreshStore = store();
    const changes = [
      { action: "UPDATE" as const, addressId: "2359811" },
      { action: "DELETE" as const, addressId: "2359812" },
    ];
    const current = address("2359811");

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => changes),
          fetchCurrentAddresses: vi.fn(async () => [current]),
        },
        createRunId: () => "run-1",
        now: () => now,
      }),
    ).resolves.toEqual({
      changedCount: 2,
      refreshedThrough: now,
      status: "completed",
    });

    expect(refreshStore.startRefresh).toHaveBeenCalledWith({
      runId: "run-1",
      from: new Date("2026-09-09T00:00:00.000Z"),
      to: now,
      nextOffset: 0,
    });
    expect(refreshStore.applyPage).toHaveBeenCalledWith({
      runId: "run-1",
      changes,
      currentAddresses: [current],
      syncedAt: now,
      nextOffset: 2,
    });
    expect(refreshStore.completeRefresh).toHaveBeenCalledWith({
      runId: "run-1",
      cursor: now,
    });
  });

  it("does not advance freshness when LINZ fails", async () => {
    const refreshStore = store();

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => {
            throw new Error("LINZ_ADDRESS_REFRESH_HTTP_ERROR");
          }),
          fetchCurrentAddresses: vi.fn(async () => []),
        },
        createRunId: () => "run-2",
        now: () => now,
      }),
    ).rejects.toThrow("LINZ_ADDRESS_REFRESH_HTTP_ERROR");

    expect(refreshStore.completeRefresh).not.toHaveBeenCalled();
    expect(refreshStore.recordRefreshFailure).toHaveBeenCalledWith({
      runId: "run-2",
      errorCode: "LINZ_ADDRESS_REFRESH_HTTP_ERROR",
    });
  });

  it("refuses to overlap the initial full import", async () => {
    const refreshStore = store({
      hasOtherRunningImport: vi.fn(async () => true),
    });

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => []),
          fetchCurrentAddresses: vi.fn(async () => []),
        },
        createRunId: () => "run-3",
      }),
    ).rejects.toThrow("LINZ_ADDRESS_REFRESH_IMPORT_RUNNING");
  });
});
