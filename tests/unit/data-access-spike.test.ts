import parcelsFixture from "../fixtures/linz/42-bahari-parcels.json";
import unitAddressFixture from "../fixtures/linz/2-49-pigeon-mountain.json";
import {
  addressMatchesFrom,
  createDataAccessGateway as createGateway,
  parcelQueryFrom,
} from "../fixtures/normalized-data-access";
import { describe, expect, it, vi } from "vitest";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { assessAddressParcelAlignment } from "@/modules/data-access-spike/aerial-alignment";
import { resolveAerialVerificationPath } from "@/modules/data-access-spike/verification-artifact";

const requestedAddress = "42A Bahari Drive, Ranui, Auckland";

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
        searchAddresses: async () =>
          addressMatchesFrom(unitAddressFixture.address),
        findParcelsAt: async () => parcelQueryFrom(unitAddressFixture.parcel),
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
        "The containing parcel must be associated with exactly one title",
        "The containing parcel is not identified as a fee simple title parcel",
      ],
    });
    expect(result.blockers).toContain(
      "The mapped containing parcel cannot be treated as the confirmed legal parcel",
    );
  });

  it("keeps aerial unavailable and labels Watercare geometry as internal reference", async () => {
    const checkAerial = vi.fn(async () => ({
      durationMs: 10,
      attribution: {
        text: "© CC BY 4.0 LINZ",
        url: "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
      },
    }));

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
      status: "success",
      evidenceUse: "internal_reference",
    });
    expect(result.datasets.public_water_assets).toMatchObject({
      status: "success",
      evidenceUse: "internal_reference",
    });
    expect(result.datasets.wastewater_manholes.evidenceUse).toBe(
      "internal_reference",
    );
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
    expect(result.datasets.wastewater_assets.evidenceUse).toBe(
      "internal_reference",
    );
    expect(result.reportEligibleDatasets).toContain("building_footprints");
    expect(result.reportEligibleDatasets).not.toContain("planning_zone");
    expect(result.reportEligibleDatasets).not.toContain("wastewater_assets");
    expect(result.spikeOnlyDatasets).toContain("planning_zone");
    expect(result.spikeOnlyDatasets).not.toContain("wastewater_assets");
    expect(result.internalReferenceDatasets).toContain("wastewater_assets");
  });

  it("carries normalized official geometry into evidence instead of reducing it to a count", async () => {
    const buildingGeometry = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          id: "building-901",
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [174.60782, -36.86028],
                [174.60796, -36.86028],
                [174.60796, -36.86016],
                [174.60782, -36.86016],
                [174.60782, -36.86028],
              ],
            ],
          },
          properties: { building_id: 901 },
        },
      ],
    };
    const gateway = createGateway({
      queryFeatures: async (dataset: string) =>
        dataset === "building_footprints"
          ? buildingGeometry
          : { type: "FeatureCollection", features: [] },
    } as never);

    const result = await runDataAccessSpike({ requestedAddress, gateway });

    expect(result.datasets.building_footprints).toMatchObject({
      status: "success",
      featureCount: 1,
      geometry: buildingGeometry,
    });
    expect(result.datasets.planning_zone).toMatchObject({
      status: "success",
      featureCount: 0,
      geometry: { type: "FeatureCollection", features: [] },
    });
  });

  it("raises the terrain critical flag from validated contour elevations", async () => {
    const result = await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway({
        queryFeatures: async (dataset) => ({
          type: "FeatureCollection",
          features:
            dataset === "contours"
              ? [
                  {
                    type: "Feature",
                    geometry: {
                      type: "LineString",
                      coordinates: [
                        [174.6078, -36.8602],
                        [174.608, -36.8602],
                      ],
                    },
                    properties: { elevation: 40 },
                  },
                  {
                    type: "Feature",
                    geometry: {
                      type: "LineString",
                      coordinates: [
                        [174.6078, -36.86019],
                        [174.608, -36.86019],
                      ],
                    },
                    properties: { elevation: 41 },
                  },
                ]
              : [],
        }),
      }),
    });

    expect(result.feasibilityAssessment.criticalFlags).toContainEqual(
      expect.objectContaining({ id: "severe_mapped_terrain" }),
    );
  });

  it("returns complete normalized provenance without calling style access verified imagery", async () => {
    const result = await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway(),
      basemapApiKey: "test-basemap-key",
      now: () => new Date("2026-07-17T00:00:00.000Z"),
    });

    for (const evidence of Object.values(result.datasets)) {
      expect(evidence).toEqual(
        expect.objectContaining({
          datasetIdentifier: expect.any(String),
          retrievedAt: "2026-07-17T00:00:00.000Z",
          datasetDate: expect.toSatisfy(
            (value) => value === null || typeof value === "string",
          ),
          licence: expect.any(String),
          attribution: expect.toSatisfy(
            (value) =>
              value === null ||
              (typeof value?.text === "string" &&
                typeof value?.url === "string"),
          ),
          geometryUsed: expect.toSatisfy(
            (value) => value === null || typeof value === "string",
          ),
          attributesUsed: expect.any(Array),
          evidenceType: expect.any(String),
          confidence: expect.stringMatching(/^(high|limited|unavailable)$/),
        }),
      );
    }
    expect(result.datasets.address_resolution).toMatchObject({
      evidenceType: "address_resolution",
      geometryUsed: "address_point",
      confidence: "high",
    });
    expect(result.datasets.aerial_imagery).toMatchObject({
      status: "available",
      evidenceUse: "report_allowed",
      evidenceType: "aerial_style_metadata",
      geometryUsed: null,
      confidence: "limited",
    });
    expect(result.reportEligibleDatasets).toContain("aerial_imagery");
  });

  it("keeps official dataset probes within the conservative concurrency limit", async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway({
        countFeatures: async () => {
          activeRequests += 1;
          maximumActiveRequests = Math.max(
            maximumActiveRequests,
            activeRequests,
          );
          await new Promise((resolve) => setTimeout(resolve, 0));
          activeRequests -= 1;
          return { count: 0, durationMs: 1 };
        },
      }),
    });

    expect(maximumActiveRequests).toBe(1);
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
        findParcelsAt: async () => parcelQueryFrom(ambiguousParcels),
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

  it("preserves a stable timeout evidence state without exposing the provider error", async () => {
    const gateway = createGateway({
      countFeatures: async (dataset) => {
        if (dataset === "flood_plains") {
          throw new Error(
            "PROVIDER_TIMEOUT https://example.invalid?api=super-secret-value",
          );
        }
        return { count: 0, durationMs: 5 };
      },
    });

    const result = await runDataAccessSpike({ requestedAddress, gateway });

    expect(result.datasets.flood_plains).toMatchObject({
      status: "error",
      errorCode: "PROVIDER_TIMEOUT",
    });
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });

  it("preserves a stable aerial timeout evidence state", async () => {
    const result = await runDataAccessSpike({
      requestedAddress,
      gateway: createGateway({
        checkAerial: async () => {
          throw new Error("PROVIDER_TIMEOUT upstream-secret");
        },
      }),
      basemapApiKey: "test-key",
    });

    expect(result.datasets.aerial_imagery).toMatchObject({
      status: "error",
      evidenceUse: "unavailable",
      errorCode: "PROVIDER_TIMEOUT",
    });
    expect(JSON.stringify(result)).not.toContain("upstream-secret");
  });
});

describe("resolveAerialVerificationPath", () => {
  it("rejects a provider identifier that could escape the artifact directory", () => {
    expect(() =>
      resolveAerialVerificationPath("../../outside", "C:/safe/output"),
    ).toThrow("VERIFICATION_ARTIFACT_ID_INVALID");
  });
});
