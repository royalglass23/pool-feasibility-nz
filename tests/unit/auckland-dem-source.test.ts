import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromUrl = vi.hoisted(() => vi.fn());
const fromCustomClient = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("geotiff", () => ({ fromCustomClient, fromUrl }));

import {
  readAucklandDemWindow,
  type AucklandDemSourceMetadata,
} from "@/modules/providers/linz/read-auckland-dem-window";

const validProvenance = {
  stacItemUrl:
    "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.json",
  assetChecksum: `1220${"a".repeat(64)}`,
  assetUpdatedAt: "2026-01-13T03:02:19Z",
  retrievedAt: "2026-09-11T03:00:00.000Z",
} satisfies AucklandDemSourceMetadata;
const validPartTwoProvenance = {
  ...validProvenance,
  stacItemUrl:
    "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/BA30_1000_0501.json",
} satisfies AucklandDemSourceMetadata;

function validStacResponse(): Response {
  return Response.json({
    type: "Feature",
    assets: {
      visual: {
        href: "./BA30_1000_0501.tiff",
        "file:checksum": validProvenance.assetChecksum,
        updated: validProvenance.assetUpdatedAt,
      },
    },
  });
}

const validImageMetadata = {
  getGDALNoData: () => -9999,
  getGeoKeys: () => ({
    GTModelTypeGeoKey: 1,
    GTRasterTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 2193,
    ProjLinearUnitsGeoKey: 9001,
  }),
  getOrigin: () => [1_749_000, 5_921_000, 0],
  getResolution: () => [1, -1, 0],
  getBoundingBox: () => [1_749_000, 5_919_000, 1_752_000, 5_921_000],
  getSamplesPerPixel: () => 1,
  getFileDirectory: () => ({
    getValue: (tag: string) => {
      if (tag === "ModelPixelScale") return new Float64Array([1, 1, 0]);
      if (tag === "ModelTiepoint") {
        return new Float64Array([0, 0, 0, 1_749_000, 5_921_000, 0]);
      }
      if (tag === "SampleFormat") return new Uint16Array([3]);
      if (tag === "BitsPerSample") return new Uint16Array([32]);
      return undefined;
    },
  }),
};

describe("readAucklandDemWindow", () => {
  beforeEach(() => {
    fromUrl.mockReset();
    fromCustomClient.mockReset();
    fromCustomClient.mockImplementation((...args) => fromUrl(...args));
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => validStacResponse()),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns Needs Checking before reading when Auckland DEM provenance is incomplete", async () => {
    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_002,
      },
      provenance: {
        stacItemUrl: "https://example.test/BA30_1000_0501.json",
      } as AucklandDemSourceMetadata,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation provenance is incomplete or invalid."],
    });
    expect(fromCustomClient).not.toHaveBeenCalled();
  });

  it("returns Needs Checking when official STAC metadata cannot validate the asset checksum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Response.json({
          type: "Feature",
          assets: {
            visual: {
              href: "./BA30_1000_0501.tiff",
              updated: validProvenance.assetUpdatedAt,
            },
          },
        }),
      ),
    );
    const raster = Object.assign(new Float32Array(9).fill(12), {
      width: 3,
      height: 3,
    });
    fromUrl.mockResolvedValue({
      getImage: async () => validImageMetadata,
      readRasters: async () => raster,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_003,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation provenance is incomplete or invalid."],
    });
    expect(fromCustomClient).not.toHaveBeenCalled();
  });

  it("returns Needs Checking when the COG declares a CRS other than NZTM2000", async () => {
    const raster = Object.assign(new Float32Array(9).fill(12), {
      width: 3,
      height: 3,
    });
    const readRasters = vi.fn(async () => raster);
    fromUrl.mockResolvedValue({
      getImage: async () => ({
        ...validImageMetadata,
        getGeoKeys: () => ({
          ...validImageMetadata.getGeoKeys(),
          ProjectedCSTypeGeoKey: 4326,
        }),
      }),
      readRasters,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_003,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation grid metadata is unsupported."],
    });
    expect(readRasters).not.toHaveBeenCalled();
  });

  it("returns Needs Checking when the COG is not a north-up one-metre pixel grid", async () => {
    const raster = Object.assign(new Float32Array(9).fill(12), {
      width: 3,
      height: 3,
    });
    const readRasters = vi.fn(async () => raster);
    fromUrl.mockResolvedValue({
      getImage: async () => ({
        ...validImageMetadata,
        getResolution: () => [2, -2, 0],
      }),
      readRasters,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_003,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation grid metadata is unsupported."],
    });
    expect(readRasters).not.toHaveBeenCalled();
  });

  it("returns Needs Checking when the COG declares non-metre elevation units", async () => {
    const raster = Object.assign(new Float32Array(9).fill(12), {
      width: 3,
      height: 3,
    });
    const readRasters = vi.fn(async () => raster);
    fromUrl.mockResolvedValue({
      getImage: async () => ({
        ...validImageMetadata,
        getGeoKeys: () => ({
          ...validImageMetadata.getGeoKeys(),
          VerticalUnitsGeoKey: 9002,
        }),
      }),
      readRasters,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_003,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation grid metadata is unsupported."],
    });
    expect(readRasters).not.toHaveBeenCalled();
  });

  it("returns a normalized south-to-north elevation grid from a bounded COG window", async () => {
    const raster = Object.assign(new Float32Array([13, 12, 11, 10, 9, 8]), {
      width: 3,
      height: 2,
    });
    fromUrl.mockResolvedValue({
      getImage: async () => validImageMetadata,
      readRasters: async () => raster,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000.2,
        minimumNorth: 5_920_000.2,
        maximumEast: 1_750_003.2,
        maximumNorth: 5_920_002.2,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "available",
      grid: {
        width: 3,
        height: 2,
        originEastMetres: 1_750_000,
        originNorthMetres: 5_920_000,
        cellSizeMetres: 1,
        elevationsMetres: [10, 9, 8, 13, 12, 11],
      },
      provenance: {
        provider: "Land Information New Zealand",
        dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
        datasetIdentifier:
          "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "spike_only",
        retrievedAt: "2026-09-11T03:00:00.000Z",
        datasetDate: "2024-04-30/2024-06-27",
        licence: "Creative Commons Attribution 4.0 International",
        licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
        attribution: {
          text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
          url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
        },
        geometryUsed: "Bounded 1 m bare-earth elevation grid in NZTM2000",
        attributesUsed: ["elevation_metres"],
        evidenceType: "terrain_elevation_grid",
        confidence: "limited",
        stacCollectionUrl:
          "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/collection.json",
        stacItemUrl:
          "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.json",
        assetChecksum: `1220${"a".repeat(64)}`,
        assetUpdatedAt: "2026-01-13T03:02:19Z",
        horizontalCrs: "EPSG:2193",
        horizontalUnit: "metre",
        verticalDatum: "NZVD2016",
        elevationUnit: "metre",
        gridResolutionMetres: 1,
        assetUrl:
          "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      },
    });
  });

  it("returns Needs Checking when any cell in the requested window is NoData", async () => {
    const raster = Object.assign(new Float32Array([13, 12, 11, 10, 9, -9999]), {
      width: 3,
      height: 2,
    });
    fromUrl.mockResolvedValue({
      getImage: async () => validImageMetadata,
      readRasters: async () => raster,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_002,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation window contains missing data."],
    });
  });

  it("returns Needs Checking when the COG cannot be read", async () => {
    fromUrl.mockRejectedValue(new Error("upstream unavailable"));

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_020,
        maximumNorth: 5_920_020,
      },
      provenance: validPartTwoProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation data could not be read."],
    });
  });

  it("retries one transient DEM source failure within the configured bound", async () => {
    vi.stubEnv("PROVIDER_RETRY_COUNT", "1");
    const raster = Object.assign(new Float32Array(9).fill(12), {
      width: 3,
      height: 3,
    });
    fromUrl
      .mockRejectedValueOnce(new Error("transient source failure"))
      .mockResolvedValueOnce({
        getImage: async () => validImageMetadata,
        readRasters: async () => raster,
        close: vi.fn(),
      });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_003,
        maximumNorth: 5_920_003,
      },
      provenance: validProvenance,
    });

    expect(result).toMatchObject({ status: "available" });
  });

  it("returns Needs Checking when a DEM read exceeds the provider timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("PROVIDER_TIMEOUT_MS", "1000");
    vi.stubEnv("PROVIDER_RETRY_COUNT", "0");
    fromUrl.mockImplementation(
      (_url, _options, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Timed out", "AbortError")),
            { once: true },
          );
        }),
    );

    const resultPromise = readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_020,
        maximumNorth: 5_920_020,
      },
      provenance: validProvenance,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const outcome = await Promise.race([
      resultPromise,
      Promise.resolve("still pending"),
    ]);
    expect(outcome).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation data could not be read."],
    });
  });

  it("returns Needs Checking when the requested window has no elevation coverage", async () => {
    const raster = Object.assign(new Float32Array(16).fill(-9999), {
      width: 4,
      height: 4,
    });
    fromUrl.mockResolvedValue({
      getImage: async () => validImageMetadata,
      readRasters: async () => raster,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_004,
        maximumNorth: 5_920_004,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["No valid Auckland elevation data covers this window."],
    });
  });

  it("rejects a decoded DEM response above the bounded cell limit", async () => {
    const raster = Object.assign(new Float32Array(10_100).fill(12), {
      width: 101,
      height: 100,
    });
    fromUrl.mockResolvedValue({
      getImage: async () => validImageMetadata,
      readRasters: async () => raster,
      close: vi.fn(),
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_100,
        maximumNorth: 5_920_100,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation response is too large."],
    });
  });

  it("rejects a DEM transfer whose declared size exceeds the byte budget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        if (String(input).endsWith(".json")) return validStacResponse();
        return new Response(new Uint8Array([1]), {
          headers: { "Content-Length": "4000001" },
        });
      }),
    );
    fromCustomClient.mockImplementation(async (client) => {
      await client.request({ headers: { Range: "bytes=0-1023" } });
      throw new Error("The oversized transfer should stop before decoding.");
    });

    const result = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
      boundsNztm: {
        minimumEast: 1_750_000,
        minimumNorth: 5_920_000,
        maximumEast: 1_750_020,
        maximumNorth: 5_920_020,
      },
      provenance: validProvenance,
    });

    expect(result).toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation response is too large."],
    });
  });

  it("caps concurrent Auckland DEM reads at the provider limit", async () => {
    let activeReads = 0;
    let maximumActiveReads = 0;
    fromUrl.mockImplementation(async () => {
      activeReads += 1;
      maximumActiveReads = Math.max(maximumActiveReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeReads -= 1;
      const raster = Object.assign(new Float32Array(9).fill(12), {
        width: 3,
        height: 3,
      });
      return {
        getImage: async () => validImageMetadata,
        readRasters: async () => raster,
        close: vi.fn(),
      };
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        readAucklandDemWindow({
          assetUrl:
            "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA30_1000_0501.tiff",
          boundsNztm: {
            minimumEast: 1_750_000 + index,
            minimumNorth: 5_920_000,
            maximumEast: 1_750_003 + index,
            maximumNorth: 5_920_003,
          },
          provenance: validProvenance,
        }),
      ),
    );

    expect(results.every(({ status }) => status === "available")).toBe(true);
    expect(maximumActiveReads).toBeLessThanOrEqual(4);
  });
});
