import "dotenv/config";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { desc, eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import {
  fetchAucklandAddressCount,
  fetchAucklandAddressPage,
  linzAddressQueryUrl,
} from "@/modules/address-search/linz-address-import";
import { resolveAddressIndexTarget } from "./address-index-target";

const { databaseUrl, target } = resolveAddressIndexTarget({
  argv: process.argv.slice(2),
});

const db = drizzle(neon(databaseUrl), { schema });
const now = new Date();

async function main() {
  const previous = await db.query.linzAddressIndexRuns.findFirst({
    where: eq(schema.linzAddressIndexRuns.status, "running"),
    orderBy: [desc(schema.linzAddressIndexRuns.startedAt)],
  });
  const runId = previous?.id ?? randomUUID();
  let afterObjectId = previous?.lastObjectId ?? 0;
  if (!previous) {
    await db.insert(schema.linzAddressIndexRuns).values({
      id: runId,
      status: "running",
      startedAt: now,
      sourceSnapshotUrl: linzAddressQueryUrl,
      sourceSnapshotAt: now,
    });
  }

  try {
    for (;;) {
      const addresses = await fetchAucklandAddressPage({ afterObjectId });
      if (addresses.length === 0) break;
      await db
        .insert(schema.linzAddressIndex)
        .values(
          addresses.map((address) => ({
            addressId: address.addressId,
            fullAddress: address.fullAddress,
            fullAddressNumber: address.fullAddressNumber,
            unit: address.unit,
            territorialAuthority: address.territorialAuthority,
            searchText: address.searchText,
            longitude: address.longitude,
            latitude: address.latitude,
            isCurrent: address.isCurrent,
            lastSeenRunId: runId,
          })),
        )
        .onConflictDoUpdate({
          target: schema.linzAddressIndex.addressId,
          set: {
            fullAddress: sql`excluded.full_address`,
            fullAddressNumber: sql`excluded.full_address_number`,
            unit: sql`excluded.unit`,
            territorialAuthority: sql`excluded.territorial_authority`,
            searchText: sql`excluded.search_text`,
            longitude: sql`excluded.longitude`,
            latitude: sql`excluded.latitude`,
            isCurrent: sql`excluded.is_current`,
            lastSeenRunId: sql`excluded.last_seen_run_id`,
          },
        });
      afterObjectId = addresses.at(-1)!.sourceObjectId;
      await db
        .update(schema.linzAddressIndexRuns)
        .set({
          lastObjectId: afterObjectId,
          acceptedCount: sql`${schema.linzAddressIndexRuns.acceptedCount} + ${addresses.length}`,
        })
        .where(eq(schema.linzAddressIndexRuns.id, runId));
      process.stdout.write(`Imported through LINZ object ${afterObjectId}\n`);
    }

    await db
      .update(schema.linzAddressIndex)
      .set({ isCurrent: false })
      .where(
        sql`${schema.linzAddressIndex.territorialAuthority} = 'Auckland' and ${schema.linzAddressIndex.lastSeenRunId} is distinct from ${runId}`,
      );

    const [sourceCount, indexed] = await Promise.all([
      fetchAucklandAddressCount(),
      db.execute<{ count: string }>(
        sql`select count(*)::text as count from ${schema.linzAddressIndex} where ${schema.linzAddressIndex.isCurrent} = true and ${schema.linzAddressIndex.territorialAuthority} = 'Auckland'`,
      ),
    ]);
    if (Number(indexed.rows[0]?.count) !== sourceCount) {
      throw new Error("LINZ_ADDRESS_IMPORT_COUNT_MISMATCH");
    }
    await db
      .update(schema.linzAddressIndexRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        acceptedCount: sourceCount,
        errorCode: null,
      })
      .where(eq(schema.linzAddressIndexRuns.id, runId));
    process.stdout.write(
      `Completed ${sourceCount} Auckland addresses in ${target}.\n`,
    );
  } catch (error) {
    await db
      .update(schema.linzAddressIndexRuns)
      .set({
        status: "failed",
        errorCode: error instanceof Error ? error.message : "UNKNOWN",
      })
      .where(eq(schema.linzAddressIndexRuns.id, runId));
    throw error;
  }
}

void main();
