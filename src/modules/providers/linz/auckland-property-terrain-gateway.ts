import "server-only";

import { booleanWithin } from "@turf/turf";
import type { Polygon } from "geojson";
import { aucklandDemTileCatalogue } from "@/modules/providers/linz/auckland-dem-tile-catalogue";
import {
  projectNztmPolygonToWgs84,
  projectNztmPositionToWgs84,
  projectWgs84PolygonToNztm,
} from "@/modules/providers/linz/project-auckland-dem-geometry";
import {
  createAucklandDemTransferBudget,
  type AucklandDemProvenance,
  type AucklandDemSourceMetadata,
  type AucklandDemTransferBudget,
  type NztmBounds,
} from "@/modules/providers/linz/auckland-dem-window-contract";
import {
  resolveAucklandDemTiles,
  type AucklandDemTilesResolution,
  type AucklandDemTileResolution,
  type ResolvedAucklandDemTile,
} from "@/modules/providers/linz/resolve-auckland-dem-tile";
import {
  assessPoolAreaSlope,
  type TerrainGrid,
} from "@/modules/terrain/assess-pool-area-slope";
import { assessSelectedPoolTerrain } from "@/modules/terrain/assess-selected-pool-terrain";
import type {
  PropertyTerrainAssessment,
  PropertyTerrainGateway,
} from "@/modules/terrain/property-terrain";

const ANALYSIS_PADDING_METRES = 2;
const MAX_ANALYSIS_GRID_CELLS = 100 * 100;

type AucklandDemTileResolver = (
  parcelGeometry: Polygon,
) => AucklandDemTileResolution;

type AucklandDemTilesResolver = (
  analysisGeometry: Polygon,
) => AucklandDemTilesResolution;

export type AucklandTerrainWindowReader = (input: {
  assetUrl: string;
  boundsNztm: NztmBounds;
  provenance: AucklandDemSourceMetadata;
  transferBudget?: AucklandDemTransferBudget;
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
    resolveTiles?: AucklandDemTilesResolver;
    now?: () => Date;
  } = {},
): PropertyTerrainGateway {
  const readWindow = input.readWindow ?? readDefaultAucklandDemWindow;
  const resolveTiles = input.resolveTiles;

  return {
    async assessParcel(
      parcelGeometry: Polygon,
      analysisGeometry?: Polygon,
    ): Promise<PropertyTerrainAssessment> {
      try {
        const parcelFootprint = projectWgs84PolygonToNztm(parcelGeometry);
        const footprint = analysisGeometry
          ? projectWgs84PolygonToNztm(analysisGeometry)
          : parcelFootprint;
        if (analysisGeometry && !booleanWithin(footprint, parcelFootprint)) {
          return needsChecking(
            "The proposed pool area is outside the mapped property parcel.",
          );
        }
        const boundsNztm = paddedIntegerBounds(footprint);
        const width = boundsNztm.maximumEast - boundsNztm.minimumEast;
        const height = boundsNztm.maximumNorth - boundsNztm.minimumNorth;
        const resolution = resolveTerrainTiles({
          parcelGeometry,
          analysisGeometry: projectNztmPolygonToWgs84(
            rectangleForBounds(boundsNztm),
          ),
          resolveTile: input.resolveTile,
          resolveTiles,
        });
        if (resolution.status !== "resolved") {
          return needsChecking(
            resolution.status === "invalid_catalogue"
              ? "The Auckland 2024 elevation catalogue metadata is invalid or unavailable."
              : resolution.status === "tile_boundary"
                ? "Terrain data for this property crosses a mapped data boundary and needs further checking."
                : "The mapped property parcel is outside the indexed Auckland 2024 elevation coverage.",
          );
        }
        if (
          width <= 0 ||
          height <= 0 ||
          width > 100 ||
          height > 100 ||
          width * height > MAX_ANALYSIS_GRID_CELLS
        ) {
          return needsChecking("The Auckland elevation response is too large.");
        }

        const composed = await readAndComposeTiles({
          tiles: resolution.tiles,
          analysisBounds: boundsNztm,
          readWindow,
          retrievedAt: (input.now?.() ?? new Date()).toISOString(),
        });
        if (composed.status === "needs_checking") return composed;

        const slope = assessPoolAreaSlope({
          grid: composed.grid,
          footprint,
          ...(analysisGeometry
            ? { areaDescription: "proposed pool area" as const }
            : {}),
        });
        if (slope.status === "needs_checking") return slope;
        const { samples, ...summary } = slope;
        const slopeSamples = samples.map((sample) => {
          const [longitude, latitude] = projectNztmPositionToWgs84([
            sample.eastMetres,
            sample.northMetres,
          ]);
          return {
            position: [roundTo(longitude, 7), roundTo(latitude, 7)] as [
              number,
              number,
            ],
            slopeDegrees: roundTo(sample.slopeDegrees, 2),
            eastGradient: roundTo(sample.eastGradient, 5),
            northGradient: roundTo(sample.northGradient, 5),
          };
        });
        return {
          ...summary,
          slopeSamples,
          ...(analysisGeometry
            ? {
                selectedPool: assessSelectedPoolTerrain({
                  samples: slopeSamples,
                  footprint: analysisGeometry,
                }),
              }
            : {}),
          source: {
            ...composed.provenance[0].provenance,
            contributingAssets: composed.provenance.map(
              ({ provenance, boundsNztm: assetBounds }) => ({
                provider: provenance.provider,
                dataset: provenance.dataset,
                datasetIdentifier: provenance.datasetIdentifier,
                datasetDate: provenance.datasetDate,
                stacCollectionUrl: provenance.stacCollectionUrl,
                assetUrl: provenance.assetUrl,
                stacItemUrl: provenance.stacItemUrl,
                assetChecksum: provenance.assetChecksum,
                assetUpdatedAt: provenance.assetUpdatedAt,
                retrievedAt: provenance.retrievedAt,
                boundsNztm: assetBounds,
              }),
            ),
          },
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

async function readDefaultAucklandDemWindow(
  input: Parameters<AucklandTerrainWindowReader>[0],
): ReturnType<AucklandTerrainWindowReader> {
  const { readAucklandDemWindow } =
    await import("@/modules/providers/linz/read-auckland-dem-window");
  return readAucklandDemWindow(input);
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function resolveTerrainTiles(input: {
  parcelGeometry: Polygon;
  analysisGeometry: Polygon;
  resolveTile?: AucklandDemTileResolver;
  resolveTiles?: AucklandDemTilesResolver;
}):
  | AucklandDemTilesResolution
  | { status: "tile_boundary" }
  | { status: "resolved"; tiles: readonly ResolvedAucklandDemTile[] } {
  if (input.resolveTiles) return input.resolveTiles(input.analysisGeometry);
  if (input.resolveTile) {
    const result = input.resolveTile(input.parcelGeometry);
    return result.status === "resolved"
      ? { status: "resolved", tiles: [result] }
      : result;
  }
  return resolveAucklandDemTiles({
    analysisGeometry: input.analysisGeometry,
    catalogue: aucklandDemTileCatalogue,
  });
}

async function readAndComposeTiles(input: {
  tiles: readonly ResolvedAucklandDemTile[];
  analysisBounds: NztmBounds;
  readWindow: AucklandTerrainWindowReader;
  retrievedAt: string;
}): Promise<
  | {
      status: "available";
      grid: TerrainGrid;
      provenance: Array<{
        provenance: AucklandDemProvenance;
        boundsNztm: NztmBounds;
      }>;
    }
  | { status: "needs_checking"; reasons: string[] }
> {
  const width =
    input.analysisBounds.maximumEast - input.analysisBounds.minimumEast;
  const height =
    input.analysisBounds.maximumNorth - input.analysisBounds.minimumNorth;
  const elevationsMetres = Array.from(
    { length: width * height },
    () => Number.NaN,
  );
  const windows = input.tiles
    .map((tile) => ({
      tile,
      boundsNztm: intersectBounds(
        input.analysisBounds,
        tileIntegerBounds(projectWgs84PolygonToNztm(tile.wgs84Geometry)),
      ),
    }))
    .filter(
      (
        entry,
      ): entry is { tile: ResolvedAucklandDemTile; boundsNztm: NztmBounds } =>
        entry.boundsNztm !== null,
    )
    .sort(
      (left, right) =>
        left.boundsNztm.minimumNorth - right.boundsNztm.minimumNorth ||
        left.boundsNztm.minimumEast - right.boundsNztm.minimumEast ||
        left.tile.assetUrl.localeCompare(right.tile.assetUrl),
    );
  const provenance: Array<{
    provenance: AucklandDemProvenance;
    boundsNztm: NztmBounds;
  }> = [];
  const transferBudget = createAucklandDemTransferBudget();

  for (const windowRequest of windows) {
    const requestedProvenance = {
      ...windowRequest.tile.provenance,
      retrievedAt: input.retrievedAt,
    };
    const window = await input.readWindow({
      assetUrl: windowRequest.tile.assetUrl,
      boundsNztm: windowRequest.boundsNztm,
      provenance: requestedProvenance,
      transferBudget,
    });
    if (window.status === "needs_checking") return window;
    if (
      !windowMatchesRequest(
        window.grid,
        window.provenance,
        windowRequest.tile,
        windowRequest.boundsNztm,
      )
    ) {
      return needsChecking(
        "The Auckland elevation tiles use inconsistent grid metadata.",
      );
    }
    for (let row = 0; row < window.grid.height; row += 1) {
      for (let column = 0; column < window.grid.width; column += 1) {
        const targetColumn =
          window.grid.originEastMetres -
          input.analysisBounds.minimumEast +
          column;
        const targetRow =
          window.grid.originNorthMetres -
          input.analysisBounds.minimumNorth +
          row;
        const targetIndex = targetRow * width + targetColumn;
        if (Number.isFinite(elevationsMetres[targetIndex])) {
          return needsChecking(
            "The Auckland elevation tiles overlap on the analysis grid.",
          );
        }
        elevationsMetres[targetIndex] =
          window.grid.elevationsMetres[row * window.grid.width + column];
      }
    }
    provenance.push({
      provenance: window.provenance,
      boundsNztm: windowRequest.boundsNztm,
    });
  }

  if (
    provenance.length === 0 ||
    elevationsMetres.some((value) => !Number.isFinite(value))
  ) {
    return needsChecking(
      "Complete Auckland elevation coverage is unavailable for this property.",
    );
  }
  return {
    status: "available",
    grid: {
      width,
      height,
      originEastMetres: input.analysisBounds.minimumEast,
      originNorthMetres: input.analysisBounds.minimumNorth,
      cellSizeMetres: 1,
      elevationsMetres,
    },
    provenance,
  };
}

function windowMatchesRequest(
  grid: TerrainGrid,
  provenance: AucklandDemProvenance,
  tile: ResolvedAucklandDemTile,
  bounds: NztmBounds,
): boolean {
  return (
    grid.cellSizeMetres === 1 &&
    grid.originEastMetres === bounds.minimumEast &&
    grid.originNorthMetres === bounds.minimumNorth &&
    grid.width === bounds.maximumEast - bounds.minimumEast &&
    grid.height === bounds.maximumNorth - bounds.minimumNorth &&
    grid.elevationsMetres.length === grid.width * grid.height &&
    provenance.assetUrl === tile.assetUrl &&
    provenance.stacItemUrl === tile.provenance.stacItemUrl &&
    provenance.assetChecksum === tile.provenance.assetChecksum &&
    provenance.assetUpdatedAt === tile.provenance.assetUpdatedAt &&
    provenance.horizontalCrs === tile.provenance.horizontalCrs &&
    provenance.horizontalUnit === tile.provenance.horizontalUnit &&
    provenance.verticalDatum === tile.provenance.verticalDatum &&
    provenance.elevationUnit === tile.provenance.elevationUnit &&
    provenance.gridResolutionMetres === tile.provenance.gridResolutionMetres &&
    provenance.licence === tile.provenance.licence &&
    provenance.licenceUrl === tile.provenance.licenceUrl &&
    provenance.attribution?.text === tile.provenance.attribution.text &&
    provenance.attribution?.url === tile.provenance.attribution.url
  );
}

function intersectBounds(
  left: NztmBounds,
  right: NztmBounds,
): NztmBounds | null {
  const intersection = {
    minimumEast: Math.max(left.minimumEast, right.minimumEast),
    minimumNorth: Math.max(left.minimumNorth, right.minimumNorth),
    maximumEast: Math.min(left.maximumEast, right.maximumEast),
    maximumNorth: Math.min(left.maximumNorth, right.maximumNorth),
  };
  return intersection.minimumEast < intersection.maximumEast &&
    intersection.minimumNorth < intersection.maximumNorth
    ? intersection
    : null;
}

function rectangleForBounds(bounds: NztmBounds): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [bounds.minimumEast, bounds.minimumNorth],
        [bounds.maximumEast, bounds.minimumNorth],
        [bounds.maximumEast, bounds.maximumNorth],
        [bounds.minimumEast, bounds.maximumNorth],
        [bounds.minimumEast, bounds.minimumNorth],
      ],
    ],
  };
}

function needsChecking(reason: string): {
  status: "needs_checking";
  reasons: string[];
} {
  return { status: "needs_checking", reasons: [reason] };
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
