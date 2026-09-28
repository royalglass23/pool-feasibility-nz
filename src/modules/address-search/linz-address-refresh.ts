import {
  LINZ_CURRENT_ADDRESS_BATCH_SIZE,
  type IndexedLinzAddress,
} from "./linz-address-import";
import {
  LINZ_CHANGESET_PAGE_SIZE,
  type LinzAddressChange,
} from "./linz-address-changeset";

const OVERLAP_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_PAGES_PER_INVOCATION = 4;
const DEFAULT_MAX_RUNTIME_MS = 240_000;

export type LinzAddressRefreshRun = {
  runId: string;
  from: Date;
  to: Date;
  nextOffset: number;
};

export type LinzAddressRefreshStore = {
  findRunningRefresh(): Promise<LinzAddressRefreshRun | null>;
  hasOtherRunningImport(): Promise<boolean>;
  latestCompletedCursor(): Promise<Date | null>;
  startRefresh(run: LinzAddressRefreshRun): Promise<void>;
  applyPage(input: {
    runId: string;
    changes: LinzAddressChange[];
    currentAddresses: IndexedLinzAddress[];
    nextOffset: number;
  }): Promise<void>;
  completeRefresh(input: { runId: string; cursor: Date }): Promise<void>;
  recordRefreshFailure(input: {
    runId: string;
    errorCode: string;
  }): Promise<void>;
};

export type LinzAddressRefreshSource = {
  fetchChangesPage(input: {
    from: Date;
    to: Date;
    startIndex: number;
    signal: AbortSignal;
  }): Promise<LinzAddressChange[]>;
  fetchCurrentAddresses(
    addressIds: string[],
    signal: AbortSignal,
  ): Promise<IndexedLinzAddress[]>;
};

type RuntimeBoundResult<T> =
  { status: "completed"; value: T } | { status: "expired" };

export async function refreshLinzAddresses(input: {
  store: LinzAddressRefreshStore;
  source: LinzAddressRefreshSource;
  createRunId: () => string;
  now?: () => Date;
  monotonicNow?: () => number;
  maxPagesPerInvocation?: number;
  maxRuntimeMs?: number;
}): Promise<{
  changedCount: number;
  refreshedThrough: Date;
  status: "completed" | "pending";
}> {
  const existing = await input.store.findRunningRefresh();
  let run = existing;

  if (!run) {
    if (await input.store.hasOtherRunningImport()) {
      throw new Error("LINZ_ADDRESS_REFRESH_IMPORT_RUNNING");
    }
    const cursor = await input.store.latestCompletedCursor();
    if (!cursor) throw new Error("LINZ_ADDRESS_REFRESH_BASELINE_REQUIRED");
    const to = (input.now ?? (() => new Date()))();
    run = {
      runId: input.createRunId(),
      from: new Date(cursor.getTime() - OVERLAP_MS),
      to,
      nextOffset: 0,
    };
    await input.store.startRefresh(run);
  }

  let changedCount = run.nextOffset;
  const maxPages =
    input.maxPagesPerInvocation ?? DEFAULT_MAX_PAGES_PER_INVOCATION;
  const monotonicNow = input.monotonicNow ?? (() => performance.now());
  const startedAt = monotonicNow();
  const maxRuntimeMs = input.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS;
  const runtimeExpired = () => monotonicNow() - startedAt >= maxRuntimeMs;
  const pendingResult = () => ({
    changedCount,
    refreshedThrough: run.to,
    status: "pending" as const,
  });
  const runProviderWithinRuntime = async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<RuntimeBoundResult<T>> => {
    const remainingMs = maxRuntimeMs - (monotonicNow() - startedAt);
    if (remainingMs <= 0) return { status: "expired" };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    try {
      return {
        status: "completed",
        value: await operation(controller.signal),
      };
    } catch (error) {
      if (controller.signal.aborted) return { status: "expired" };
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const changesResult = await runProviderWithinRuntime((signal) =>
        input.source.fetchChangesPage({
          from: run.from,
          to: run.to,
          startIndex: changedCount,
          signal,
        }),
      );
      if (changesResult.status === "expired") return pendingResult();
      const changes = changesResult.value;
      for (
        let index = 0;
        index < changes.length;
        index += LINZ_CURRENT_ADDRESS_BATCH_SIZE
      ) {
        if (runtimeExpired()) return pendingResult();
        const changeBatch = changes.slice(
          index,
          index + LINZ_CURRENT_ADDRESS_BATCH_SIZE,
        );
        const activeIds = changeBatch
          .filter((change) => change.action !== "DELETE")
          .map((change) => change.addressId);
        let currentAddresses: IndexedLinzAddress[] = [];
        if (activeIds.length > 0) {
          const currentAddressesResult = await runProviderWithinRuntime(
            (signal) => input.source.fetchCurrentAddresses(activeIds, signal),
          );
          if (currentAddressesResult.status === "expired") {
            return pendingResult();
          }
          currentAddresses = currentAddressesResult.value;
        }
        if (runtimeExpired()) return pendingResult();
        changedCount += changeBatch.length;
        await input.store.applyPage({
          runId: run.runId,
          changes: changeBatch,
          currentAddresses,
          nextOffset: changedCount,
        });
      }
      if (changes.length < LINZ_CHANGESET_PAGE_SIZE) {
        if (runtimeExpired()) return pendingResult();
        await input.store.completeRefresh({
          runId: run.runId,
          cursor: run.to,
        });
        return {
          changedCount,
          refreshedThrough: run.to,
          status: "completed",
        };
      }
    }

    return {
      changedCount,
      refreshedThrough: run.to,
      status: "pending",
    };
  } catch (error) {
    await input.store.recordRefreshFailure({
      runId: run.runId,
      errorCode: error instanceof Error ? error.message : "UNKNOWN",
    });
    throw error;
  }
}
