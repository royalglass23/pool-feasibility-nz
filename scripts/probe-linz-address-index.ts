import "dotenv/config";
import type { AddressMatch } from "@/modules/address-search/address-search";
import { NeonLinzAddressSearch } from "@/modules/address-search/neon-linz-address-search";
import { resolveAddressIndexTarget } from "./address-index-target";

async function main() {
  const { databaseUrl, target } = resolveAddressIndexTarget({
    argv: process.argv.slice(2),
  });
  const addressSearch = new NeonLinzAddressSearch(databaseUrl);
  const durations: number[] = [];
  let results: AddressMatch[] = [];
  for (let count = 0; count < 5; count += 1) {
    const startedAt = performance.now();
    results = await addressSearch.search("42A Bahari");
    durations.push(Math.round(performance.now() - startedAt));
  }
  process.stdout.write(
    `${JSON.stringify({
      durationsMs: durations,
      target,
      results: results.map(({ addressId, fullAddress }) => ({
        addressId,
        fullAddress,
      })),
    })}\n`,
  );
}

void main();
