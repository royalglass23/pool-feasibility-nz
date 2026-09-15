import { describe, expect, it, vi } from "vitest";
import type { Polygon } from "geojson";
import {
  resolveAucklandDemTile,
  type AucklandDemTileCatalogue,
} from "@/modules/providers/linz/resolve-auckland-dem-tile";

vi.mock("server-only", () => ({}));

const checksum = `1220${"a".repeat(64)}`;

describe("Auckland DEM tile resolver", () => {
  it("selects the authoritative tile that wholly contains a parcel outside BA31", () => {
    const catalogue = catalogueWith([
      tile("BA31_10000_0403", rectangle(174.58, -36.89, 174.65, -36.81)),
      tile("BA33_10000_0303", rectangle(175.12, -36.81, 175.18, -36.74)),
    ]);
    const parcel = rectangle(175.14, -36.79, 175.15, -36.78);

    expect(
      resolveAucklandDemTile({ parcelGeometry: parcel, catalogue }),
    ).toMatchObject({
      status: "resolved",
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/BA33_10000_0303.tiff",
      provenance: {
        stacItemUrl:
          "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/BA33_10000_0303.json",
        assetChecksum: checksum,
        assetUpdatedAt: "2026-01-13T21:29:07Z",
        horizontalCrs: "EPSG:2193",
        horizontalUnit: "metre",
        verticalDatum: "NZVD2016",
        elevationUnit: "metre",
        gridResolutionMetres: 1,
        licence: "Creative Commons Attribution 4.0 International",
        licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
        attribution: {
          text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
          url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
        },
      },
    });
  });

  it("rejects a covering catalogue record with invalid authoritative metadata", () => {
    const invalid = tile(
      "BA33_10000_0303",
      rectangle(175.12, -36.81, 175.18, -36.74),
    );
    invalid.stacItemUrl = "https://example.test/BA33_10000_0303.json";
    const catalogue = catalogueWith([invalid]);

    expect(
      resolveAucklandDemTile({
        parcelGeometry: rectangle(175.14, -36.79, 175.15, -36.78),
        catalogue,
      }),
    ).toEqual({ status: "invalid_catalogue" });
  });

  it("accepts a parcel whose boundary lies exactly on a supported tile edge", () => {
    const catalogue = catalogueWith([
      tile("BA33_10000_0303", rectangle(175.12, -36.81, 175.18, -36.74)),
    ]);

    expect(
      resolveAucklandDemTile({
        parcelGeometry: rectangle(175.12, -36.79, 175.14, -36.78),
        catalogue,
      }),
    ).toMatchObject({
      status: "resolved",
      assetUrl: expect.stringContaining("BA33_10000_0303.tiff"),
    });
  });

  it("does not select either tile when a parcel crosses their shared edge", () => {
    const catalogue = catalogueWith([
      tile("BA32_10000_0303", rectangle(175.1, -36.8, 175.14, -36.76)),
      tile("BA33_10000_0303", rectangle(175.14, -36.8, 175.18, -36.76)),
    ]);

    expect(
      resolveAucklandDemTile({
        parcelGeometry: rectangle(175.139, -36.79, 175.141, -36.78),
        catalogue,
      }),
    ).toEqual({ status: "no_coverage" });
  });
});

function catalogueWith(
  tiles: AucklandDemTileCatalogue["tiles"],
): AucklandDemTileCatalogue {
  return {
    source: "LINZ Auckland 2024 DEM STAC",
    sourceUpdatedAt: "2026-01-13T21:29:07Z",
    horizontalCrs: "EPSG:2193",
    horizontalUnit: "metre",
    verticalDatum: "NZVD2016",
    elevationUnit: "metre",
    gridResolutionMetres: 1,
    licence: "Creative Commons Attribution 4.0 International",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: {
      text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
      url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
    },
    tiles,
  } as AucklandDemTileCatalogue;
}

function tile(id: string, wgs84Geometry: Polygon) {
  const dataset = id.startsWith("BA33")
    ? "auckland-part-2_2024"
    : "auckland-part-1_2024";
  const base = `https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/${dataset}/dem_1m/2193/${id}`;
  return {
    id,
    collectionUrl: `${base.slice(0, base.lastIndexOf("/") + 1)}collection.json`,
    stacItemUrl: `${base}.json`,
    assetUrl: `${base}.tiff`,
    assetChecksum: checksum,
    assetUpdatedAt: "2026-01-13T21:29:07Z",
    wgs84Geometry,
  };
}

function rectangle(
  minimumLongitude: number,
  minimumLatitude: number,
  maximumLongitude: number,
  maximumLatitude: number,
): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minimumLongitude, minimumLatitude],
        [maximumLongitude, minimumLatitude],
        [maximumLongitude, maximumLatitude],
        [minimumLongitude, maximumLatitude],
        [minimumLongitude, minimumLatitude],
      ],
    ],
  };
}
