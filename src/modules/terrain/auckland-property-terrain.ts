import "server-only";

import type { Polygon } from "geojson";
import { aucklandDemTileCatalogue } from "@/modules/providers/linz/auckland-dem-tile-catalogue";
import { projectWgs84PolygonToNztm } from "@/modules/providers/linz/project-auckland-dem-geometry";
import {
  readAucklandDemWindow,
  type AucklandDemProvenance,
  type AucklandDemSourceMetadata,
  type NztmBounds,
} from "@/modules/providers/linz/read-auckland-dem-window";
import {
  resolveAucklandDemTile,
  type AucklandDemTileResolution,
} from "@/modules/providers/linz/resolve-auckland-dem-tile";
import {
  assessPoolAreaSlope,
  type TerrainGrid,
} from "@/modules/terrain/assess-pool-area-slope";
import type {
  PropertyTerrainAssessment,
  PropertyTerrainGateway,
} from "@/modules/terrain/property-terrain";

const ANALYSIS_PADDING_METRES = 2;

type AucklandDemTileResolver = (
  parcelGeometry: Polygon,
) => AucklandDemTileResolution;

export type AucklandTerrainWindowReader = (input: {
  assetUrl: string;
  boundsNztm: NztmBounds;
  provenance: AucklandDemSourceMetadata;
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
    resolveTile?: AucklandDemTileResolver;
    now?: () => Date;
  } = {},
): PropertyTerrainGateway {
  const readWindow = input.readWindow ?? readAucklandDemWindow;
  const resolveTile =
    input.resolveTile ??
    ((parcelGeometry) =>
      resolveAucklandDemTile({
        parcelGeometry,
        catalogue: aucklandDemTileCatalogue,
      }));

  return {
    async assessParcel(
      parcelGeometry: Polygon,
    ): Promise<PropertyTerrainAssessment> {
      const tile = resolveTile(parcelGeometry);
      if (tile.status !== "resolved") {
        return {
          status: "needs_checking",
          reasons: [
            tile.status === "invalid_catalogue"
              ? "The Auckland 2024 elevation catalogue metadata is invalid or unavailable."
              : "The mapped property parcel is outside the indexed Auckland 2024 elevation coverage.",
          ],
        };
      }

      try {
        const footprint = projectWgs84PolygonToNztm(parcelGeometry);
        const tileFootprint = projectWgs84PolygonToNztm(tile.wgs84Geometry);
        const boundsNztm = boundedPaddedIntegerBounds(
          footprint,
          tileIntegerBounds(tileFootprint),
        );
        const window = await readWindow({
          assetUrl: tile.assetUrl,
          boundsNztm,
          provenance: {
            ...tile.provenance,
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

function boundedPaddedIntegerBounds(
  polygon: Polygon,
  limit: NztmBounds,
): NztmBounds {
  const padded = paddedIntegerBounds(polygon);
  return {
    minimumEast: Math.max(padded.minimumEast, limit.minimumEast),
    minimumNorth: Math.max(padded.minimumNorth, limit.minimumNorth),
    maximumEast: Math.min(padded.maximumEast, limit.maximumEast),
    maximumNorth: Math.min(padded.maximumNorth, limit.maximumNorth),
  };
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

function tileIntegerBounds(polygon: Polygon): NztmBounds {
  const positions = polygon.coordinates.flat();
  const eastings = positions.map(([east]) => east);
  const northings = positions.map(([, north]) => north);
  return {
    minimumEast: Math.round(Math.min(...eastings)),
    minimumNorth: Math.round(Math.min(...northings)),
    maximumEast: Math.round(Math.max(...eastings)),
    maximumNorth: Math.round(Math.max(...northings)),
  };
}
