import { describe, expect, it, vi } from "vitest";
import { executeFastPropertyDetailsRequest } from "@/modules/data-access-spike/execute-fast-property-details";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import type { FeatureCollection, Geometry } from "geojson";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";
import type { DatasetEvidence } from "@/modules/data-access-spike/data-access-gateway";

const geometry: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: 1 },
      geometry: { type: "Point", coordinates: [174.6082, -36.8603] },
    },
  ],
};

const terrainSource = {
  provider: "Land Information New Zealand",
  dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
  datasetIdentifier:
    "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
  status: "success",
  licenceStatus: "permitted",
  evidenceUse: "spike_only",
  retrievedAt: "2026-09-14T00:00:00.000Z",
  datasetDate: "2024-04-30/2024-06-27",
  licence: "Creative Commons Attribution 4.0 International",
  attribution: {
    text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
    url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
  },
  geometryUsed: "Bounded 1 m bare-earth elevation grid in NZTM2000",
  attributesUsed: ["elevation_metres"],
  evidenceType: "terrain_elevation_grid",
  confidence: "limited",
} satisfies DatasetEvidence;

describe("executeFastPropertyDetailsRequest", () => {
  it("assesses terrain across the mapped parcel without a pool placement", async () => {
    const assessParcel = vi.fn(async () => ({
      status: "measured" as const,
      averageSlopeDegrees: 2.4,
      upperSlopeDegrees: 3.8,
      estimatedFallMetres: 0.36,
      downhillBearingDegrees: 135,
      downhillDirection: "SE",
      confidence: "indicative" as const,
      source: terrainSource,
    }));
    const response = await executeFastPropertyDetailsRequest({
      body: {
        mode: "detailed",
        addressId: "2359811",
        coordinates: [174.607906917203, -36.8602038189915],
      },
      gateway: createDataAccessGateway(),
      terrain: { assessParcel },
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe("complete");
    expect(response.data.terrain).toMatchObject({
      status: "measured",
      averageSlopeDegrees: 2.4,
    });
    expect(assessParcel).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Polygon" }),
    );
  });

  it("starts terrain assessment while detailed constraint layers are still pending", async () => {
    let markConstraintLayerStarted!: () => void;
    const constraintLayerStarted = new Promise<void>((resolve) => {
      markConstraintLayerStarted = resolve;
    });
    let releaseConstraintLayers!: () => void;
    const constraintLayersReleased = new Promise<void>((resolve) => {
      releaseConstraintLayers = resolve;
    });
    const assessParcel = vi.fn(async () => ({
      status: "needs_checking" as const,
      reasons: ["Terrain fixture completed."],
    }));
    const responsePromise = executeFastPropertyDetailsRequest({
      body: {
        mode: "detailed",
        addressId: "2359811",
        coordinates: [174.607906917203, -36.8602038189915],
      },
      gateway: createDataAccessGateway({
        queryFeatures: vi.fn(async () => {
          markConstraintLayerStarted();
          await constraintLayersReleased;
          return geometry;
        }),
      }),
      terrain: { assessParcel },
    });

    await constraintLayerStarted;
    try {
      expect(assessParcel).toHaveBeenCalledTimes(1);
    } finally {
      releaseConstraintLayers();
      await responsePromise;
    }
  });

  it("returns an indicative terrain result for the entire mapped 42A Bahari parcel", async () => {
    const assessParcel = vi.fn(async () => ({
      status: "measured" as const,
      averageSlopeDegrees: 2.4,
      upperSlopeDegrees: 3.8,
      estimatedFallMetres: 0.36,
      downhillBearingDegrees: 135,
      downhillDirection: "SE",
      confidence: "indicative" as const,
      source: terrainSource,
    }));
    const response = await executeFastPropertyDetailsRequest({
      body: {
        mode: "detailed",
        addressId: "2359811",
        coordinates: [174.607906917203, -36.8602038189915],
      },
      gateway: createDataAccessGateway(),
      terrain: {
        assessParcel,
      },
      now: () => new Date("2026-09-14T00:00:00.000Z"),
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.terrain).toEqual({
      status: "measured",
      averageSlopeDegrees: 2.4,
      upperSlopeDegrees: 3.8,
      estimatedFallMetres: 0.36,
      downhillBearingDegrees: 135,
      downhillDirection: "SE",
      confidence: "indicative",
      source: terrainSource,
    });
    expect(assessParcel).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Polygon" }),
    );
  });

  it("returns Needs Checking when the mapped parcel is unavailable", async () => {
    const assessParcel = vi.fn();
    const response = await executeFastPropertyDetailsRequest({
      body: {
        mode: "detailed",
        addressId: "2359811",
        coordinates: [174.607906917203, -36.8602038189915],
      },
      gateway: createDataAccessGateway({
        findParcelsAt: vi.fn(async () => ({
          parcels: [],
          duplicatesRemoved: 0,
        })),
      }),
      terrain: { assessParcel },
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.terrain).toEqual({
      status: "needs_checking",
      reasons: [
        "The mapped property parcel is unavailable, so its indicative slope could not be assessed.",
      ],
    });
    expect(assessParcel).not.toHaveBeenCalled();
  });

  it("completes available constraint layers when terrain needs checking", async () => {
    const response = await executeFastPropertyDetailsRequest({
      body: {
        mode: "detailed",
        addressId: "2359811",
        coordinates: [174.607906917203, -36.8602038189915],
      },
      gateway: createDataAccessGateway({
        queryFeatures: vi.fn(
          async () =>
            ({
              type: "FeatureCollection",
              features: [],
            }) as FeatureCollection<Geometry>,
        ),
      }),
      terrain: {
        assessParcel: vi.fn(async () => ({
          status: "needs_checking" as const,
          reasons: ["No valid Auckland elevation data covers this window."],
        })),
      },
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.constraints).toEqual({
      status: "complete",
      retryableLayerKeys: [],
      unavailableLayerKeys: ["culverts"],
    });
    expect(response.data.status).toBe("complete");
    expect(response.data.terrain).toEqual({
      status: "needs_checking",
      reasons: ["No valid Auckland elevation data covers this window."],
    });
  });

  it("returns full, partial, empty, internal-reference, and returned geometry states", async () => {
    const gateway = createDataAccessGateway({
      queryFeatures: vi.fn(async (dataset) => {
        if (dataset === "building_footprints") return geometry;
        if (dataset === "wastewater_assets") return geometry;
        return {
          type: "FeatureCollection",
          features: [],
        } as FeatureCollection<Geometry>;
      }),
    });
    const response = await executeFastPropertyDetailsRequest({
      body: {
        mode: "detailed",
        addressId: "2359811",
        coordinates: [174.6082, -36.8603],
      },
      gateway,
      now: () => new Date("2026-07-28T00:00:00.000Z"),
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe("complete");
    expect(
      response.data.layers.find((layer) => layer.key === "building_footprints"),
    ).toMatchObject({ state: "returned", geometry });
    expect(
      response.data.layers.find((layer) => layer.key === "contours"),
    ).toMatchObject({ state: "verified_empty", geometry: null });
    expect(
      response.data.layers.find((layer) => layer.key === "wastewater_assets"),
    ).toMatchObject({ state: "internal_reference_only", geometry });
    expect(
      response.data.layers.find((layer) => layer.key === "culverts"),
    ).toMatchObject({ state: "unavailable", geometry: null });
  });

  it("keeps provider failures partial and never draws failed geometry", async () => {
    const gateway = createDataAccessGateway({
      queryFeatures: vi.fn(async (dataset) => {
        if (dataset === "building_footprints")
          throw new Error("PROVIDER_TIMEOUT");
        if (dataset === "contours") throw new Error("PROVIDER_HTTP_ERROR");
        return {
          type: "FeatureCollection",
          features: [],
        } as FeatureCollection<Geometry>;
      }),
    });
    const response = await executeFastPropertyDetailsRequest({
      body: { addressId: "2359811", coordinates: [174.6082, -36.8603] },
      gateway,
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe("partial");
    expect(response.data.constraints).toMatchObject({
      status: "retryable",
      retryableLayerKeys: ["building_footprints", "contours"],
    });
    expect(
      response.data.layers.find((layer) => layer.key === "building_footprints"),
    ).toMatchObject({ state: "timeout", geometry: null });
    expect(
      response.data.layers.find((layer) => layer.key === "contours"),
    ).toMatchObject({ state: "provider_error", geometry: null });
  });

  it("keeps unexpected non-retryable unavailability complete and honest", async () => {
    const response = await executeFastPropertyDetailsRequest({
      body: { addressId: "2359811", coordinates: [174.6082, -36.8603] },
      gateway: createDataAccessGateway({
        queryFeatures: vi.fn(async (dataset) => {
          if (dataset === "building_footprints") {
            throw new Error("UNSUPPORTED_PROVIDER_RESPONSE");
          }
          return {
            type: "FeatureCollection",
            features: [],
          } as FeatureCollection<Geometry>;
        }),
      }),
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.constraints).toMatchObject({
      status: "complete",
      retryableLayerKeys: [],
      unavailableLayerKeys: expect.arrayContaining([
        "building_footprints",
        "culverts",
      ]),
    });
    expect(
      response.data.layers.find((layer) => layer.key === "building_footprints"),
    ).toMatchObject({
      state: "unavailable",
      geometry: null,
      message: expect.not.stringMatching(/retry/i),
    });
  });

  it("bounds concurrent provider queries and accepts retry after a failure", async () => {
    let active = 0;
    let maximum = 0;
    const queryFeatures = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return {
        type: "FeatureCollection",
        features: [],
      } as FeatureCollection<Geometry>;
    });
    const gateway = createDataAccessGateway({ queryFeatures });
    const input = {
      body: { addressId: "2359811", coordinates: [174.6082, -36.8603] },
      gateway,
      concurrency: 3,
    } as const;
    await executeFastPropertyDetailsRequest(input);
    await executeFastPropertyDetailsRequest(input);
    expect(maximum).toBeLessThanOrEqual(3);
    expect(queryFeatures).toHaveBeenCalledTimes(
      queryableDatasetKeys.length * 2,
    );
  });

  it("coalesces concurrent identical detail requests at the public executor seam", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queryFeatures = vi.fn(async () => {
      await gate;
      return {
        type: "FeatureCollection",
        features: [],
      } as FeatureCollection<Geometry>;
    });
    const gateway = createDataAccessGateway({ queryFeatures });
    const input = {
      body: {
        addressId: "coalesce-2359811",
        coordinates: [174.6082, -36.8603],
      },
      gateway,
    } as const;
    const first = executeFastPropertyDetailsRequest(input);
    const second = executeFastPropertyDetailsRequest(input);
    release();
    const [left, right] = await Promise.all([first, second]);
    expect(left).toEqual(right);
    expect(queryFeatures).toHaveBeenCalledTimes(queryableDatasetKeys.length);
  });

  it("makes unavailable geometry explicit when the adapter has no detailed query", async () => {
    const response = await executeFastPropertyDetailsRequest({
      body: { addressId: "2359811", coordinates: [174.6082, -36.8603] },
      gateway: createDataAccessGateway(),
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(
      response.data.layers.every((layer) => layer.state === "unavailable"),
    ).toBe(true);
    expect(response.data.layers.every((layer) => layer.geometry === null)).toBe(
      true,
    );
  });
});
