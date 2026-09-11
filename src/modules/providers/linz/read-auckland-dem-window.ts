import "server-only";

import {
  fromCustomClient,
  type BaseClient,
  type BaseResponse,
  type BlockedSourceOptions,
  type GeoTIFFImage,
  type RemoteSourceOptions,
} from "geotiff";
import type { DatasetEvidence } from "@/modules/data-access-spike/data-access-gateway";
import type { TerrainGrid } from "@/modules/terrain/assess-pool-area-slope";
import {
  BodyLimitError,
  providerRetryCount,
  providerTimeoutMs,
  readResponseBytesWithinLimit,
  runWithProviderConcurrency,
} from "@/shared/http/provider-runtime";

const AUCKLAND_DEM_HOSTS = new Set([
  "nz-elevation.s3-ap-southeast-2.amazonaws.com",
  "nz-elevation.s3.ap-southeast-2.amazonaws.com",
]);
const AUCKLAND_DEM_DATASETS = [
  {
    path: "/auckland/auckland-part-1_2024/dem_1m/2193/",
    dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
    datasetIdentifier:
      "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
    datasetDate: "2024-04-30/2024-06-27",
  },
  {
    path: "/auckland/auckland-part-2_2024/dem_1m/2193/",
    dataset: "Auckland Part 2 LiDAR 1m DEM (2024)",
    datasetIdentifier:
      "https://data.linz.govt.nz/layer/122580-auckland-part-2-lidar-1m-dem-2024/",
    datasetDate: "2024-06-26/2024-11-04",
  },
] as const;
const AUCKLAND_DEM_LICENCE = "Creative Commons Attribution 4.0 International";
const AUCKLAND_DEM_LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";
const AUCKLAND_DEM_ATTRIBUTION = {
  text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
  url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
} as const;
const MAX_WINDOW_METRES = 100;
const MAX_DEM_GRID_CELLS = MAX_WINDOW_METRES * MAX_WINDOW_METRES;
const MAX_DEM_TRANSFER_BYTES = 4_000_000;
const MAX_STAC_METADATA_BYTES = 128_000;
const AUCKLAND_DEM_SOURCE_OPTIONS = {
  allowFullFile: false,
  blockSize: 65_536,
  cacheSize: 32,
} satisfies RemoteSourceOptions & BlockedSourceOptions;

export type AucklandDemSourceMetadata = {
  stacItemUrl: string;
  assetChecksum: string;
  assetUpdatedAt: string;
  retrievedAt: string;
};

export type NztmBounds = {
  minimumEast: number;
  minimumNorth: number;
  maximumEast: number;
  maximumNorth: number;
};

export type AucklandDemProvenance = Pick<
  DatasetEvidence,
  | "provider"
  | "dataset"
  | "datasetIdentifier"
  | "status"
  | "licenceStatus"
  | "evidenceUse"
  | "retrievedAt"
  | "datasetDate"
  | "licence"
  | "attribution"
  | "geometryUsed"
  | "attributesUsed"
  | "evidenceType"
  | "confidence"
> &
  AucklandDemSourceMetadata & {
    stacCollectionUrl: string;
    assetUrl: string;
    licenceUrl: string;
    horizontalCrs: "EPSG:2193";
    horizontalUnit: "metre";
    verticalDatum: "NZVD2016";
    elevationUnit: "metre";
    gridResolutionMetres: 1;
  };

export type AucklandDemWindowResult =
  | {
      status: "available";
      grid: TerrainGrid;
      provenance: AucklandDemProvenance;
    }
  | {
      status: "needs_checking";
      reasons: string[];
    };

export async function readAucklandDemWindow(input: {
  assetUrl: string;
  boundsNztm: NztmBounds;
  provenance: AucklandDemSourceMetadata;
}): Promise<AucklandDemWindowResult> {
  const boundsIssue = validateBounds(input.boundsNztm);
  if (boundsIssue) {
    return { status: "needs_checking", reasons: [boundsIssue] };
  }
  if (!isAllowedAucklandDemAsset(input.assetUrl)) {
    return {
      status: "needs_checking",
      reasons: ["The elevation source is not an approved Auckland DEM asset."],
    };
  }
  const provenance = validatedAucklandDemProvenance(
    input.assetUrl,
    input.provenance,
  );
  if (!provenance) {
    return {
      status: "needs_checking",
      reasons: ["The Auckland elevation provenance is incomplete or invalid."],
    };
  }

  return runWithProviderConcurrency("linz", async () => {
    const transferBudget = { remainingBytes: MAX_DEM_TRANSFER_BYTES };
    const retryCount = providerRetryCount();
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      let tiff: Awaited<ReturnType<typeof fromCustomClient>> | null = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), providerTimeoutMs());
      try {
        if (
          !(await confirmsOfficialStacMetadata(provenance, controller.signal))
        ) {
          return {
            status: "needs_checking",
            reasons: [
              "The Auckland elevation provenance is incomplete or invalid.",
            ],
          };
        }
        tiff = await fromCustomClient(
          createBoundedCogClient(input.assetUrl, transferBudget),
          AUCKLAND_DEM_SOURCE_OPTIONS,
          controller.signal,
        );
        const image = await tiff.getImage();
        const gridGeometry = validatedGridGeometry(image, input.boundsNztm);
        if (!gridGeometry) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation grid metadata is unsupported."],
          };
        }
        const noData = image.getGDALNoData();
        const raster = await tiff.readRasters({
          bbox: toGeoTiffBoundingBox(input.boundsNztm),
          resX: 1,
          resY: 1,
          interleave: true,
          signal: controller.signal,
        });
        const width = raster.width;
        const height = raster.height;
        if (width * height > MAX_DEM_GRID_CELLS) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation response is too large."],
          };
        }
        if (width !== gridGeometry.width || height !== gridGeometry.height) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation grid metadata is unsupported."],
          };
        }
        const values = Array.from(raster as ArrayLike<number>, (value) =>
          noData !== null && value === noData ? Number.NaN : value,
        );
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 1 ||
          height < 1 ||
          values.length !== width * height
        ) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation grid dimensions are invalid."],
          };
        }
        if (!values.some(Number.isFinite)) {
          return {
            status: "needs_checking",
            reasons: ["No valid Auckland elevation data covers this window."],
          };
        }
        if (values.some((value) => !Number.isFinite(value))) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation window contains missing data."],
          };
        }

        return {
          status: "available",
          grid: {
            width,
            height,
            originEastMetres: gridGeometry.originEastMetres,
            originNorthMetres: gridGeometry.originNorthMetres,
            cellSizeMetres: gridGeometry.cellSizeMetres,
            elevationsMetres: reverseRows(values, width, height),
          },
          provenance,
        };
      } catch (error) {
        if (error instanceof BodyLimitError) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation response is too large."],
          };
        }
        if (attempt === retryCount) {
          return {
            status: "needs_checking",
            reasons: ["The Auckland elevation data could not be read."],
          };
        }
      } finally {
        clearTimeout(timeout);
        if (tiff) {
          try {
            await tiff.close();
          } catch {
            // Closing a completed bounded read must not replace its result.
          }
        }
      }
    }

    return {
      status: "needs_checking",
      reasons: ["The Auckland elevation data could not be read."],
    };
  });
}

function createBoundedCogClient(
  assetUrl: string,
  transferBudget: { remainingBytes: number },
): BaseClient {
  let requestQueue = Promise.resolve();

  return {
    url: assetUrl,
    request(options: RequestInit = {}): Promise<BaseResponse> {
      const request = requestQueue.then(async () => {
        const response = await fetch(assetUrl, options);
        const declaredLength = Number(
          response.headers.get("content-length") ?? 0,
        );
        if (declaredLength > transferBudget.remainingBytes) {
          await response.body?.cancel("BODY_TOO_LARGE");
          throw new BodyLimitError("BODY_TOO_LARGE");
        }
        const bytes = await readResponseBytesWithinLimit(
          response,
          transferBudget.remainingBytes,
        );
        transferBudget.remainingBytes -= bytes.byteLength;
        const data = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;

        return {
          get ok() {
            return response.ok;
          },
          get status() {
            return response.status;
          },
          getHeader(headerName: string) {
            return response.headers.get(headerName) ?? undefined;
          },
          async getData() {
            return data;
          },
        } as BaseResponse;
      });
      requestQueue = request.then(
        () => undefined,
        () => undefined,
      );
      return request;
    },
  } as BaseClient;
}

function validateBounds(bounds: NztmBounds): string | null {
  const { minimumEast, minimumNorth, maximumEast, maximumNorth } = bounds;
  if (
    ![minimumEast, minimumNorth, maximumEast, maximumNorth].every(
      Number.isFinite,
    )
  ) {
    return "The elevation window bounds are invalid.";
  }
  const width = maximumEast - minimumEast;
  const height = maximumNorth - minimumNorth;
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_WINDOW_METRES ||
    height > MAX_WINDOW_METRES
  ) {
    return "The elevation window must be between 0 and 100 metres per side.";
  }
  return null;
}

function isAllowedAucklandDemAsset(assetUrl: string): boolean {
  try {
    const url = new URL(assetUrl);
    return (
      url.protocol === "https:" &&
      AUCKLAND_DEM_HOSTS.has(url.hostname) &&
      AUCKLAND_DEM_DATASETS.some(({ path }) => url.pathname.startsWith(path)) &&
      url.pathname.endsWith(".tiff")
    );
  } catch {
    return false;
  }
}

function validatedGridGeometry(
  image: GeoTIFFImage,
  bounds: NztmBounds,
): {
  width: number;
  height: number;
  originEastMetres: number;
  originNorthMetres: number;
  cellSizeMetres: number;
} | null {
  try {
    const geoKeys = image.getGeoKeys();
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const imageBounds = image.getBoundingBox();
    const fileDirectory = image.getFileDirectory();
    if (
      geoKeys?.GTModelTypeGeoKey !== 1 ||
      geoKeys.GTRasterTypeGeoKey !== 1 ||
      geoKeys.ProjectedCSTypeGeoKey !== 2193 ||
      geoKeys.ProjLinearUnitsGeoKey !== 9001 ||
      (geoKeys.VerticalCSTypeGeoKey !== undefined &&
        geoKeys.VerticalCSTypeGeoKey !== 7839) ||
      (geoKeys.VerticalUnitsGeoKey !== undefined &&
        geoKeys.VerticalUnitsGeoKey !== 9001) ||
      resolution[0] !== 1 ||
      resolution[1] !== -1 ||
      resolution[2] !== 0 ||
      origin.length < 2 ||
      !origin.slice(0, 2).every(Number.isFinite) ||
      imageBounds.length !== 4 ||
      !imageBounds.every(Number.isFinite) ||
      fileDirectory.getValue("ModelTransformation") !== undefined ||
      !arrayEquals(fileDirectory.getValue("ModelPixelScale"), [1, 1, 0]) ||
      !isValidTiepoint(fileDirectory.getValue("ModelTiepoint"), origin) ||
      image.getSamplesPerPixel() !== 1 ||
      !arrayEquals(fileDirectory.getValue("SampleFormat"), [3]) ||
      !arrayEquals(fileDirectory.getValue("BitsPerSample"), [32]) ||
      !containsBounds(imageBounds, bounds)
    ) {
      return null;
    }

    const westPixel = Math.round(bounds.minimumEast - origin[0]);
    const eastPixel = Math.round(bounds.maximumEast - origin[0]);
    const northPixel = Math.round((bounds.maximumNorth - origin[1]) / -1);
    const southPixel = Math.round((bounds.minimumNorth - origin[1]) / -1);
    const width = eastPixel - westPixel;
    const height = southPixel - northPixel;
    if (width < 1 || height < 1) return null;

    return {
      width,
      height,
      originEastMetres: origin[0] + westPixel,
      originNorthMetres: origin[1] - southPixel,
      cellSizeMetres: 1,
    };
  } catch {
    return null;
  }
}

function arrayEquals(value: unknown, expected: number[]): boolean {
  return (
    (Array.isArray(value) || ArrayBuffer.isView(value)) &&
    (value as ArrayLike<number>).length === expected.length &&
    Array.from(value as ArrayLike<number>).every(
      (entry, index) => entry === expected[index],
    )
  );
}

function isValidTiepoint(value: unknown, origin: number[]): boolean {
  return (
    (Array.isArray(value) || ArrayBuffer.isView(value)) &&
    (value as ArrayLike<number>).length === 6 &&
    (value as ArrayLike<number>)[0] === 0 &&
    (value as ArrayLike<number>)[1] === 0 &&
    (value as ArrayLike<number>)[2] === 0 &&
    (value as ArrayLike<number>)[3] === origin[0] &&
    (value as ArrayLike<number>)[4] === origin[1]
  );
}

function containsBounds(container: number[], candidate: NztmBounds): boolean {
  return (
    candidate.minimumEast >= container[0] &&
    candidate.minimumNorth >= container[1] &&
    candidate.maximumEast <= container[2] &&
    candidate.maximumNorth <= container[3]
  );
}

function toGeoTiffBoundingBox(
  bounds: NztmBounds,
): [number, number, number, number] {
  return [
    bounds.minimumEast,
    bounds.minimumNorth,
    bounds.maximumEast,
    bounds.maximumNorth,
  ];
}

function validatedAucklandDemProvenance(
  assetUrl: string,
  source: AucklandDemSourceMetadata,
): AucklandDemProvenance | null {
  try {
    const asset = new URL(assetUrl);
    const stacItem = new URL(source.stacItemUrl);
    const dataset = AUCKLAND_DEM_DATASETS.find(({ path }) =>
      asset.pathname.startsWith(path),
    );
    if (!dataset) return null;

    const assetName = asset.pathname.slice(
      dataset.path.length,
      -".tiff".length,
    );
    if (
      stacItem.protocol !== "https:" ||
      !AUCKLAND_DEM_HOSTS.has(stacItem.hostname) ||
      stacItem.pathname !== `${dataset.path}${assetName}.json` ||
      !/^1220[0-9a-f]{64}$/i.test(source.assetChecksum) ||
      !isIsoTimestamp(source.assetUpdatedAt) ||
      !isIsoTimestamp(source.retrievedAt)
    ) {
      return null;
    }

    return {
      provider: "Land Information New Zealand",
      dataset: dataset.dataset,
      datasetIdentifier: dataset.datasetIdentifier,
      status: "success",
      licenceStatus: "permitted",
      evidenceUse: "spike_only",
      retrievedAt: source.retrievedAt,
      datasetDate: dataset.datasetDate,
      licence: AUCKLAND_DEM_LICENCE,
      licenceUrl: AUCKLAND_DEM_LICENCE_URL,
      attribution: { ...AUCKLAND_DEM_ATTRIBUTION },
      geometryUsed: "Bounded 1 m bare-earth elevation grid in NZTM2000",
      attributesUsed: ["elevation_metres"],
      evidenceType: "terrain_elevation_grid",
      confidence: "limited",
      stacCollectionUrl: `${asset.origin}${dataset.path}collection.json`,
      stacItemUrl: stacItem.href,
      assetUrl: asset.href,
      assetChecksum: source.assetChecksum.toLowerCase(),
      assetUpdatedAt: source.assetUpdatedAt,
      horizontalCrs: "EPSG:2193",
      horizontalUnit: "metre",
      verticalDatum: "NZVD2016",
      elevationUnit: "metre",
      gridResolutionMetres: 1,
    };
  } catch {
    return null;
  }
}

function isIsoTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

async function confirmsOfficialStacMetadata(
  provenance: AucklandDemProvenance,
  signal: AbortSignal,
): Promise<boolean> {
  const response = await fetch(provenance.stacItemUrl, {
    headers: { Accept: "application/geo+json, application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`STAC metadata request failed with ${response.status}.`);
  }

  try {
    const bytes = await readResponseBytesWithinLimit(
      response,
      MAX_STAC_METADATA_BYTES,
    );
    const item = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    const assets = record.assets;
    if (!assets || typeof assets !== "object") return false;
    const visual = (assets as Record<string, unknown>).visual;
    if (!visual || typeof visual !== "object") return false;
    const asset = visual as Record<string, unknown>;
    if (
      typeof asset.href !== "string" ||
      typeof asset["file:checksum"] !== "string" ||
      typeof asset.updated !== "string"
    ) {
      return false;
    }

    return (
      new URL(asset.href, provenance.stacItemUrl).href ===
        provenance.assetUrl &&
      asset["file:checksum"].toLowerCase() === provenance.assetChecksum &&
      asset.updated === provenance.assetUpdatedAt
    );
  } catch (error) {
    if (error instanceof BodyLimitError || error instanceof SyntaxError) {
      return false;
    }
    throw error;
  }
}

function reverseRows(
  values: number[],
  width: number,
  height: number,
): number[] {
  const result: number[] = [];
  for (let row = height - 1; row >= 0; row -= 1) {
    result.push(...values.slice(row * width, (row + 1) * width));
  }
  return result;
}
