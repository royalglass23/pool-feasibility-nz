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
 * Development-fixture selection notes only. This is not DatasetEvidence and
 * must not be used as assessment or report evidence.
 */
export const BROWNS_BAY_RESIDENTIAL_SEED_FIXTURE_NOTES = {
  purpose: "development_address_search_fixture",
  evidenceUse: "not_report_evidence",
  selectionInputs: [
    "LINZ NZ Addresses",
    "Auckland Council Unitary Plan Base Zone",
  ],
  acceptedZoneCodes: [18, 19],
  acceptedZoneNames: [
    "Residential - Mixed Housing Suburban Zone",
    "Residential - Single House Zone",
  ],
  roads: ["Clifton Road", "Manly Esplanade", "Valley Road", "Bayview Road"],
  selection:
    "50 easternmost current non-unit addresses on the approved coastal roads",
  selectionReviewedOn: "2026-09-14",
  viewCaveat:
    "Coastal position supports a Rangitoto-facing test scenario; actual dwelling orientation and view are not guaranteed.",
} as const;

/**
 * Versioned LINZ address IDs for coastal Browns Bay properties in operative
 * Auckland residential zones. Membership changes require an explicit fixture
 * review.
 */
export const BROWNS_BAY_SEED_ADDRESS_IDS = [
  "1104555",
  "1104535",
  "1104509",
  "1104489",
  "1104469",
  "1104939",
  "1104836",
  "1104791",
  "1950584",
  "1104703",
  "1104688",
  "3025821",
  "1104683",
  "1104694",
  "1104677",
  "1104695",
  "402986",
  "1104674",
  "1104639",
  "3025820",
  "1104664",
  "1104620",
  "1104647",
  "1104633",
  "1104563",
  "1104723",
  "1326609",
  "1104789",
  "1104834",
  "1104911",
  "1104456",
  "1104832",
  "1597350",
  "1104938",
  "1104476",
  "1104496",
  "1104486",
  "1104518",
  "1104515",
  "1104506",
  "1104541",
  "1104531",
  "1417573",
  "1104575",
  "1104578",
  "1104552",
  "1104670",
  "1104597",
  "1104585",
  "1104612",
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
