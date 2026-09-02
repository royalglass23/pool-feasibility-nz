import "dotenv/config";
import type { AddressMatch } from "@/modules/address-search/address-search";
import { NeonLinzAddressSearch } from "@/modules/address-search/neon-linz-address-search";

async function main() {
  const addressSearch = new NeonLinzAddressSearch();
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
      results: results.map(({ addressId, fullAddress }) => ({
        addressId,
        fullAddress,
      })),
    })}\n`,
  );
}

void main();
