import addressesFixture from "../fixtures/linz/42-bahari-addresses.json";
import parcelsFixture from "../fixtures/linz/42-bahari-parcels.json";
import unitAddressFixture from "../fixtures/linz/2-49-pigeon-mountain.json";
import {
  addressMatchesFrom,
  createDataAccessGateway as createGateway,
  parcelQueryFrom,
} from "../fixtures/normalized-data-access";
import { describe, expect, it, vi } from "vitest";
import { executeDataAccessRequest } from "@/modules/data-access-spike/execute-data-access-request";
import { DataAccessSpikeError } from "@/modules/data-access-spike/run-data-access-spike";

describe("executeDataAccessRequest", () => {
  it("validates the address before calling an official provider", async () => {
    const searchAddresses = vi.fn(async () =>
      addressMatchesFrom(addressesFixture),
    );

    const response = await executeDataAccessRequest({
      body: { address: "short" },
      gateway: createGateway({ searchAddresses }),
    });

    expect(response).toEqual({
      ok: false,
      status: 400,
      error: {
        code: "INVALID_ADDRESS",
        message: "Enter a complete Auckland property address.",
      },
    });
    expect(searchAddresses).not.toHaveBeenCalled();
  });

  it("returns the normalized spike result for a supported address", async () => {
    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway(),
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;

    expect(response.status).toBe(200);
    expect(response.data.resolvedAddress).toMatchObject({
      addressId: "2359811",
      fullAddress: "42A Bahari Drive, Ranui, Auckland",
    });
    expect(response.data.parcel).toMatchObject({
      parcelId: "8545868",
      appellation: "Lot 1 DP 576345",
    });
    expect(response.data.identityCheck.exactAddressMatched).toBe(true);
  });

  it("uses neutral scenario inputs and rejects caller-supplied preferences", async () => {
    const neutral = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    expect(neutral.ok).toBe(true);
    if (!neutral.ok) return;
    expect(neutral.data.scenarioComparison.preferences).toEqual({
      frontageDirection: null,
      preferredLocation: "any",
      preferredSize: null,
    });

    const response = await executeDataAccessRequest({
      body: {
        address: "42A Bahari Drive, Ranui, Auckland",
        frontageDirection: "south",
        preferredLocation: "front",
        preferredSize: "standard",
      },
      gateway: createGateway(),
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    expect(response).toMatchObject({
      ok: false,
      status: 400,
      error: { code: "INVALID_ADDRESS" },
    });
  });

  it("rejects removed location preference fields", async () => {
    const response = await executeDataAccessRequest({
      body: {
        address: "42A Bahari Drive, Ranui, Auckland",
        preferredLocation: "rear",
      },
      gateway: createGateway(),
    });

    expect(response).toMatchObject({
      ok: false,
      status: 400,
      error: { code: "INVALID_ADDRESS" },
    });
  });

  it("maps a known address failure to a useful safe response", async () => {
    const response = await executeDataAccessRequest({
      body: { address: "99 Example Road, Auckland" },
      gateway: createGateway({
        searchAddresses: async () => {
          throw new DataAccessSpikeError("ADDRESS_NOT_FOUND");
        },
      }),
    });

    expect(response).toEqual({
      ok: false,
      status: 404,
      error: {
        code: "ADDRESS_NOT_FOUND",
        message: "No exact Auckland address match was found.",
      },
    });
  });

  it("returns normalized choices when the supplied address is ambiguous", async () => {
    const response = await executeDataAccessRequest({
      body: { address: "Bahari Drive, Ranui, Auckland" },
      gateway: createGateway(),
    });

    expect(response).toEqual({
      ok: false,
      status: 409,
      error: {
        code: "ADDRESS_AMBIGUOUS",
        message: "Select the correct Auckland address to continue.",
        options: [
          {
            addressId: "969138",
            fullAddress: "42 Bahari Drive, Ranui, Auckland",
          },
          {
            addressId: "2359811",
            fullAddress: "42A Bahari Drive, Ranui, Auckland",
          },
        ],
      },
    });
  });

  it("resolves only the address explicitly selected from ambiguous choices", async () => {
    const response = await executeDataAccessRequest({
      body: {
        address: "Bahari Drive, Ranui, Auckland",
        selectedAddressId: "2359811",
      },
      gateway: createGateway(),
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;

    expect(response.data.resolvedAddress).toMatchObject({
      addressId: "2359811",
      fullAddress: "42A Bahari Drive, Ranui, Auckland",
    });
    expect(response.data.parcel).toMatchObject({
      parcelId: "8545868",
      appellation: "Lot 1 DP 576345",
    });
    expect(response.data.identityCheck.exactAddressMatched).toBe(false);
  });

  it("does not expose a raw credential-bearing provider error", async () => {
    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway({
        searchAddresses: async () => {
          throw new Error(
            "PROVIDER_HTTP_ERROR https://example.invalid?api=super-secret-value",
          );
        },
      }),
    });

    expect(response).toEqual({
      ok: false,
      status: 502,
      error: {
        code: "DATA_PROVIDER_ERROR",
        message:
          "An official data provider could not complete the request. Try again shortly.",
      },
    });
    expect(JSON.stringify(response)).not.toContain("super-secret-value");
  });

  it("maps an unexpected application failure separately from a provider outage", async () => {
    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway({
        searchAddresses: async () => {
          throw new Error("unexpected invariant secret-internal-detail");
        },
      }),
    });

    expect(response).toEqual({
      ok: false,
      status: 500,
      error: {
        code: "ANALYSIS_FAILED",
        message: "The property analysis could not be completed.",
      },
    });
    expect(JSON.stringify(response)).not.toContain("secret-internal-detail");
  });

  it("fails closed when the containing parcel cannot be confirmed as the legal parcel", async () => {
    const response = await executeDataAccessRequest({
      body: {
        address: "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland",
      },
      gateway: createGateway({
        searchAddresses: async () =>
          addressMatchesFrom(unitAddressFixture.address),
        findParcelsAt: async () => parcelQueryFrom(unitAddressFixture.parcel),
      }),
    });

    expect(response).toEqual({
      ok: false,
      status: 409,
      error: {
        code: "PARCEL_UNCONFIRMED",
        message:
          "The legal parcel could not be confirmed for this address. Manual property review is required.",
      },
    });
  });

  it("confirms a unit address when one fee-simple single-title parcel contains it", async () => {
    const confirmableUnitParcel = {
      ...unitAddressFixture.parcel,
      features: unitAddressFixture.parcel.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          parcel_intent: "Fee Simple Title",
          titles: "UNIT-TITLE-1",
        },
      })),
    };

    const response = await executeDataAccessRequest({
      body: {
        address: "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland",
      },
      gateway: createGateway({
        searchAddresses: async () =>
          addressMatchesFrom(unitAddressFixture.address),
        findParcelsAt: async () => parcelQueryFrom(confirmableUnitParcel),
      }),
    });

    expect(response).toMatchObject({
      ok: true,
      status: 200,
      data: {
        resolvedAddress: { unit: "2" },
        parcelMatch: { status: "mapped_primary_parcel", reasons: [] },
      },
    });
  });

  it("fails closed when a fee-simple parcel has no confirmed title", async () => {
    const titlelessParcel = {
      ...parcelsFixture["42A"],
      features: parcelsFixture["42A"].features.map((feature) => ({
        ...feature,
        properties: { ...feature.properties, titles: null },
      })),
    };

    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway({
        findParcelsAt: async ([longitude]) =>
          parcelQueryFrom(
            longitude < 174.608 ? titlelessParcel : parcelsFixture["42"],
          ),
      }),
    });

    expect(response).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "PARCEL_UNCONFIRMED" },
    });
  });

  it("fails closed when an alternative address resolves to the selected parcel", async () => {
    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway({
        findParcelsAt: async () => parcelQueryFrom(parcelsFixture["42A"]),
      }),
    });

    expect(response).toEqual({
      ok: false,
      status: 409,
      error: {
        code: "PARCEL_UNCONFIRMED",
        message:
          "The legal parcel could not be confirmed for this address. Manual property review is required.",
      },
    });
  });

  it("fails closed when an unchecked sixth alternative shares the selected parcel", async () => {
    const selected = addressesFixture.features[1];
    const alternativeTemplate = addressesFixture.features[0];
    const addressesWithSixAlternatives = {
      ...addressesFixture,
      features: [
        selected,
        ...Array.from({ length: 6 }, (_, index) => ({
          ...alternativeTemplate,
          geometry: {
            ...alternativeTemplate.geometry,
            coordinates: [174.61 + index / 1_000, -36.8602],
          },
          properties: {
            ...alternativeTemplate.properties,
            address_id: 3_000_000 + index,
            full_address: `${50 + index} Bahari Drive, Ranui, Auckland`,
            full_address_number: String(50 + index),
          },
        })),
      ],
    };

    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway({
        searchAddresses: async () =>
          addressMatchesFrom(addressesWithSixAlternatives),
        findParcelsAt: async ([longitude]) =>
          parcelQueryFrom(
            longitude < 174.608 || longitude >= 174.615
              ? parcelsFixture["42A"]
              : parcelsFixture["42"],
          ),
      }),
    });

    expect(response).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "PARCEL_UNCONFIRMED" },
    });
  });

  it("returns the supported-region error for an address outside Auckland", async () => {
    const outsideAuckland = {
      ...addressesFixture,
      features: addressesFixture.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          territorial_authority: "Wellington",
        },
      })),
    };

    const response = await executeDataAccessRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createGateway({
        searchAddresses: async () => addressMatchesFrom(outsideAuckland),
      }),
    });

    expect(response).toEqual({
      ok: false,
      status: 422,
      error: {
        code: "OUTSIDE_SUPPORTED_REGION",
        message:
          "This proof of concept currently supports Auckland addresses only.",
      },
    });
  });
});
