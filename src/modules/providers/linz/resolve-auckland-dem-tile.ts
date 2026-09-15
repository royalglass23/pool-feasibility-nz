import "server-only";

import { booleanIntersects, booleanWithin } from "@turf/turf";
import type { Polygon } from "geojson";
import {
  AUCKLAND_DEM_DATASETS,
  AUCKLAND_DEM_SOURCE,
  isAucklandDemIsoTimestamp,
  matchesAucklandDemRequiredMetadata,
  type AucklandDemRequiredMetadata,
} from "@/modules/providers/linz/auckland-dem-source-contract";
import type { AucklandDemSourceMetadata } from "@/modules/providers/linz/read-auckland-dem-window";

export type AucklandDemTileCatalogue = AucklandDemRequiredMetadata & {
  readonly source: typeof AUCKLAND_DEM_SOURCE;
  readonly sourceUpdatedAt: string;
  readonly tiles: readonly AucklandDemTileCatalogueEntry[];
};

export type AucklandDemTileCatalogueEntry = {
  readonly id: string;
  readonly collectionUrl: string;
  readonly stacItemUrl: string;
  readonly assetUrl: string;
  readonly assetChecksum: string;
  readonly assetUpdatedAt: string;
  readonly wgs84Geometry: Polygon;
};

export type ResolvedAucklandDemTile = {
  status: "resolved";
  assetUrl: string;
  wgs84Geometry: Polygon;
  provenance: Omit<AucklandDemSourceMetadata, "retrievedAt">;
};

export type AucklandDemTilesResolution =
  | { status: "resolved"; tiles: readonly ResolvedAucklandDemTile[] }
  | { status: "invalid_catalogue" }
  | { status: "no_coverage" };

export type AucklandDemTileResolution =
  | ResolvedAucklandDemTile
  | { status: "invalid_catalogue" }
  | { status: "tile_boundary" }
  | { status: "no_coverage" };

export function resolveAucklandDemTile(input: {
  parcelGeometry: Polygon;
  catalogue: AucklandDemTileCatalogue;
}): AucklandDemTileResolution {
  if (!isAucklandDemTileCatalogue(input.catalogue)) {
    return { status: "invalid_catalogue" };
  }

  const tile = input.catalogue.tiles.find((candidate) =>
    booleanWithin(input.parcelGeometry, candidate.wgs84Geometry),
  );
  if (!tile) {
    const intersectingTileCount = input.catalogue.tiles.filter((candidate) =>
      booleanIntersects(input.parcelGeometry, candidate.wgs84Geometry),
    ).length;
    return {
      status: intersectingTileCount > 1 ? "tile_boundary" : "no_coverage",
    };
  }

  return {
    ...resolvedTile(tile, input.catalogue),
  };
}

export function resolveAucklandDemTiles(input: {
  analysisGeometry: Polygon;
  catalogue: AucklandDemTileCatalogue;
}): AucklandDemTilesResolution {
  if (!isAucklandDemTileCatalogue(input.catalogue)) {
    return { status: "invalid_catalogue" };
  }

  const tiles = input.catalogue.tiles
    .filter((candidate) =>
      booleanIntersects(input.analysisGeometry, candidate.wgs84Geometry),
    )
    .sort(compareTilePosition)
    .map((tile) => resolvedTile(tile, input.catalogue));

  return tiles.length > 0
    ? { status: "resolved", tiles }
    : { status: "no_coverage" };
}

function resolvedTile(
  tile: AucklandDemTileCatalogueEntry,
  catalogue: AucklandDemTileCatalogue,
): ResolvedAucklandDemTile {
  return {
    status: "resolved",
    assetUrl: tile.assetUrl,
    wgs84Geometry: tile.wgs84Geometry,
    provenance: {
      stacItemUrl: tile.stacItemUrl,
      assetChecksum: tile.assetChecksum,
      assetUpdatedAt: tile.assetUpdatedAt,
      horizontalCrs: catalogue.horizontalCrs,
      horizontalUnit: catalogue.horizontalUnit,
      verticalDatum: catalogue.verticalDatum,
      elevationUnit: catalogue.elevationUnit,
      gridResolutionMetres: catalogue.gridResolutionMetres,
      licence: catalogue.licence,
      licenceUrl: catalogue.licenceUrl,
      attribution: { ...catalogue.attribution },
    },
  };
}

function compareTilePosition(
  left: AucklandDemTileCatalogueEntry,
  right: AucklandDemTileCatalogueEntry,
): number {
  const leftPositions = left.wgs84Geometry.coordinates.flat();
  const rightPositions = right.wgs84Geometry.coordinates.flat();
  const leftWest = Math.min(...leftPositions.map(([longitude]) => longitude));
  const rightWest = Math.min(...rightPositions.map(([longitude]) => longitude));
  const leftSouth = Math.min(...leftPositions.map(([, latitude]) => latitude));
  const rightSouth = Math.min(
    ...rightPositions.map(([, latitude]) => latitude),
  );
  return (
    leftSouth - rightSouth ||
    leftWest - rightWest ||
    left.id.localeCompare(right.id)
  );
}

export function isAucklandDemTileCatalogue(
  value: unknown,
): value is AucklandDemTileCatalogue {
  const catalogue = asRecord(value);
  const tiles = catalogue?.tiles;
  return (
    catalogue?.source === AUCKLAND_DEM_SOURCE &&
    typeof catalogue.sourceUpdatedAt === "string" &&
    isAucklandDemIsoTimestamp(catalogue.sourceUpdatedAt) &&
    Array.isArray(tiles) &&
    tiles.length > 0 &&
    matchesAucklandDemRequiredMetadata(catalogue) &&
    tiles.every(isValidCatalogueEntry)
  );
}

function isValidCatalogueEntry(
  value: unknown,
): value is AucklandDemTileCatalogueEntry {
  const entry = asRecord(value);
  if (!entry) return false;
  const dataset = AUCKLAND_DEM_DATASETS.find(
    ({ collectionUrl }) => collectionUrl === entry.collectionUrl,
  );
  if (
    !dataset ||
    typeof entry.id !== "string" ||
    !/^[A-Z]{2}\d{2}_10000_\d{4}$/.test(entry.id)
  ) {
    return false;
  }
  const itemBase = `${dataset.collectionUrl.slice(0, -"collection.json".length)}${entry.id}`;
  return (
    entry.stacItemUrl === `${itemBase}.json` &&
    entry.assetUrl === `${itemBase}.tiff` &&
    typeof entry.assetChecksum === "string" &&
    /^1220[0-9a-f]{64}$/i.test(entry.assetChecksum) &&
    typeof entry.assetUpdatedAt === "string" &&
    isAucklandDemIsoTimestamp(entry.assetUpdatedAt) &&
    isValidPolygon(entry.wgs84Geometry)
  );
}

function isValidPolygon(value: unknown): value is Polygon {
  const polygon = asRecord(value);
  return (
    polygon?.type === "Polygon" &&
    Array.isArray(polygon.coordinates) &&
    polygon.coordinates.length > 0 &&
    polygon.coordinates.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.length >= 4 &&
        ring.every(
          (position) =>
            Array.isArray(position) &&
            position.length >= 2 &&
            Number.isFinite(position[0]) &&
            Number.isFinite(position[1]) &&
            position[0] >= -180 &&
            position[0] <= 180 &&
            position[1] >= -90 &&
            position[1] <= 90,
        ) &&
        ring[0][0] === ring.at(-1)?.[0] &&
        ring[0][1] === ring.at(-1)?.[1],
    )
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
