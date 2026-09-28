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
  it("cancels a slow changeset request at the runtime deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const refreshStore = store();
      const refresh = refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(
            ({ signal }: { signal: AbortSignal }) =>
              new Promise<never>((_resolve, reject) => {
                signal.addEventListener(
                  "abort",
                  () => reject(new DOMException("Timed out", "AbortError")),
                  { once: true },
                );
              }),
          ),
          fetchCurrentAddresses: vi.fn(async () => []),
        },
        createRunId: () => "slow-changeset-run",
        now: () => now,
        monotonicNow: () => Date.now(),
        maxRuntimeMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      await expect(refresh).resolves.toEqual({
        changedCount: 0,
        refreshedThrough: now,
        status: "pending",
      });
      expect(refreshStore.applyPage).not.toHaveBeenCalled();
      expect(refreshStore.completeRefresh).not.toHaveBeenCalled();
      expect(refreshStore.recordRefreshFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a slow current-address batch at the runtime deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const refreshStore = store();
      let completedSlowRequest = false;
      const refresh = refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => [
            { action: "UPDATE" as const, addressId: "1" },
          ]),
          fetchCurrentAddresses: vi.fn(
            (_addressIds: string[], signal: AbortSignal) =>
              new Promise<IndexedLinzAddress[]>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  completedSlowRequest = true;
                  resolve([address("1")]);
                }, 150);
                signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timeout);
                    reject(new DOMException("Timed out", "AbortError"));
                  },
                  { once: true },
                );
              }),
          ),
        },
        createRunId: () => "slow-current-address-run",
        now: () => now,
        monotonicNow: () => Date.now(),
        maxRuntimeMs: 100,
      });

      await vi.advanceTimersByTimeAsync(150);

      await expect(refresh).resolves.toEqual({
        changedCount: 0,
        refreshedThrough: now,
        status: "pending",
      });
      expect(completedSlowRequest).toBe(false);
      expect(refreshStore.applyPage).not.toHaveBeenCalled();
      expect(refreshStore.recordRefreshFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("defers completion when the changeset request consumes the runtime budget", async () => {
    let elapsedMs = 0;
    const refreshStore = store();

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => {
            elapsedMs = 100;
            return [];
          }),
          fetchCurrentAddresses: vi.fn(async () => []),
        },
        createRunId: () => "completion-boundary-run",
        now: () => now,
        monotonicNow: () => elapsedMs,
        maxRuntimeMs: 100,
      }),
    ).resolves.toEqual({
      changedCount: 0,
      refreshedThrough: now,
      status: "pending",
    });

    expect(refreshStore.completeRefresh).not.toHaveBeenCalled();
    expect(refreshStore.recordRefreshFailure).not.toHaveBeenCalled();
  });

  it("checkpoints address batches and resumes within the runtime budget", async () => {
    let running: {
      runId: string;
      from: Date;
      to: Date;
      nextOffset: number;
    } | null = null;
    let elapsedMs = 0;
    const appliedOffsets: number[] = [];
    const requestedOffsets: number[] = [];
    const requestedAddressBatches: number[] = [];
    const changes = Array.from({ length: 30 }, (_, index) => ({
      action: "UPDATE" as const,
      addressId: String(index + 1),
    }));
    const refreshStore = {
      findRunningRefresh: vi.fn(async () => running),
      hasOtherRunningImport: vi.fn(async () => false),
      latestCompletedCursor: vi.fn(async () => cursor),
      startRefresh: vi.fn(async (run) => {
        running = { ...run };
      }),
      applyPage: vi.fn(async ({ nextOffset }) => {
        appliedOffsets.push(nextOffset);
        running = running ? { ...running, nextOffset } : null;
      }),
      completeRefresh: vi.fn(async () => {
        running = null;
      }),
      recordRefreshFailure: vi.fn(async () => undefined),
    } as unknown as LinzAddressRefreshStore;
    const source = {
      fetchChangesPage: vi.fn(async ({ startIndex }) => {
        requestedOffsets.push(startIndex);
        return changes.slice(startIndex);
      }),
      fetchCurrentAddresses: vi.fn(async (addressIds: string[]) => {
        requestedAddressBatches.push(addressIds.length);
        elapsedMs += 60;
        return addressIds.map(address);
      }),
    };

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source,
        createRunId: () => "runtime-bounded-run",
        now: () => now,
        monotonicNow: () => elapsedMs,
        maxRuntimeMs: 100,
      }),
    ).resolves.toEqual({
      changedCount: 10,
      refreshedThrough: now,
      status: "pending",
    });

    elapsedMs = 0;
    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source,
        createRunId: () => "must-not-start-another-run",
        now: () => new Date("2026-09-12T00:00:00.000Z"),
        monotonicNow: () => elapsedMs,
        maxRuntimeMs: 100,
      }),
    ).resolves.toEqual({
      changedCount: 20,
      refreshedThrough: now,
      status: "pending",
    });

    elapsedMs = 0;
    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source,
        createRunId: () => "must-not-start-another-run",
        now: () => new Date("2026-09-13T00:00:00.000Z"),
        monotonicNow: () => elapsedMs,
        maxRuntimeMs: 100,
      }),
    ).resolves.toEqual({
      changedCount: 30,
      refreshedThrough: now,
      status: "completed",
    });

    expect(requestedOffsets).toEqual([0, 10, 20]);
    expect(requestedAddressBatches).toEqual([10, 10, 10, 10, 10]);
    expect(appliedOffsets).toEqual([10, 20, 30]);
    expect(refreshStore.startRefresh).toHaveBeenCalledOnce();
  });

  it("keeps current-address provider requests within the proven safe batch size", async () => {
    const refreshStore = store();
    const changes = Array.from({ length: 11 }, (_, index) => ({
      action: "UPDATE" as const,
      addressId: String(index + 1),
    }));
    const requestedAddressBatches: number[] = [];

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => changes),
          fetchCurrentAddresses: vi.fn(async (addressIds) => {
            requestedAddressBatches.push(addressIds.length);
            if (addressIds.length > 10) {
              throw new Error("PROVIDER_TIMEOUT");
            }
            return addressIds.map(address);
          }),
        },
        createRunId: () => "safe-batch-run",
        now: () => now,
      }),
    ).resolves.toEqual({
      changedCount: 11,
      refreshedThrough: now,
      status: "completed",
    });

    expect(requestedAddressBatches).toEqual([10, 1]);
    expect(refreshStore.applyPage).toHaveBeenCalledWith(
      expect.objectContaining({ nextOffset: 11 }),
    );
  });

  it("stops current-address batches after a provider failure without advancing the page checkpoint", async () => {
    const refreshStore = store();
    const changes = Array.from({ length: 11 }, (_, index) => ({
      action: "UPDATE" as const,
      addressId: String(index + 1),
    }));
    const requestedAddressBatches: number[] = [];

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage: vi.fn(async () => changes),
          fetchCurrentAddresses: vi.fn(async (addressIds) => {
            requestedAddressBatches.push(addressIds.length);
            throw new Error("PROVIDER_TIMEOUT");
          }),
        },
        createRunId: () => "failed-current-address-run",
        now: () => now,
      }),
    ).rejects.toThrow("PROVIDER_TIMEOUT");

    expect(requestedAddressBatches).toEqual([10]);
    expect(refreshStore.applyPage).not.toHaveBeenCalled();
    expect(refreshStore.completeRefresh).not.toHaveBeenCalled();
    expect(refreshStore.recordRefreshFailure).toHaveBeenCalledWith({
      runId: "failed-current-address-run",
      errorCode: "PROVIDER_TIMEOUT",
    });
  });

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
    const requestedAddressBatches: number[] = [];

    await expect(
      refreshLinzAddresses({
        store: refreshStore,
        source: {
          fetchChangesPage,
          fetchCurrentAddresses: vi.fn(async (addressIds) => {
            requestedAddressBatches.push(addressIds.length);
            return addressIds.map(address);
          }),
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
    expect(requestedAddressBatches).toEqual(Array(100).fill(10));
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
