import "dotenv/config";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  BROWNS_BAY_SEED_SIZE,
  requireNoRunningAddressIndexImport,
  selectBrownsBaySeedAddresses,
} from "@/modules/address-search/browns-bay-address-seed";
import {
  fetchBrownsBayAddressPage,
  linzAddressQueryUrl,
} from "@/modules/address-search/linz-address-import";
import {
  requireDevelopmentAddressSeed,
  resolveAddressIndexTarget,
} from "./address-index-target";

const argv = process.argv.slice(2);
requireDevelopmentAddressSeed(argv);
const { databaseUrl } = resolveAddressIndexTarget({ argv: [] });
const sql = neon(databaseUrl);

async function main() {
  const [runState] = await sql`
    select exists(
      select 1 from linz_address_index_runs where status = 'running'
    ) as has_running
  `;
  requireNoRunningAddressIndexImport(Boolean(runState?.has_running));

  const candidates = [];
  for (let offset = 0; ; offset += 2000) {
    const page = await fetchBrownsBayAddressPage({ offset });
    candidates.push(...page);
    if (page.length < 2000) break;
  }

  const selected = selectBrownsBaySeedAddresses(candidates);
  if (selected.length !== BROWNS_BAY_SEED_SIZE) {
    throw new Error("BROWNS_BAY_ADDRESS_SEED_INCOMPLETE");
  }

  const runId = randomUUID();
  const seededAt = new Date();
  const rows = selected.map((address) => ({
    address_id: address.addressId,
    full_address: address.fullAddress,
    full_address_number: address.fullAddressNumber,
    unit: address.unit,
    territorial_authority: address.territorialAuthority,
    search_text: address.searchText,
    longitude: address.longitude,
    latitude: address.latitude,
    is_current: address.isCurrent,
    last_seen_run_id: runId,
  }));
  await sql.transaction((tx) => [
    tx`lock table linz_address_index_runs in share row exclusive mode`,
    tx`
      do $seed$
      begin
        if exists (
          select 1 from linz_address_index_runs where status = 'running'
        ) then
          raise exception 'LINZ_ADDRESS_IMPORT_RUNNING';
        end if;
      end
      $seed$
    `,
    tx`delete from linz_address_index`,
    tx`
      insert into linz_address_index_runs (
        id, status, started_at, completed_at, source_snapshot_url,
        source_snapshot_at, last_object_id, accepted_count, rejected_count
      ) values (
        ${runId}, 'completed', ${seededAt}, ${seededAt},
        ${`${linzAddressQueryUrl}#browns-bay-seed`}, ${seededAt},
        ${Math.max(...selected.map((address) => address.sourceObjectId))},
        ${BROWNS_BAY_SEED_SIZE}, 0
      )
    `,
    tx`
      insert into linz_address_index (
        address_id, full_address, full_address_number, unit,
        territorial_authority, search_text, longitude, latitude,
        is_current, last_seen_run_id
      )
      select
        address_id, full_address, full_address_number, unit,
        territorial_authority, search_text, longitude, latitude,
        is_current, last_seen_run_id
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as seed(
        address_id text,
        full_address text,
        full_address_number text,
        unit text,
        territorial_authority text,
        search_text text,
        longitude double precision,
        latitude double precision,
        is_current boolean,
        last_seen_run_id uuid
      )
    `,
  ]);

  process.stdout.write(
    `Seeded ${BROWNS_BAY_SEED_SIZE} current Browns Bay addresses in development.\n`,
  );
}

void main();
