import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { NeonLinzAddressSearch } from "@/modules/address-search/neon-linz-address-search";
import { resolveAddressIndexTarget } from "./address-index-target";

const { databaseUrl, target } = resolveAddressIndexTarget({
  argv: process.argv.slice(2),
});

async function main() {
  const sql = neon(databaseUrl);
  if (process.argv.includes("--reconcile-run-count")) {
    await sql`
      update linz_address_index_runs
      set accepted_count = (select count(*) from linz_address_index where is_current = true and territorial_authority = 'Auckland')
      where id = (
        select id from linz_address_index_runs
        where status = 'completed'
        order by completed_at desc
        limit 1
      )
    `;
  }
  const rows = await sql`
    select
      (select count(*)::text from linz_address_index) as indexed_count,
      (select status from linz_address_index_runs order by started_at desc limit 1) as status,
      (select accepted_count::text from linz_address_index_runs order by started_at desc limit 1) as accepted_count,
      (select error_code from linz_address_index_runs order by started_at desc limit 1) as error_code
  `;
  const status = await new NeonLinzAddressSearch(databaseUrl).status();
  process.stdout.write(
    `${JSON.stringify({
      ...rows[0],
      target,
      indexed_at: status.indexedAt?.toISOString() ?? null,
      is_fresh: status.isFresh,
    })}\n`,
  );
}

void main();
