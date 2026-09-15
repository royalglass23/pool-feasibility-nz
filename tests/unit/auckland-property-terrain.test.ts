import { describe, expect, it, vi } from "vitest";
import type { Polygon } from "geojson";
import type { AucklandDemProvenance } from "@/modules/providers/linz/read-auckland-dem-window";
import type { ResolvedAucklandDemTile } from "@/modules/providers/linz/resolve-auckland-dem-tile";
import { projectNztmPolygonToWgs84 } from "@/modules/providers/linz/project-auckland-dem-geometry";
import { KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL } from "@/modules/terrain/known-auckland-dem-boundary-parcel";
import {
  createAucklandPropertyTerrainGateway,
  type AucklandTerrainWindowReader,
} from "@/modules/terrain/auckland-property-terrain";

vi.mock("server-only", () => ({}));

const validatedProvenance = {
  provider: "Land Information New Zealand",
  dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
  datasetIdentifier:
    "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
  status: "success" as const,
  licenceStatus: "permitted" as const,
  evidenceUse: "spike_only" as const,
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
  confidence: "limited" as const,
  stacCollectionUrl:
    "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/collection.json",
  stacItemUrl:
    "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA31_10000_0403.json",
  assetUrl:
    "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA31_10000_0403.tiff",
  assetChecksum:
    "1220fdcdf61368d526ac00a461863c6402921595f9cc43d8f05020b5f49431dd1dbf",
  assetUpdatedAt: "2026-01-13T03:02:19Z",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  horizontalCrs: "EPSG:2193" as const,
  horizontalUnit: "metre" as const,
  verticalDatum: "NZVD2016" as const,
  elevationUnit: "metre" as const,
  gridResolutionMetres: 1 as const,
} satisfies AucklandDemProvenance;

describe("Auckland property terrain", () => {
  it("derives indicative slope for the mapped property parcel at 42A Bahari Drive", async () => {
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      const width = input.boundsNztm.maximumEast - input.boundsNztm.minimumEast;
      const height =
        input.boundsNztm.maximumNorth - input.boundsNztm.minimumNorth;
      return {
        status: "available" as const,
        provenance: validatedProvenance,
        grid: {
          width,
          height,
          originEastMetres: input.boundsNztm.minimumEast,
          originNorthMetres: input.boundsNztm.minimumNorth,
          cellSizeMetres: 1,
          elevationsMetres: Array.from(
            { length: width * height },
            (_, index) => {
              const east = index % width;
              const north = Math.floor(index / width);
              return east * 0.04 + north * 0.03;
            },
          ),
        },
      };
    });
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      now: () => new Date("2026-09-14T00:00:00.000Z"),
    });
    const parcel: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.6075, -36.86055],
          [174.60825, -36.86055],
          [174.60825, -36.85985],
          [174.6075, -36.85985],
          [174.6075, -36.86055],
        ],
      ],
    };

    const result = await terrain.assessParcel(parcel);

    expect(readWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        assetUrl: expect.stringContaining("BA31_10000_0403.tiff"),
        provenance: expect.objectContaining({
          assetChecksum:
            "1220fdcdf61368d526ac00a461863c6402921595f9cc43d8f05020b5f49431dd1dbf",
        }),
        boundsNztm: expect.objectContaining({
          minimumEast: expect.any(Number),
          minimumNorth: expect.any(Number),
          maximumEast: expect.any(Number),
          maximumNorth: expect.any(Number),
        }),
      }),
    );
    expect(result).toMatchObject({
      status: "measured",
      downhillDirection: "SW",
      confidence: "indicative",
      source: validatedProvenance,
    });
    if (result.status !== "measured") return;
    expect(result.averageSlopeDegrees).toBeCloseTo(2.8624052261117474, 10);
    expect(result.upperSlopeDegrees).toBeCloseTo(2.862405226111749, 10);
    const slopeSamples = result.slopeSamples ?? [];
    expect(slopeSamples.length).toBeGreaterThan(4);
    expect(slopeSamples[0]).toMatchObject({
      position: [expect.any(Number), expect.any(Number)],
      slopeDegrees: expect.closeTo(2.86, 2),
      eastGradient: expect.closeTo(0.04, 10),
      northGradient: expect.closeTo(0.03, 10),
    });
  });

  it("assesses a parcel outside BA31 with the tile selected by the Auckland catalogue", async () => {
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      const width = input.boundsNztm.maximumEast - input.boundsNztm.minimumEast;
      const height =
        input.boundsNztm.maximumNorth - input.boundsNztm.minimumNorth;
      return {
        status: "available" as const,
        provenance: {
          ...validatedProvenance,
          stacItemUrl: input.provenance.stacItemUrl,
          assetUrl: input.assetUrl,
          assetChecksum: input.provenance.assetChecksum,
          assetUpdatedAt: input.provenance.assetUpdatedAt,
          retrievedAt: input.provenance.retrievedAt,
        },
        grid: {
          width,
          height,
          originEastMetres: input.boundsNztm.minimumEast,
          originNorthMetres: input.boundsNztm.minimumNorth,
          cellSizeMetres: 1,
          elevationsMetres: Array.from(
            { length: width * height },
            (_, index) => (index % width) * 0.02,
          ),
        },
      };
    });
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      now: () => new Date("2026-09-15T00:00:00.000Z"),
    });
    const parcel: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [175.14, -36.79],
          [175.1403, -36.79],
          [175.1403, -36.7897],
          [175.14, -36.7897],
          [175.14, -36.79],
        ],
      ],
    };

    const result = await terrain.assessParcel(parcel);

    expect(readWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        assetUrl: expect.stringContaining("BA33_10000_0303.tiff"),
        provenance: expect.objectContaining({
          stacItemUrl: expect.stringContaining("BA33_10000_0303.json"),
          assetChecksum:
            "1220043d757542e80d829cf25e9ccec2dbaf2ecc4e45b8cbd54208e9fc7d33cae02e",
          retrievedAt: "2026-09-15T00:00:00.000Z",
        }),
      }),
    );
    expect(result.status).toBe("measured");
  });

  it("returns truthful Needs Checking wording outside Auckland 2024 DEM coverage", async () => {
    const readWindow: AucklandTerrainWindowReader = vi.fn();
    const terrain = createAucklandPropertyTerrainGateway({ readWindow });
    const outsideAuckland: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [170.5, -45.9],
          [170.5002, -45.9],
          [170.5002, -45.8998],
          [170.5, -45.8998],
          [170.5, -45.9],
        ],
      ],
    };

    await expect(terrain.assessParcel(outsideAuckland)).resolves.toEqual({
      status: "needs_checking",
      reasons: [
        "The mapped property parcel is outside the indexed Auckland 2024 elevation coverage.",
      ],
    });
    expect(readWindow).not.toHaveBeenCalled();
  });

  it("does not misreport invalid catalogue metadata as absent coverage", async () => {
    const readWindow: AucklandTerrainWindowReader = vi.fn();
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTile: () => ({ status: "invalid_catalogue" }),
    });
    const parcel: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.6075, -36.86055],
          [174.60825, -36.86055],
          [174.60825, -36.85985],
          [174.6075, -36.85985],
          [174.6075, -36.86055],
        ],
      ],
    };

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: [
        "The Auckland 2024 elevation catalogue metadata is invalid or unavailable.",
      ],
    });
    expect(readWindow).not.toHaveBeenCalled();
  });

  it("returns truthful Needs Checking wording at a mapped elevation boundary", async () => {
    const readWindow: AucklandTerrainWindowReader = vi.fn();
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTile: () => ({ status: "tile_boundary" }),
    });
    const parcel: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [175.139, -36.79],
          [175.141, -36.79],
          [175.141, -36.78],
          [175.139, -36.78],
          [175.139, -36.79],
        ],
      ],
    };

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: [
        "Terrain data for this property crosses a mapped data boundary and needs further checking.",
      ],
    });
    expect(readWindow).not.toHaveBeenCalled();
  });

  it("keeps every resolved tile read bounded at a catalogue edge", async () => {
    const westTop = [175.1236279, -36.7424081] as const;
    const westBottom = [175.1254186, -36.8072698] as const;
    const edgeTop = interpolate(westTop, westBottom, 0.4);
    const edgeBottom = interpolate(westTop, westBottom, 0.401);
    const parcel: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          edgeTop,
          edgeBottom,
          [edgeBottom[0] + 0.0001, edgeBottom[1]],
          [edgeTop[0] + 0.0001, edgeTop[1]],
          edgeTop,
        ],
      ],
    };
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      const width = input.boundsNztm.maximumEast - input.boundsNztm.minimumEast;
      const height =
        input.boundsNztm.maximumNorth - input.boundsNztm.minimumNorth;
      return {
        status: "available" as const,
        provenance: {
          ...validatedProvenance,
          assetUrl: input.assetUrl,
          stacItemUrl: input.provenance.stacItemUrl,
          assetChecksum: input.provenance.assetChecksum,
          assetUpdatedAt: input.provenance.assetUpdatedAt,
          retrievedAt: input.provenance.retrievedAt,
        },
        grid: {
          width,
          height,
          originEastMetres: input.boundsNztm.minimumEast,
          originNorthMetres: input.boundsNztm.minimumNorth,
          cellSizeMetres: 1,
          elevationsMetres: Array.from(
            { length: width * height },
            (_, index) => (index % width) * 0.02,
          ),
        },
      };
    });
    const terrain = createAucklandPropertyTerrainGateway({ readWindow });

    await expect(terrain.assessParcel(parcel)).resolves.toMatchObject({
      status: "measured",
    });
    expect(readWindow).toHaveBeenCalled();
    vi.mocked(readWindow).mock.calls.forEach(([request]) => {
      expect(
        request.boundsNztm.maximumEast - request.boundsNztm.minimumEast,
      ).toBeLessThanOrEqual(100);
      expect(
        request.boundsNztm.maximumNorth - request.boundsNztm.minimumNorth,
      ).toBeLessThanOrEqual(100);
    });
  });

  it("matches one continuous grid when the whole parcel crosses adjacent tiles", async () => {
    const parcel = projectNztmPolygonToWgs84(nztmParcelWithHole());
    const westTile = resolvedTile("west", nztmRectangle(0, -100, 100, 100));
    const eastTile = resolvedTile("east", nztmRectangle(100, -100, 200, 100));
    const continuousTile = resolvedTile(
      "continuous",
      nztmRectangle(0, -100, 200, 100),
    );
    const maskedElevation = (east: number, north: number) => {
      const outsideParcel =
        east < 96 ||
        east >= 104 ||
        north < 0 ||
        north >= 10 ||
        (north >= 8 && east < 101);
      const insideHole = east >= 99 && east < 101 && north >= 3 && north < 7;
      return outsideParcel || insideHole ? 10_000 : east * 0.1 + north * 0.2;
    };
    const crossTileReader = planarWindowReader(maskedElevation);
    const continuousReader = planarWindowReader(maskedElevation);
    const crossTileTerrain = createAucklandPropertyTerrainGateway({
      readWindow: crossTileReader,
      resolveTiles: () => ({
        status: "resolved",
        tiles: [eastTile, westTile],
      }),
    });
    const continuousTerrain = createAucklandPropertyTerrainGateway({
      readWindow: continuousReader,
      resolveTiles: () => ({
        status: "resolved",
        tiles: [continuousTile],
      }),
    });

    const crossTileResult = await crossTileTerrain.assessParcel(parcel);
    const continuousResult = await continuousTerrain.assessParcel(parcel);

    expect(crossTileResult).toMatchObject({
      ...continuousResult,
      status: "measured",
      averageSlopeDegrees: expect.closeTo(12.604382648, 6),
      estimatedFallMetres: expect.closeTo(2.8, 6),
      downhillDirection: "SW",
      source: {
        contributingAssets: [
          expect.objectContaining({
            dataset: validatedProvenance.dataset,
            datasetIdentifier: validatedProvenance.datasetIdentifier,
            stacCollectionUrl: validatedProvenance.stacCollectionUrl,
            assetUrl: "west.tiff",
            stacItemUrl: "west.json",
            assetChecksum: `1220${"west".padEnd(64, "a")}`,
            assetUpdatedAt: "2026-01-13T21:29:07Z",
            boundsNztm: expect.any(Object),
          }),
          expect.objectContaining({
            dataset: validatedProvenance.dataset,
            datasetIdentifier: validatedProvenance.datasetIdentifier,
            stacCollectionUrl: validatedProvenance.stacCollectionUrl,
            assetUrl: "east.tiff",
            stacItemUrl: "east.json",
            assetChecksum: `1220${"east".padEnd(64, "a")}`,
            assetUpdatedAt: "2026-01-13T21:29:07Z",
            boundsNztm: expect.any(Object),
          }),
        ],
      },
    });
    const [westRequest] = vi.mocked(crossTileReader).mock.calls[0];
    const [eastRequest] = vi.mocked(crossTileReader).mock.calls[1];
    expect(westRequest.assetUrl).toBe("west.tiff");
    expect(eastRequest.assetUrl).toBe("east.tiff");
    expect(westRequest.boundsNztm.maximumEast).toBe(
      eastRequest.boundsNztm.minimumEast,
    );
    expect(westRequest.boundsNztm.minimumNorth).toBe(
      eastRequest.boundsNztm.minimumNorth,
    );
    expect(westRequest.boundsNztm.maximumNorth).toBe(
      eastRequest.boundsNztm.maximumNorth,
    );
  });

  it("shares one bounded transfer budget across every contributing asset", async () => {
    const parcel = projectNztmPolygonToWgs84(nztmRectangle(98, 1, 102, 6));
    const tiles = [
      resolvedTile("west", nztmRectangle(0, -100, 100, 100)),
      resolvedTile("east", nztmRectangle(100, -100, 200, 100)),
    ];
    const observedBudgets: unknown[] = [];
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      const transferBudget = (
        input as typeof input & {
          transferBudget?: { remainingBytes: number };
        }
      ).transferBudget;
      observedBudgets.push(transferBudget);
      if (!transferBudget) {
        return {
          status: "needs_checking" as const,
          reasons: ["No shared transfer budget."],
        };
      }
      return planarWindowReader()(input);
    });
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTiles: () => ({ status: "resolved", tiles }),
    });

    await expect(terrain.assessParcel(parcel)).resolves.toMatchObject({
      status: "measured",
    });
    expect(observedBudgets).toHaveLength(2);
    expect(observedBudgets[0]).toBe(observedBudgets[1]);
  });

  it("returns Needs Checking when adjacent assets exhaust the aggregate transfer budget", async () => {
    const parcel = projectNztmPolygonToWgs84(nztmRectangle(98, 1, 102, 6));
    const reader = planarWindowReader();
    const observedBudgets: Array<{ remainingBytes: number }> = [];
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      if (!input.transferBudget) {
        return {
          status: "needs_checking" as const,
          reasons: ["The Auckland elevation response is too large."],
        };
      }
      observedBudgets.push(input.transferBudget);
      if (
        observedBudgets.length === 2 &&
        input.transferBudget.remainingBytes === 0
      ) {
        return {
          status: "needs_checking" as const,
          reasons: ["The Auckland elevation response is too large."],
        };
      }
      const result = await reader(input);
      input.transferBudget.remainingBytes = 0;
      return result;
    });
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTiles: () => ({
        status: "resolved",
        tiles: [
          resolvedTile("west", nztmRectangle(0, -100, 100, 100)),
          resolvedTile("east", nztmRectangle(100, -100, 200, 100)),
        ],
      }),
    });

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation response is too large."],
    });
    expect(observedBudgets).toHaveLength(2);
    expect(observedBudgets[0]).toBe(observedBudgets[1]);
  });

  it("returns Needs Checking before reads when the composed cell limit is exceeded", async () => {
    const readWindow: AucklandTerrainWindowReader = vi.fn();
    const parcel = projectNztmPolygonToWgs84(
      nztmRectangle(1_743_000, 5_919_000, 1_743_101, 5_919_020),
    );
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTiles: () => ({
        status: "resolved",
        tiles: [
          resolvedTile(
            "large",
            nztmRectangle(1_742_900, 5_918_900, 1_743_200, 5_919_200),
          ),
        ],
      }),
    });

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation response is too large."],
    });
    expect(readWindow).not.toHaveBeenCalled();
  });

  it("returns Needs Checking when a required adjacent tile is missing", async () => {
    const parcel = projectNztmPolygonToWgs84(nztmRectangle(98, 1, 102, 6));
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow: planarWindowReader(),
      resolveTiles: () => ({
        status: "resolved",
        tiles: [resolvedTile("west", nztmRectangle(0, -100, 100, 100))],
      }),
    });

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: [
        "Complete Auckland elevation coverage is unavailable for this property.",
      ],
    });
  });

  it("returns Needs Checking for shifted adjacent grid metadata", async () => {
    const parcel = projectNztmPolygonToWgs84(nztmRectangle(98, 1, 102, 6));
    const reader = planarWindowReader();
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      const result = await reader(input);
      if (result.status !== "available" || input.assetUrl !== "east.tiff") {
        return result;
      }
      return {
        ...result,
        grid: {
          ...result.grid,
          originEastMetres: result.grid.originEastMetres + 1,
        },
      };
    });
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTiles: () => ({
        status: "resolved",
        tiles: [
          resolvedTile("west", nztmRectangle(0, -100, 100, 100)),
          resolvedTile("east", nztmRectangle(100, -100, 200, 100)),
        ],
      }),
    });

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: ["The Auckland elevation tiles use inconsistent grid metadata."],
    });
  });

  it("returns Needs Checking when any contributing window contains no-data", async () => {
    const parcel = projectNztmPolygonToWgs84(nztmRectangle(98, 1, 102, 6));
    const reader = planarWindowReader();
    const readWindow: AucklandTerrainWindowReader = vi.fn(async (input) => {
      const result = await reader(input);
      if (result.status !== "available" || input.assetUrl !== "east.tiff") {
        return result;
      }
      return {
        ...result,
        grid: {
          ...result.grid,
          elevationsMetres: result.grid.elevationsMetres.map((value, index) =>
            index === 0 ? Number.NaN : value,
          ),
        },
      };
    });
    const terrain = createAucklandPropertyTerrainGateway({
      readWindow,
      resolveTiles: () => ({
        status: "resolved",
        tiles: [
          resolvedTile("west", nztmRectangle(0, -100, 100, 100)),
          resolvedTile("east", nztmRectangle(100, -100, 200, 100)),
        ],
      }),
    });

    await expect(terrain.assessParcel(parcel)).resolves.toEqual({
      status: "needs_checking",
      reasons: [
        "Complete Auckland elevation coverage is unavailable for this property.",
      ],
    });
  });

  it("resolves both authoritative assets for the known Sheehan Road boundary parcel", async () => {
    const readWindow = planarWindowReader();
    const terrain = createAucklandPropertyTerrainGateway({ readWindow });

    const result = await terrain.assessParcel(
      KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL.geometry,
    );

    expect(result).toMatchObject({ status: "measured" });
    expect(
      vi
        .mocked(readWindow)
        .mock.calls.map(([request]) => request.assetUrl.split("/").at(-1)),
    ).toEqual(["BA31_10000_0403.tiff", "BA31_10000_0404.tiff"]);
  });
});

function planarWindowReader(
  elevationAt: (east: number, north: number) => number = (east, north) =>
    east * 0.1 + north * 0.2,
): AucklandTerrainWindowReader {
  return vi.fn(async (input) => {
    const width = input.boundsNztm.maximumEast - input.boundsNztm.minimumEast;
    const height =
      input.boundsNztm.maximumNorth - input.boundsNztm.minimumNorth;
    return {
      status: "available" as const,
      provenance: {
        ...validatedProvenance,
        assetUrl: input.assetUrl,
        stacItemUrl: input.provenance.stacItemUrl,
        assetChecksum: input.provenance.assetChecksum,
        assetUpdatedAt: input.provenance.assetUpdatedAt,
        retrievedAt: input.provenance.retrievedAt,
      },
      grid: {
        width,
        height,
        originEastMetres: input.boundsNztm.minimumEast,
        originNorthMetres: input.boundsNztm.minimumNorth,
        cellSizeMetres: 1,
        elevationsMetres: Array.from({ length: width * height }, (_, index) => {
          const east = input.boundsNztm.minimumEast + (index % width);
          const north =
            input.boundsNztm.minimumNorth + Math.floor(index / width);
          return elevationAt(east, north);
        }),
      },
    };
  });
}

function nztmParcelWithHole(): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [96, 0],
        [104, 0],
        [104, 10],
        [101, 10],
        [101, 8],
        [96, 8],
        [96, 0],
      ],
      nztmRectangle(99, 3, 101, 7).coordinates[0],
    ],
  };
}

function resolvedTile(
  id: string,
  nztmGeometry: Polygon,
): ResolvedAucklandDemTile {
  return {
    status: "resolved",
    assetUrl: `${id}.tiff`,
    wgs84Geometry: projectNztmPolygonToWgs84(nztmGeometry),
    provenance: {
      stacItemUrl: `${id}.json`,
      assetChecksum: `1220${id.padEnd(64, "a").slice(0, 64)}`,
      assetUpdatedAt: "2026-01-13T21:29:07Z",
      horizontalCrs: "EPSG:2193",
      horizontalUnit: "metre",
      verticalDatum: "NZVD2016",
      elevationUnit: "metre",
      gridResolutionMetres: 1,
      licence: "Creative Commons Attribution 4.0 International",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: validatedProvenance.attribution,
    },
  };
}

function nztmRectangle(
  minimumEast: number,
  minimumNorth: number,
  maximumEast: number,
  maximumNorth: number,
): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minimumEast, minimumNorth],
        [maximumEast, minimumNorth],
        [maximumEast, maximumNorth],
        [minimumEast, maximumNorth],
        [minimumEast, minimumNorth],
      ],
    ],
  };
}

function interpolate(
  start: readonly [number, number],
  end: readonly [number, number],
  fraction: number,
): [number, number] {
  return [
    start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction,
  ];
}
