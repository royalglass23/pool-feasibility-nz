import { describe, expect, it } from "vitest";
import {
  BROWNS_BAY_BEACH,
  BROWNS_BAY_BEACH_REFERENCE,
  BROWNS_BAY_RESIDENTIAL_SEED_FIXTURE_NOTES,
  BROWNS_BAY_SEED_ADDRESS_IDS,
  requireNoRunningAddressIndexImport,
  selectBrownsBaySeedAddresses,
} from "@/modules/address-search/browns-bay-address-seed";
import type { IndexedLinzAddress } from "@/modules/address-search/linz-address-import";

function candidate(input: {
  addressId: string;
  latitude: number;
  longitude?: number;
  suburbLocality?: string | null;
  isCurrent?: boolean;
}): IndexedLinzAddress {
  return {
    addressId: input.addressId,
    sourceObjectId: Number(input.addressId.replace(/\D/g, "")) || 1,
    fullAddress: `${input.addressId} Test Street, Browns Bay, Auckland`,
    fullAddressNumber: input.addressId,
    unit: null,
    territorialAuthority: "Auckland",
    suburbLocality: input.suburbLocality ?? "Browns Bay",
    townCity: "Auckland",
    postcode: null,
    searchText: `${input.addressId} test street browns bay auckland`,
    longitude: input.longitude ?? BROWNS_BAY_BEACH.longitude,
    latitude: input.latitude,
    isCurrent: input.isCurrent ?? true,
  };
}

describe("Browns Bay development address seed", () => {
  it("selects the approved coastal residential addresses instead of the town-centre seed", () => {
    const approvedResidentialAddressIds = [
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
    ];
    const approved = approvedResidentialAddressIds.map((addressId, index) =>
      candidate({
        addressId,
        latitude: BROWNS_BAY_BEACH.latitude - index * 0.0001,
      }),
    );
    const selected = selectBrownsBaySeedAddresses([
      ...approved.reverse(),
      candidate({
        addressId: "2297898",
        latitude: BROWNS_BAY_BEACH.latitude,
      }),
      candidate({
        addressId: "retired",
        latitude: BROWNS_BAY_BEACH.latitude,
        isCurrent: false,
      }),
      candidate({
        addressId: "wrong-suburb",
        latitude: BROWNS_BAY_BEACH.latitude,
        suburbLocality: "Murrays Bay",
      }),
    ]);

    expect(selected).toHaveLength(50);
    expect(selected.map((address) => address.addressId)).toEqual(
      approvedResidentialAddressIds,
    );
    expect(selected.map((address) => address.addressId)).not.toContain(
      "2297898",
    );
    expect(selected.map((address) => address.addressId)).not.toContain(
      "retired",
    );
    expect(selected.map((address) => address.addressId)).not.toContain(
      "wrong-suburb",
    );
  });

  it("records the approved Browns Bay Beach reference point", () => {
    expect(new Set(BROWNS_BAY_SEED_ADDRESS_IDS).size).toBe(50);
    expect(BROWNS_BAY_BEACH_REFERENCE).toEqual({
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
    });
    expect(BROWNS_BAY_BEACH).toEqual({
      latitude: -36.71483404659955,
      longitude: 174.75032021746165,
    });
  });

  it("records non-evidence fixture selection notes and the view caveat", () => {
    expect(BROWNS_BAY_RESIDENTIAL_SEED_FIXTURE_NOTES).toEqual({
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
    });
  });

  it("refuses to replace the seed while an address import is running", () => {
    expect(() => requireNoRunningAddressIndexImport(true)).toThrow(
      "LINZ_ADDRESS_IMPORT_RUNNING",
    );
    expect(() => requireNoRunningAddressIndexImport(false)).not.toThrow();
  });
});
