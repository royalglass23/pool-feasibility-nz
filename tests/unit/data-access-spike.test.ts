import addressesFixture from "../fixtures/linz/42-bahari-addresses.json";
import parcelsFixture from "../fixtures/linz/42-bahari-parcels.json";
import unitAddressFixture from "../fixtures/linz/2-49-pigeon-mountain.json";
import { describe, expect, it, vi } from "vitest";
import {
  runDataAccessSpike,
  type DataAccessSpikeGateway,
} from "@/modules/data-access-spike/run-data-access-spike";
import { assessAddressParcelAlignment } from "@/modules/data-access-spike/aerial-alignment";
import { resolveAerialVerificationPath } from "@/modules/data-access-spike/verification-artifact";

const requestedAddress = "42A Bahari Drive, Ranui, Auckland";

function createGateway(
  overrides: Partial<DataAccessSpikeGateway> = {},
): DataAccessSpikeGateway {
  return {
    searchAddresses: async () => addressesFixture,
    findParcelsAt: async ([longitude]) =>
      longitude < 174.608 ? parcelsFixture["42A"] : parcelsFixture["42"],
    countFeatures: async (dataset) => ({
      count: dataset === "planning_zone" ? 2 : 0,
      durationMs: 12,
    }),
    checkAerial: async () => ({ durationMs: 10 }),
    ...overrides,
  };
}

describe("runDataAccessSpike", () => {
  it("resolves 42A to its distinct legal parcel and deduplicates LINZ rows", async () => {
    const gateway = createGateway();

    const result = await runDataAccessSpike({
      requestedAddress,
      gateway,
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    });

    expect(result.resolvedAddress).toMatchObject({
      addressId: "2359811",
      fullAddress: requestedAddress,
      coordinates: [174.607906917203, -36.8602038189915],
    });
    expect(result.addressAlternatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          addressId: "969138",
          fullAddress: "42 Bahari Drive, Ranui, Auckland",
        }),
      ]),
    );
    expect(result.parcel).toMatchObject({
      parcelId: "8545868",
      appellation: "Lot 1 DP 576345",
      titles: ["1060427"],
    });
    expect(result.comparisonParcels).toEqual([
      expect.objectContaining({
        addressId: "969138",
        parcelId: "8545869",
        appellation: "Lot 2 DP 576345",
      }),
    ]);
    expect(result.identityCheck).toEqual({
      exactAddressMatched: true,
      distinctFromAlternatives: true,
      duplicateParcelRowsRemoved: 1,
    });
  });

  it("proves the selected address is inside its parcel while 42 is outside", async () => {
    const result = await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway(),
    });

    expect(assessAddressParcelAlignment(result)).toEqual({
      selectedAddressInsideParcel: true,
      alternatives: [
        {
          addressId: "969138",
          fullAddress: "42 Bahari Drive, Ranui, Auckland",
          insideSelectedParcel: false,
        },
      ],
      selectedParcelSeparatedFromAlternatives: true,
    });
  });

  it("uses the same resolver for a different supplied Auckland address", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42 Bahari Drive, Ranui",
      gateway: createGateway(),
    });

    expect(result.resolvedAddress).toMatchObject({
      addressId: "969138",
      fullAddress: "42 Bahari Drive, Ranui, Auckland",
    });
    expect(result.parcel).toMatchObject({
      parcelId: "8545869",
      appellation: "Lot 2 DP 576345",
    });
    expect(result.comparisonParcels).toEqual([
      expect.objectContaining({
        addressId: "2359811",
        parcelId: "8545868",
      }),
    ]);
  });

  it("does not present a unit's containing multi-title parcel as confirmed", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland",
      gateway: createGateway({
        searchAddresses: async () => unitAddressFixture.address,
        findParcelsAt: async () => unitAddressFixture.parcel,
      }),
    });

    expect(result.parcel).toMatchObject({
      parcelId: "4789010",
      parcelIntent: "DCDB",
      titles: ["NA33D/17", "NA33D/18", "NA33D/19"],
    });
    expect(result.parcelMatch).toEqual({
      status: "containing_parcel_requires_confirmation",
      reasons: [
        "The supplied address is a unit address",
        "The containing parcel is associated with multiple titles",
        "The containing parcel is not identified as a fee simple title parcel",
      ],
    });
    expect(result.blockers).toContain(
      "The mapped containing parcel cannot be treated as the unit's confirmed legal parcel",
    );
  });

  it("reports aerial and Watercare datasets as unavailable without making them up", async () => {
    const checkAerial = vi.fn(async () => ({ durationMs: 10 }));

    const result = await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway({ checkAerial }),
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    });

    expect(checkAerial).not.toHaveBeenCalled();
    expect(result.datasets.aerial_imagery).toMatchObject({
      status: "unavailable",
      reason: "LINZ_BASEMAPS_API_KEY is not configured",
    });
    expect(result.datasets.wastewater_assets).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("reuse rights"),
    });
    expect(result.datasets.public_water_assets.status).toBe("unavailable");
  });

  it("keeps technically accessible Council data out of report evidence pending permission", async () => {
    const result = await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway(),
    });

    expect(result.datasets.building_footprints.evidenceUse).toBe(
      "report_allowed",
    );
    expect(result.datasets.planning_zone).toMatchObject({
      status: "success",
      evidenceUse: "spike_only",
    });
    expect(result.datasets.wastewater_assets.evidenceUse).toBe("unavailable");
    expect(result.reportEligibleDatasets).toContain("building_footprints");
    expect(result.reportEligibleDatasets).not.toContain("planning_zone");
    expect(result.spikeOnlyDatasets).toContain("planning_zone");
  });

  it("fails closed when more than one distinct parcel contains the address point", async () => {
    const ambiguousParcels = {
      type: "FeatureCollection" as const,
      features: [
        ...parcelsFixture["42A"].features,
        parcelsFixture["42"].features[0],
      ],
    };

    const result = runDataAccessSpike({
      requestedAddress,
      gateway: createGateway({
        findParcelsAt: async () => ambiguousParcels,
      }),
    });

    await expect(result).rejects.toMatchObject({ code: "PARCEL_AMBIGUOUS" });
  });

  it("records a bounded provider error without exposing credentials", async () => {
    const gateway = createGateway({
      countFeatures: async (dataset) => {
        if (dataset === "flood_plains") {
          throw new Error(
            "request failed https://example.invalid?api=super-secret-value",
          );
        }

        return { count: 0, durationMs: 5 };
      },
    });

    const result = await runDataAccessSpike({ requestedAddress, gateway });

    expect(result.datasets.flood_plains).toMatchObject({
      status: "error",
      errorCode: "PROVIDER_REQUEST_FAILED",
    });
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });

  it("rejects provider parcel geometry that exceeds the ring vertex limit", async () => {
    const oversizedRing = Array.from({ length: 5_001 }, (_, index) => [
      174.6078 + index / 1_000_000_000,
      -36.8602,
    ]);
    const oversizedParcelResponse = {
      ...parcelsFixture["42A"],
      features: parcelsFixture["42A"].features.map((feature) => ({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [oversizedRing],
        },
      })),
    };

    await expect(
      runDataAccessSpike({
        requestedAddress,
        gateway: createGateway({
          findParcelsAt: async () => oversizedParcelResponse,
        }),
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
  });
});

describe("resolveAerialVerificationPath", () => {
  it("rejects a provider identifier that could escape the artifact directory", () => {
    expect(() =>
      resolveAerialVerificationPath("../../outside", "C:/safe/output"),
    ).toThrow("VERIFICATION_ARTIFACT_ID_INVALID");
  });
});
