import { describe, expect, it } from "vitest";
import {
  BROWNS_BAY_BEACH,
  BROWNS_BAY_BEACH_REFERENCE,
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
  it("retains the approved 50 addresses when closer LINZ records appear", () => {
    const approved = BROWNS_BAY_SEED_ADDRESS_IDS.map((addressId, index) =>
      candidate({
        addressId,
        latitude: BROWNS_BAY_BEACH.latitude - index * 0.0001,
      }),
    );
    const selected = selectBrownsBaySeedAddresses([
      ...approved.reverse(),
      candidate({
        addressId: "new-closer-address",
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
      BROWNS_BAY_SEED_ADDRESS_IDS,
    );
    expect(selected.map((address) => address.addressId)).not.toContain(
      "new-closer-address",
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

  it("refuses to replace the seed while an address import is running", () => {
    expect(() => requireNoRunningAddressIndexImport(true)).toThrow(
      "LINZ_ADDRESS_IMPORT_RUNNING",
    );
    expect(() => requireNoRunningAddressIndexImport(false)).not.toThrow();
  });
});
