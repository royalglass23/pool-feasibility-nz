import "server-only";

import { neon } from "@neondatabase/serverless";
import {
  AddressIndexUnavailableError,
  type AddressMatch,
  type AddressSearch,
  type AddressSearchStatus,
} from "./address-search";
import { normalizeAddressQuery } from "@/shared/text/normalize-address-query";

const MAX_SUGGESTIONS = 8;
const FRESHNESS_MS = 8 * 24 * 60 * 60 * 1_000;
const STATUS_CACHE_MS = 30_000;

export { AddressIndexUnavailableError } from "./address-search";

type IndexStatus = AddressSearchStatus;
let cachedStatus: { expiresAt: number; value: IndexStatus } | undefined;

export class NeonLinzAddressSearch implements AddressSearch {
  readonly #sql;

  constructor(databaseUrl = addressIndexDatabaseUrl()) {
    this.#sql = neon(databaseUrl);
  }

  async search(query: string): Promise<AddressMatch[]> {
    await this.#requireFreshIndex();
    const tsQuery = addressTsQuery(query);
    if (!tsQuery) return [];
    const fullAddressNumber = addressNumberFromQuery(query);
    const rows = await this.#sql`
      select address_id, full_address, full_address_number, unit,
        territorial_authority, longitude, latitude
      from linz_address_index
      where is_current = true
        and territorial_authority = 'Auckland'
        and to_tsvector('simple', search_text) @@ to_tsquery('simple', ${tsQuery})
      order by
        case when full_address_number = ${fullAddressNumber} then 0 else 1 end,
        ts_rank_cd(to_tsvector('simple', search_text), to_tsquery('simple', ${tsQuery})) desc,
        full_address asc
      limit ${MAX_SUGGESTIONS}
    `;
    return rows.map(toAddressMatch);
  }

  async getById(addressId: string): Promise<AddressMatch | null> {
    await this.#requireFreshIndex();
    const rows = await this.#sql`
      select address_id, full_address, full_address_number, unit,
        territorial_authority, longitude, latitude
      from linz_address_index
      where address_id = ${addressId}
        and is_current = true
        and territorial_authority = 'Auckland'
      limit 1
    `;
    return rows[0] ? toAddressMatch(rows[0]) : null;
  }

  async status(): Promise<AddressSearchStatus> {
    const now = Date.now();
    return cachedStatus && cachedStatus.expiresAt > now
      ? cachedStatus.value
      : this.#loadStatus(now);
  }

  async #requireFreshIndex(): Promise<void> {
    const status = await this.status();
    if (!status.isFresh) throw new AddressIndexUnavailableError();
  }

  async #loadStatus(now: number): Promise<IndexStatus> {
    const rows = await this.#sql`
      select completed_at
      from linz_address_index_runs
      where status = 'completed'
      order by completed_at desc
      limit 1
    `;
    const indexedAtValue = rows[0]?.completed_at;
    const indexedAt =
      indexedAtValue instanceof Date
        ? indexedAtValue
        : typeof indexedAtValue === "string"
          ? new Date(indexedAtValue)
          : null;
    const value = {
      indexedAt,
      isFresh:
        indexedAt !== null &&
        Number.isFinite(indexedAt.getTime()) &&
        now - indexedAt.getTime() <= FRESHNESS_MS,
    };
    cachedStatus = { value, expiresAt: now + STATUS_CACHE_MS };
    return value;
  }
}

function addressIndexDatabaseUrl(): string {
  const nonProduction =
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview";
  const databaseUrl = nonProduction
    ? process.env.DATABASE_URL_DEV?.trim()
    : process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new AddressIndexUnavailableError();
  return databaseUrl;
}

export function addressTsQuery(value: string): string | null {
  const tokens = normalizeAddressQuery(value)
    .split(" ")
    .filter((token) => /^[\p{L}\p{N}]+$/u.test(token));
  return tokens.length === 0
    ? null
    : tokens.map((token) => `${token}:*`).join(" & ");
}

export function addressNumberFromQuery(value: string): string | null {
  return normalizeAddressQuery(value).match(/^\d+[\p{L}]?/u)?.[0] ?? null;
}

function toAddressMatch(row: Record<string, unknown>): AddressMatch {
  return {
    addressId: String(row.address_id),
    fullAddress: String(row.full_address),
    fullAddressNumber: String(row.full_address_number),
    unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
    territorialAuthority: String(row.territorial_authority),
    coordinates: [Number(row.longitude), Number(row.latitude)],
  };
}
