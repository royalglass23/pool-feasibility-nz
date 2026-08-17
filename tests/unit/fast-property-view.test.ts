import { describe, expect, it, vi } from "vitest";
import {
  buildFastCompactPoolGeometry,
  loadFastPropertyStages,
  resolveFastPropertyAddress,
  runFastPropertyView,
} from "@/modules/data-access-spike/fast-property-view";
import { distance } from "@turf/turf";
import type { DataAccessSpikeGateway } from "@/modules/data-access-spike/data-access-gateway";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import {
  FAST_POOL_CATALOGUE,
  findFastPoolDefaultPosition,
  isFastPoolWithinMappedArea,
  validateFastCustomDimensions,
} from "@/modules/data-access-spike/fast-pool-placement";
import { returnedGeometry } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

describe("runFastPropertyView", () => {
  it("builds map geometry only from returned detailed layers", () => {
    const result = {
      detailedChecks: {
        layers: [
          {
            key: "building_footprints",
            state: "returned",
            geometry: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [174.6, -36.8],
                        [174.61, -36.8],
                        [174.61, -36.81],
                        [174.6, -36.8],
                      ],
                    ],
                  },
                },
              ],
            },
          },
          { key: "contours", state: "verified_empty", geometry: null },
          {
            key: "flood_plains",
            state: "provider_error",
            geometry: { type: "FeatureCollection", features: [] },
          },
        ],
      },
    } as unknown as FastPropertyViewResult;

    expect(returnedGeometry(result, ["Polygon"]).features).toHaveLength(1);
  });

  it("exposes the v2 catalogue with Compact as the custom default", () => {
    expect(FAST_POOL_CATALOGUE).toEqual([
      { id: "plunge", label: "Plunge", lengthMetres: 4, widthMetres: 2.4 },
      { id: "compact", label: "Compact", lengthMetres: 6.5, widthMetres: 3 },
      { id: "slimline", label: "Slimline", lengthMetres: 8, widthMetres: 3 },
      { id: "family", label: "Family", lengthMetres: 8, widthMetres: 4 },
      { id: "large", label: "Large", lengthMetres: 10, widthMetres: 4.4 },
      { id: "custom", label: "Custom", lengthMetres: 6.5, widthMetres: 3 },
    ]);
  });

  it("accepts only tenth-metre custom dimensions in the v2 range", () => {
    expect(validateFastCustomDimensions(2, 1.5)).toEqual({
      lengthMetres: 2,
      widthMetres: 1.5,
    });
    expect(validateFastCustomDimensions(20, 10)).toEqual({
      lengthMetres: 20,
      widthMetres: 10,
    });
    expect(validateFastCustomDimensions(2.05, 3)).toBeNull();
    expect(validateFastCustomDimensions(20.1, 3)).toBeNull();
    expect(validateFastCustomDimensions(6.5, 1.4)).toBeNull();
  });

  it("uses the whole rotated construction envelope for mapped-area containment", async () => {
    const gateway = createDataAccessGateway();
    const parcel = (await gateway.findParcelsAt([174.6082, -36.8603]))
      .parcels[0];
    const position = findFastPoolDefaultPosition(
      parcel.geometry,
      { lengthMetres: 6.5, widthMetres: 3 },
      45,
    );

    expect(position).not.toBeNull();
    expect(
      isFastPoolWithinMappedArea(
        position!,
        { lengthMetres: 6.5, widthMetres: 3 },
        45,
        parcel.geometry,
      ),
    ).toBe(true);
    expect(
      isFastPoolWithinMappedArea(
        parcel.geometry.coordinates[0][0] as [number, number],
        { lengthMetres: 6.5, widthMetres: 3 },
        45,
        parcel.geometry,
      ),
    ).toBe(false);
  });

  it("returns the address and boundary before aerial stages complete", async () => {
    const gateway = createDataAccessGateway();
    const findParcelsAt = vi.spyOn(gateway, "findParcelsAt");
    const initial = await resolveFastPropertyAddress({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway,
    });

    expect(initial.resolvedAddress.addressId).toBe("2359811");
    expect(initial.progress.boundary).toBe("found");
    expect(initial.boundary.geometry).not.toBeNull();
    expect(initial.progress.aerial).toBe("loading");
    expect(findParcelsAt).toHaveBeenCalledOnce();

    if (!initial.datasets.legal_parcel) {
      throw new Error("Expected initial legal parcel evidence.");
    }

    const stage = await loadFastPropertyStages({
      resolvedAddress: initial.resolvedAddress,
      gateway,
      basemapApiKey: "test-key",
      initialBoundary: {
        boundary: initial.boundary,
        legalParcelEvidence: initial.datasets.legal_parcel,
        progressBoundary: initial.progress.boundary,
      },
    });
    expect(stage.progress.boundary).toBe("found");
    expect(stage.progress.aerial).toBe("ready");
    expect(findParcelsAt).toHaveBeenCalledOnce();
  });

  it("uses the confirmed LINZ address ID without repeating the text lookup", async () => {
    const gateway = createDataAccessGateway();
    const searchAddresses = vi.spyOn(gateway, "searchAddresses");

    const initial = await resolveFastPropertyAddress({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      selectedAddressId: "2359811",
      gateway,
    });

    expect(initial.resolvedAddress.addressId).toBe("2359811");
    expect(searchAddresses).not.toHaveBeenCalled();
  });

  it("builds the default Compact geometry in metres", () => {
    const geometry = buildFastCompactPoolGeometry([174.6082, -36.8603]);
    const ring = geometry.features[0].geometry.coordinates[0];

    expect(distance(ring[0], ring[1], { units: "meters" })).toBeCloseTo(6.5, 1);
    expect(distance(ring[1], ring[2], { units: "meters" })).toBeCloseTo(3, 1);
  });

  it("returns the address, boundary, aerial readiness, and Compact without detailed queries", async () => {
    const gateway = createDataAccessGateway();
    const countFeatures = vi.spyOn(gateway, "countFeatures");

    const result = await runFastPropertyView({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway,
      basemapApiKey: "test-key",
      now: () => new Date("2026-07-28T00:00:00.000Z"),
    });

    expect(result.resolvedAddress.addressId).toBe("2359811");
    expect(result.boundary.state).toBe("confirmed");
    expect(result.aerial.state).toBe("ready");
    expect(result.defaultPool).toMatchObject({
      id: "compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    });
    expect(result.progress.detailedChecks).toBe("not_loaded");
    expect(result.fastPathDurationMs).toBeGreaterThanOrEqual(0);
    expect(countFeatures).not.toHaveBeenCalled();
  });

  it("keeps the address view usable when boundary and aerial providers are unavailable", async () => {
    const gateway: DataAccessSpikeGateway = {
      ...createDataAccessGateway(),
      findParcelsAt: vi.fn(async () => {
        throw new Error("PROVIDER_TIMEOUT");
      }),
      checkAerial: vi.fn(async () => {
        throw new Error("PROVIDER_TIMEOUT");
      }),
    };

    const result = await runFastPropertyView({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway,
      basemapApiKey: "test-key",
    });

    expect(result.resolvedAddress.fullAddress).toContain("42A Bahari Drive");
    expect(result.boundary.state).toBe("unavailable");
    expect(result.aerial.state).toBe("error");
    expect(result.progress.address).toBe("found");
  });

  it("preserves legal-parcel provider evidence when boundary loading fails", async () => {
    const gateway: DataAccessSpikeGateway = {
      ...createDataAccessGateway(),
      findParcelsAt: vi.fn(async () => {
        throw new Error("PROVIDER_TIMEOUT");
      }),
    };

    const result = await runFastPropertyView({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway,
      basemapApiKey: "test-key",
    });

    expect(result.datasets.legal_parcel).toMatchObject({
      status: "error",
      evidenceUse: "unavailable",
      errorCode: "PROVIDER_TIMEOUT",
    });
  });

  it("keeps a mapped parcel provisional when title certainty is incomplete", async () => {
    const gateway = createDataAccessGateway();
    const baseParcels = await gateway.findParcelsAt([174.6082, -36.8603]);
    const provisionalParcel = {
      ...baseParcels.parcels[0],
      titles: [],
      parcelIntent: "DCDB",
    };

    gateway.findParcelsAt = vi.fn(async () => ({
      parcels: [provisionalParcel],
      duplicatesRemoved: 0,
    }));

    const result = await runFastPropertyView({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway,
      basemapApiKey: "test-key",
    });

    expect(result.boundary.state).toBe("provisional");
    expect(result.boundary.geometry).not.toBeNull();
  });
});
