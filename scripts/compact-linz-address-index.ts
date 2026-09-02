import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_DEV?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_DEV is required.");
if (process.env.DATABASE_URL === databaseUrl) {
  throw new Error(
    "Use the dedicated DATABASE_URL_DEV target, not DATABASE_URL.",
  );
}
const confirmedDatabaseUrl = databaseUrl;

const removedColumns = [
  "source_object_id",
  "suburb_locality",
  "town_city",
  "postcode",
  "source_updated_at",
  "synced_at",
] as const;

async function main() {
  const sql = neon(confirmedDatabaseUrl);
  const [columns, compactTable] = await Promise.all([
    sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'linz_address_index'
    `,
    sql`select to_regclass('public.linz_address_index_compact') as relation`,
  ]);

  const presentColumns = new Set(columns.map((row) => String(row.column_name)));
  const pendingColumns = removedColumns.filter((column) =>
    presentColumns.has(column),
  );
  if (pendingColumns.length > 0) {
    throw new Error("LINZ_ADDRESS_INDEX_MIGRATION_REQUIRED");
  }
  if (compactTable[0]?.relation) {
    throw new Error("LINZ_ADDRESS_INDEX_COMPACTION_ALREADY_EXISTS");
  }

  await sql.transaction((tx) => [
    tx`LOCK TABLE "linz_address_index" IN ACCESS EXCLUSIVE MODE`,
    tx`
      create table "linz_address_index_compact" (
        "address_id" text not null,
        "full_address" text not null,
        "full_address_number" text not null,
        "unit" text,
        "territorial_authority" text not null,
        "search_text" text not null,
        "longitude" double precision not null,
        "latitude" double precision not null,
        "is_current" boolean not null
      )
    `,
    tx`
      insert into "linz_address_index_compact" (
        "address_id", "full_address", "full_address_number", "unit",
        "territorial_authority", "search_text", "longitude", "latitude", "is_current"
      )
      select
        "address_id", "full_address", "full_address_number", "unit",
        "territorial_authority", "search_text", "longitude", "latitude", "is_current"
      from "linz_address_index"
    `,
    tx`
      create index "linz_address_index_compact_current_ta_idx"
      on "linz_address_index_compact" using btree ("is_current", "territorial_authority")
    `,
    tx`
      create index "linz_address_index_compact_search_tsv_idx"
      on "linz_address_index_compact" using gin (to_tsvector('simple', "search_text"))
    `,
    tx`drop table "linz_address_index"`,
    tx`alter table "linz_address_index_compact" rename to "linz_address_index"`,
    tx`
      alter table "linz_address_index"
      add constraint "linz_address_index_pkey" primary key ("address_id")
    `,
    tx`
      alter index "linz_address_index_compact_current_ta_idx"
      rename to "linz_address_index_current_ta_idx"
    `,
    tx`
      alter index "linz_address_index_compact_search_tsv_idx"
      rename to "linz_address_index_search_tsv_idx"
    `,
  ]);

  const [size] = await sql`
    select
      count(*)::text as indexed_count,
      pg_size_pretty(pg_total_relation_size('public.linz_address_index')) as total_size
    from "linz_address_index"
  `;
  process.stdout.write(`${JSON.stringify(size)}\n`);
}

void main();
