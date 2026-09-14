import "server-only";

import type { Polygon } from "geojson";
import { projectWgs84PolygonToNztm } from "@/modules/providers/linz/project-auckland-dem-geometry";
import {
  readAucklandDemWindow,
  type AucklandDemProvenance,
  type NztmBounds,
} from "@/modules/providers/linz/read-auckland-dem-window";
import {
  assessPoolAreaSlope,
  type TerrainGrid,
} from "@/modules/terrain/assess-pool-area-slope";
import type {
  PropertyTerrainAssessment,
  PropertyTerrainGateway,
} from "@/modules/terrain/property-terrain";

const ANALYSIS_PADDING_METRES = 2;

const INITIAL_AUCKLAND_DEM_TILES = [
  {
    wgs84Bounds: {
      minimumLongitude: 174.5875572,
      minimumLatitude: -36.8805497,
      maximumLongitude: 174.6427408,
      maximumLatitude: -36.8149387,
    },
    assetUrl:
      "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA31_10000_0403.tiff",
    stacItemUrl:
      "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA31_10000_0403.json",
    assetChecksum:
      "1220fdcdf61368d526ac00a461863c6402921595f9cc43d8f05020b5f49431dd1dbf",
    assetUpdatedAt: "2026-01-13T03:02:19Z",
  },
] as const;

export type AucklandTerrainWindowReader = (input: {
  assetUrl: string;
  boundsNztm: NztmBounds;
  provenance: {
    stacItemUrl: string;
    assetChecksum: string;
    assetUpdatedAt: string;
    retrievedAt: string;
  };
}) => Promise<
  | {
      status: "available";
      grid: TerrainGrid;
      provenance: AucklandDemProvenance;
    }
  | { status: "needs_checking"; reasons: string[] }
>;

export function createAucklandPropertyTerrainGateway(
  input: {
    readWindow?: AucklandTerrainWindowReader;
    now?: () => Date;
  } = {},
): PropertyTerrainGateway {
  const readWindow = input.readWindow ?? readAucklandDemWindow;

  return {
    async assessParcel(
      parcelGeometry: Polygon,
    ): Promise<PropertyTerrainAssessment> {
      const tile = INITIAL_AUCKLAND_DEM_TILES.find((candidate) =>
        polygonIsWithinBounds(parcelGeometry, candidate.wgs84Bounds),
      );
      if (!tile) {
        return {
          status: "needs_checking",
          reasons: [
            "The mapped property parcel is outside the currently indexed Auckland 2024 elevation tile.",
          ],
        };
      }

      try {
        const footprint = projectWgs84PolygonToNztm(parcelGeometry);
        const boundsNztm = paddedIntegerBounds(footprint);
        const window = await readWindow({
          assetUrl: tile.assetUrl,
          boundsNztm,
          provenance: {
            stacItemUrl: tile.stacItemUrl,
            assetChecksum: tile.assetChecksum,
            assetUpdatedAt: tile.assetUpdatedAt,
            retrievedAt: (input.now?.() ?? new Date()).toISOString(),
          },
        });
        if (window.status === "needs_checking") return window;

        const slope = assessPoolAreaSlope({ grid: window.grid, footprint });
        if (slope.status === "needs_checking") return slope;
        return {
          ...slope,
          source: window.provenance,
        };
      } catch {
        return {
          status: "needs_checking",
          reasons: ["The Auckland elevation data could not be assessed."],
        };
      }
    },
  };
}

function polygonIsWithinBounds(
  polygon: Polygon,
  bounds: (typeof INITIAL_AUCKLAND_DEM_TILES)[number]["wgs84Bounds"],
): boolean {
  return polygon.coordinates
    .flat()
    .every(
      ([longitude, latitude]) =>
        longitude >= bounds.minimumLongitude &&
        longitude <= bounds.maximumLongitude &&
        latitude >= bounds.minimumLatitude &&
        latitude <= bounds.maximumLatitude,
    );
}

function paddedIntegerBounds(polygon: Polygon): NztmBounds {
  const positions = polygon.coordinates.flat();
  const eastings = positions.map(([east]) => east);
  const northings = positions.map(([, north]) => north);
  return {
    minimumEast: Math.floor(Math.min(...eastings)) - ANALYSIS_PADDING_METRES,
    minimumNorth: Math.floor(Math.min(...northings)) - ANALYSIS_PADDING_METRES,
    maximumEast: Math.ceil(Math.max(...eastings)) + ANALYSIS_PADDING_METRES,
    maximumNorth: Math.ceil(Math.max(...northings)) + ANALYSIS_PADDING_METRES,
  };
}
