import type { IndexedLinzAddress } from "./linz-address-import";

export const BROWNS_BAY_SEED_SIZE = 50;
export const BROWNS_BAY_BEACH = {
  latitude: -36.71483404659955,
  longitude: 174.75032021746165,
} as const;

export const BROWNS_BAY_BEACH_REFERENCE = {
  name: "Browns Bay beach midpoint",
  source:
    "Auckland Council Regional Assessment of Areas Susceptible to Coastal Erosion, Volume 1",
  sourceUrl:
    "https://www.aucklandcouncil.govt.nz/environment/what-we-do-to-help-environment/Documents/areas-susceptible-coastal-erosion-volume-1.pdf",
  sourceCrs: "NZGD49 / New Zealand Map Grid / EPSG:27200",
  sourceEasting: 2666792,
  sourceNorthing: 6497031,
  transformationUrl: "https://epsg.io/27200-1151",
  wgs84Latitude: -36.71483404659955,
  wgs84Longitude: 174.75032021746165,
} as const;

/**
 * Versioned LINZ address IDs selected nearest the documented Browns Bay beach
 * midpoint. Membership changes require an explicit fixture review.
 */
export const BROWNS_BAY_SEED_ADDRESS_IDS = [
  "2297898",
  "2297899",
  "2297900",
  "2297901",
  "2297902",
  "2297903",
  "2297997",
  "2297998",
  "2297995",
  "2297996",
  "2300390",
  "2300391",
  "2300392",
  "2292772",
  "2293788",
  "2293789",
  "2293790",
  "2293791",
  "2293792",
  "2293793",
  "2293794",
  "2293796",
  "2293797",
  "2298001",
  "2298002",
  "2298003",
  "2298004",
  "2298005",
  "2298006",
  "2298007",
  "2298008",
  "2298009",
  "2298010",
  "2298011",
  "2298012",
  "2298013",
  "2298014",
  "2365662",
  "2365663",
  "2297994",
  "2297993",
  "1104805",
  "1104830",
  "2297894",
  "1104823",
  "2297895",
  "3025877",
  "2297896",
  "1105341",
  "1105336",
] as const;

export function requireNoRunningAddressIndexImport(
  hasRunningImport: boolean,
): void {
  if (hasRunningImport) throw new Error("LINZ_ADDRESS_IMPORT_RUNNING");
}

export function selectBrownsBaySeedAddresses(
  candidates: readonly IndexedLinzAddress[],
): IndexedLinzAddress[] {
  const currentBrownsBayById = new Map(
    candidates
      .filter(
        (address) =>
          address.isCurrent &&
          address.suburbLocality?.trim().toLowerCase() === "browns bay",
      )
      .map((address) => [address.addressId, address]),
  );
  return BROWNS_BAY_SEED_ADDRESS_IDS.flatMap((addressId) => {
    const address = currentBrownsBayById.get(addressId);
    return address ? [address] : [];
  });
}
