import { describe, expect, it, vi } from "vitest";
import type { Polygon } from "geojson";
import type { AucklandDemProvenance } from "@/modules/providers/linz/read-auckland-dem-window";
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

  it("keeps a bounded analysis window inside the selected tile at its edge", async () => {
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
      if (input.boundsNztm.minimumEast < 1_789_600) {
        return {
          status: "needs_checking" as const,
          reasons: ["The padded window escaped the selected tile."],
        };
      }
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
            (_, index) => (index % width) * 0.02,
          ),
        },
      };
    });
    const terrain = createAucklandPropertyTerrainGateway({ readWindow });

    await expect(terrain.assessParcel(parcel)).resolves.toMatchObject({
      status: "measured",
    });
    expect(readWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        boundsNztm: expect.objectContaining({ minimumEast: 1_789_600 }),
      }),
    );
  });
});

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
