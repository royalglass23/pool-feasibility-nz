import type { IndexedLinzAddress } from "./linz-address-import";
import {
  LINZ_CHANGESET_PAGE_SIZE,
  type LinzAddressChange,
} from "./linz-address-changeset";

const OVERLAP_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_PAGES_PER_INVOCATION = 4;

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
    syncedAt: Date;
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
  }): Promise<LinzAddressChange[]>;
  fetchCurrentAddresses(addressIds: string[]): Promise<IndexedLinzAddress[]>;
};

export async function refreshLinzAddresses(input: {
  store: LinzAddressRefreshStore;
  source: LinzAddressRefreshSource;
  createRunId: () => string;
  now?: () => Date;
  maxPagesPerInvocation?: number;
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
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const changes = await input.source.fetchChangesPage({
        from: run.from,
        to: run.to,
        startIndex: changedCount,
      });
      const activeIds = changes
        .filter((change) => change.action !== "DELETE")
        .map((change) => change.addressId);
      const currentAddresses = await fetchCurrentAddressesInBatches(
        activeIds,
        input.source,
      );
      changedCount += changes.length;
      await input.store.applyPage({
        runId: run.runId,
        changes,
        currentAddresses,
        syncedAt: run.to,
        nextOffset: changedCount,
      });
      if (changes.length < LINZ_CHANGESET_PAGE_SIZE) {
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

async function fetchCurrentAddressesInBatches(
  addressIds: string[],
  source: LinzAddressRefreshSource,
): Promise<IndexedLinzAddress[]> {
  const addresses: IndexedLinzAddress[] = [];
  for (let index = 0; index < addressIds.length; index += 250) {
    addresses.push(
      ...(await source.fetchCurrentAddresses(
        addressIds.slice(index, index + 250),
      )),
    );
  }
  return addresses;
}
