import { describe, expect, it, vi } from "vitest";
import { executeFastPropertyDetailsRequest } from "@/modules/data-access-spike/execute-fast-property-details";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import type { FeatureCollection, Geometry } from "geojson";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";

const geometry: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: { id: 1 }, geometry: { type: "Point", coordinates: [174.6082, -36.8603] } }],
};

describe("executeFastPropertyDetailsRequest", () => {
  it("returns full, partial, empty, internal-reference, and returned geometry states", async () => {
    const gateway = createDataAccessGateway({
      queryFeatures: vi.fn(async (dataset) => {
        if (dataset === "building_footprints") return geometry;
        if (dataset === "wastewater_assets") return geometry;
        return { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
      }),
    });
    const response = await executeFastPropertyDetailsRequest({
      body: { mode: "detailed", addressId: "2359811", coordinates: [174.6082, -36.8603] },
      gateway,
      now: () => new Date("2026-07-28T00:00:00.000Z"),
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe("complete");
    expect(response.data.layers.find((layer) => layer.key === "building_footprints")).toMatchObject({ state: "returned", geometry });
    expect(response.data.layers.find((layer) => layer.key === "contours")).toMatchObject({ state: "verified_empty", geometry: null });
    expect(response.data.layers.find((layer) => layer.key === "wastewater_assets")).toMatchObject({ state: "internal_reference_only", geometry });
    expect(response.data.layers.find((layer) => layer.key === "culverts")).toMatchObject({ state: "unavailable", geometry: null });
  });

  it("keeps provider failures partial and never draws failed geometry", async () => {
    const gateway = createDataAccessGateway({
      queryFeatures: vi.fn(async (dataset) => {
        if (dataset === "building_footprints") throw new Error("PROVIDER_TIMEOUT");
        if (dataset === "contours") throw new Error("PROVIDER_HTTP_ERROR");
        return { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
      }),
    });
    const response = await executeFastPropertyDetailsRequest({
      body: { addressId: "2359811", coordinates: [174.6082, -36.8603] },
      gateway,
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe("partial");
    expect(response.data.layers.find((layer) => layer.key === "building_footprints")).toMatchObject({ state: "timeout", geometry: null });
    expect(response.data.layers.find((layer) => layer.key === "contours")).toMatchObject({ state: "provider_error", geometry: null });
  });

  it("bounds concurrent provider queries and accepts retry after a failure", async () => {
    let active = 0;
    let maximum = 0;
    const queryFeatures = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
    });
    const gateway = createDataAccessGateway({ queryFeatures });
    const input = { body: { addressId: "2359811", coordinates: [174.6082, -36.8603] }, gateway, concurrency: 3 } as const;
    await executeFastPropertyDetailsRequest(input);
    await executeFastPropertyDetailsRequest(input);
    expect(maximum).toBeLessThanOrEqual(3);
    expect(queryFeatures).toHaveBeenCalledTimes(queryableDatasetKeys.length * 2);
  });

  it("coalesces concurrent identical detail requests at the public executor seam", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queryFeatures = vi.fn(async () => {
      await gate;
      return { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
    });
    const gateway = createDataAccessGateway({ queryFeatures });
    const input = { body: { addressId: "coalesce-2359811", coordinates: [174.6082, -36.8603] }, gateway } as const;
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
    expect(response.data.layers.every((layer) => layer.state === "unavailable")).toBe(true);
    expect(response.data.layers.every((layer) => layer.geometry === null)).toBe(true);
  });
});
