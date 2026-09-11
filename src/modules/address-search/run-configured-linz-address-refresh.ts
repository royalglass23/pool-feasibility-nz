import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  fetchAucklandAddressChangesPage,
  linzAddressChangesetMarker,
} from "./linz-address-changeset";
import {
  fetchCurrentAucklandAddressesByIds,
  linzAddressQueryUrl,
} from "./linz-address-import";
import {
  refreshLinzAddresses,
  type LinzAddressRefreshStore,
} from "./linz-address-refresh";
import { createLinzAddressRefreshHandler } from "./handle-linz-address-refresh-request";

export const handleLinzAddressRefreshRequest = createLinzAddressRefreshHandler({
  cronSecret: env.CRON_SECRET,
  runRefresh: async () => {
    if (!env.LINZ_DATA_SERVICE_API_KEY) {
      throw new Error("LINZ_ADDRESS_REFRESH_NOT_CONFIGURED");
    }
    const db = getDb();
    return refreshLinzAddresses({
      store: createRefreshStore(db),
      source: {
        fetchChangesPage: ({ from, to, startIndex }) =>
          fetchAucklandAddressChangesPage({
            apiKey: env.LINZ_DATA_SERVICE_API_KEY!,
            from,
            to,
            startIndex,
          }),
        fetchCurrentAddresses: (addressIds) =>
          fetchCurrentAucklandAddressesByIds({ addressIds }),
      },
      createRunId: randomUUID,
    });
  },
});

type AddressDb = ReturnType<typeof getDb>;

export function createRefreshStore(db: AddressDb): LinzAddressRefreshStore {
  return {
    async findRunningRefresh() {
      const run = await db.query.linzAddressIndexRuns.findFirst({
        where: and(
          eq(schema.linzAddressIndexRuns.status, "running"),
          eq(
            schema.linzAddressIndexRuns.sourceSnapshotUrl,
            linzAddressChangesetMarker,
          ),
        ),
        orderBy: [desc(schema.linzAddressIndexRuns.startedAt)],
      });
      if (!run || !run.sourceSnapshotAt || !run.sourceUpdatedAt) return null;
      return {
        runId: run.id,
        from: run.sourceSnapshotAt,
        to: run.sourceUpdatedAt,
        nextOffset: run.lastObjectId ?? 0,
      };
    },
    async hasOtherRunningImport() {
      const run = await db.query.linzAddressIndexRuns.findFirst({
        where: and(
          eq(schema.linzAddressIndexRuns.status, "running"),
          or(
            isNull(schema.linzAddressIndexRuns.sourceSnapshotUrl),
            ne(
              schema.linzAddressIndexRuns.sourceSnapshotUrl,
              linzAddressChangesetMarker,
            ),
          ),
        ),
      });
      return Boolean(run);
    },
    async latestCompletedCursor() {
      const run = await db.query.linzAddressIndexRuns.findFirst({
        where: eq(schema.linzAddressIndexRuns.status, "completed"),
        orderBy: [desc(schema.linzAddressIndexRuns.completedAt)],
      });
      if (run?.sourceSnapshotUrl === linzAddressQueryUrl) {
        return run.sourceSnapshotAt ?? run.completedAt ?? null;
      }
      return (
        run?.sourceUpdatedAt ??
        run?.sourceSnapshotAt ??
        run?.completedAt ??
        null
      );
    },
    async startRefresh(run) {
      await db.insert(schema.linzAddressIndexRuns).values({
        id: run.runId,
        status: "running",
        startedAt: new Date(),
        sourceSnapshotUrl: linzAddressChangesetMarker,
        sourceSnapshotAt: run.from,
        sourceUpdatedAt: run.to,
        lastObjectId: run.nextOffset,
      });
    },
    async applyPage({
      runId,
      changes,
      currentAddresses,
      syncedAt,
      nextOffset,
    }) {
      if (currentAddresses.length > 0) {
        await db
          .insert(schema.linzAddressIndex)
          .values(currentAddresses.map((address) => ({ ...address, syncedAt })))
          .onConflictDoUpdate({
            target: schema.linzAddressIndex.addressId,
            set: {
              sourceObjectId: sql`excluded.source_object_id`,
              fullAddress: sql`excluded.full_address`,
              fullAddressNumber: sql`excluded.full_address_number`,
              unit: sql`excluded.unit`,
              territorialAuthority: sql`excluded.territorial_authority`,
              suburbLocality: sql`excluded.suburb_locality`,
              townCity: sql`excluded.town_city`,
              searchText: sql`excluded.search_text`,
              longitude: sql`excluded.longitude`,
              latitude: sql`excluded.latitude`,
              isCurrent: sql`excluded.is_current`,
              syncedAt: sql`excluded.synced_at`,
            },
          });
      }

      const currentIds = new Set(
        currentAddresses.map((address) => address.addressId),
      );
      const inactiveIds = changes
        .map((change) => change.addressId)
        .filter((addressId) => !currentIds.has(addressId));
      if (inactiveIds.length > 0) {
        await db
          .update(schema.linzAddressIndex)
          .set({ isCurrent: false, syncedAt })
          .where(inArray(schema.linzAddressIndex.addressId, inactiveIds));
      }

      await db
        .update(schema.linzAddressIndexRuns)
        .set({
          lastObjectId: nextOffset,
          acceptedCount: nextOffset,
          errorCode: null,
        })
        .where(eq(schema.linzAddressIndexRuns.id, runId));
    },
    async completeRefresh({ runId, cursor }) {
      await db
        .update(schema.linzAddressIndexRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          sourceUpdatedAt: cursor,
          errorCode: null,
        })
        .where(eq(schema.linzAddressIndexRuns.id, runId));
    },
    async recordRefreshFailure({ runId, errorCode }) {
      await db
        .update(schema.linzAddressIndexRuns)
        .set({ errorCode })
        .where(
          and(
            eq(schema.linzAddressIndexRuns.id, runId),
            eq(schema.linzAddressIndexRuns.status, "running"),
          ),
        );
    },
  };
}
