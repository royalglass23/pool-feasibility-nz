import { describe, expect, it, vi } from "vitest";
import { buildFastPoolGeometry } from "@/modules/data-access-spike/fast-pool-placement";
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
};

describe("Auckland property terrain", () => {
  it("derives indicative slope for a placed construction envelope at 42A Bahari Drive", async () => {
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
    const constructionEnvelope = buildFastPoolGeometry(
      [174.6078758258889, -36.86020104731634],
      8.5,
      5,
    ).geometry;

    const result =
      await terrain.assessConstructionEnvelope(constructionEnvelope);

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
});
