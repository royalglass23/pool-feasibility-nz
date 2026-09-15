import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Polygon } from "geojson";
import { format } from "prettier";
import {
  AUCKLAND_DEM_DATASETS,
  AUCKLAND_DEM_LICENCE_CODE,
  AUCKLAND_DEM_REQUIRED_METADATA,
  AUCKLAND_DEM_SOURCE,
  isAucklandDemIsoTimestamp,
} from "../src/modules/providers/linz/auckland-dem-source-contract";
const OUTPUT_PATH = resolve(
  "src/modules/providers/linz/auckland-dem-tile-catalogue.json",
);
const MAX_COLLECTION_BYTES = 128_000;
const MAX_ITEM_BYTES = 128_000;
const MAX_ITEMS_PER_COLLECTION = 500;
const FETCH_CONCURRENCY = 8;

type CatalogueTile = {
  id: string;
  collectionUrl: string;
  stacItemUrl: string;
  assetUrl: string;
  assetChecksum: string;
  assetUpdatedAt: string;
  wgs84Geometry: Polygon;
};

type CatalogueItemReference = {
  url: string;
  checksum: string;
};

async function main(): Promise<void> {
  const tiles: CatalogueTile[] = [];
  const sourceUpdates: string[] = [];

  for (const dataset of AUCKLAND_DEM_DATASETS) {
    const collectionUrl = dataset.collectionUrl;
    const { value: collection } = await fetchJson(
      collectionUrl,
      MAX_COLLECTION_BYTES,
    );
    const validatedCollection = validateCollection(collection, dataset);
    sourceUpdates.push(validatedCollection.updatedAt);
    const collectionTiles = await mapWithConcurrency(
      validatedCollection.items,
      FETCH_CONCURRENCY,
      (itemUrl) => loadTile(itemUrl, collectionUrl),
    );
    tiles.push(
      ...collectionTiles.sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  const sourceUpdatedAt = tiles
    .map(({ assetUpdatedAt }) => assetUpdatedAt)
    .concat(sourceUpdates)
    .sort()
    .at(-1);
  if (!sourceUpdatedAt || tiles.length === 0) {
    throw new Error("The Auckland DEM catalogue contains no validated tiles.");
  }

  const output = {
    source: AUCKLAND_DEM_SOURCE,
    sourceUpdatedAt,
    ...AUCKLAND_DEM_REQUIRED_METADATA,
    tiles,
  } as const;
  const formatted = await format(JSON.stringify(output), { parser: "json" });
  await writeFile(OUTPUT_PATH, formatted, "utf8");
  console.log(
    JSON.stringify({
      outputPath: OUTPUT_PATH,
      sourceUpdatedAt,
      tiles: tiles.length,
    }),
  );
}

function validateCollection(
  value: unknown,
  dataset: (typeof AUCKLAND_DEM_DATASETS)[number],
): { updatedAt: string; items: CatalogueItemReference[] } {
  const record = asRecord(value);
  if (
    record?.type !== "Collection" ||
    record.title !== dataset.dataset ||
    record.license !== AUCKLAND_DEM_LICENCE_CODE ||
    record.gsd !== AUCKLAND_DEM_REQUIRED_METADATA.gridResolutionMetres ||
    typeof record.updated !== "string" ||
    !isAucklandDemIsoTimestamp(record.updated) ||
    !hasProviderRole(
      record.providers,
      "Toitū Te Whenua Land Information New Zealand",
      "host",
    ) ||
    !hasProviderRole(
      record.providers,
      "Regional Software Holdings Limited",
      "licensor",
    ) ||
    !Array.isArray(record.links)
  ) {
    throw new Error(
      `Invalid Auckland DEM collection: ${dataset.collectionUrl}`,
    );
  }

  const base = dataset.collectionUrl.slice(0, -"collection.json".length);
  const itemUrls = record.links.flatMap((value) => {
    const link = asRecord(value);
    if (link?.rel !== "item") return [];
    if (
      typeof link.href !== "string" ||
      !/^\.\/[A-Z]{2}\d{2}_10000_\d{4}\.json$/.test(link.href) ||
      typeof link["file:checksum"] !== "string" ||
      !/^1220[0-9a-f]{64}$/i.test(link["file:checksum"])
    ) {
      throw new Error(
        `Invalid Auckland DEM item link in ${dataset.collectionUrl}`,
      );
    }
    return [
      {
        url: `${base}${link.href.slice(2)}`,
        checksum: link["file:checksum"].toLowerCase(),
      },
    ];
  });

  if (itemUrls.length < 1 || itemUrls.length > MAX_ITEMS_PER_COLLECTION) {
    throw new Error(
      `Unexpected Auckland DEM item count in ${dataset.collectionUrl}`,
    );
  }
  return { updatedAt: record.updated, items: itemUrls };
}

async function loadTile(
  reference: CatalogueItemReference,
  collectionUrl: string,
): Promise<CatalogueTile> {
  const { value, bytes } = await fetchJson(reference.url, MAX_ITEM_BYTES);
  const stacItemUrl = reference.url;
  const itemChecksum = `1220${createHash("sha256").update(bytes).digest("hex")}`;
  if (itemChecksum !== reference.checksum) {
    throw new Error(`Auckland DEM item checksum mismatch: ${stacItemUrl}`);
  }
  const item = asRecord(value);
  const properties = asRecord(item?.properties);
  const assets = asRecord(item?.assets);
  const visual = asRecord(assets?.visual);
  const id = item?.id;
  const geometry = item?.geometry;
  if (
    item?.type !== "Feature" ||
    typeof id !== "string" ||
    !/^[A-Z]{2}\d{2}_10000_\d{4}$/.test(id) ||
    stacItemUrl !==
      `${collectionUrl.slice(0, -"collection.json".length)}${id}.json` ||
    !isPolygon(geometry) ||
    typeof properties?.updated !== "string" ||
    !isAucklandDemIsoTimestamp(properties.updated) ||
    typeof visual?.href !== "string" ||
    visual.href !== `./${id}.tiff` ||
    typeof visual["file:checksum"] !== "string" ||
    !/^1220[0-9a-f]{64}$/i.test(visual["file:checksum"]) ||
    visual.updated !== properties.updated ||
    visual.type !== "image/tiff; application=geotiff; profile=cloud-optimized"
  ) {
    throw new Error(`Invalid Auckland DEM STAC item: ${stacItemUrl}`);
  }

  return {
    id,
    collectionUrl,
    stacItemUrl,
    assetUrl: new URL(visual.href, stacItemUrl).href,
    assetChecksum: visual["file:checksum"].toLowerCase(),
    assetUpdatedAt: properties.updated,
    wgs84Geometry: geometry,
  };
}

async function fetchJson(
  url: string,
  byteLimit: number,
): Promise<{ value: unknown; bytes: Uint8Array }> {
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Auckland DEM catalogue request failed with ${response.status}.`,
    );
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > byteLimit) {
    throw new Error(
      `Auckland DEM catalogue response exceeded ${byteLimit} bytes.`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > byteLimit) {
    throw new Error(
      `Auckland DEM catalogue response exceeded ${byteLimit} bytes.`,
    );
  }
  return {
    value: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    bytes,
  };
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  map: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await map(values[index]);
      }
    }),
  );
  return results;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function hasProviderRole(value: unknown, name: string, role: string): boolean {
  return (
    Array.isArray(value) &&
    value.some((candidate) => {
      const provider = asRecord(candidate);
      return (
        provider?.name === name &&
        Array.isArray(provider.roles) &&
        provider.roles.includes(role)
      );
    })
  );
}

function isPolygon(value: unknown): value is Polygon {
  const record = asRecord(value);
  return (
    record?.type === "Polygon" &&
    Array.isArray(record.coordinates) &&
    record.coordinates.length > 0 &&
    record.coordinates.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.length >= 4 &&
        ring.every(
          (position) =>
            Array.isArray(position) &&
            position.length >= 2 &&
            position.every(Number.isFinite),
        ) &&
        ring[0][0] === ring.at(-1)?.[0] &&
        ring[0][1] === ring.at(-1)?.[1],
    )
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Catalogue generation failed.",
  );
  process.exitCode = 1;
});
