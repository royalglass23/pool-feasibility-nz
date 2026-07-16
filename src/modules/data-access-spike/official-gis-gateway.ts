import { datasetCatalog, type QueryableDatasetKey } from "./dataset-catalog";
import type {
  CountResult,
  DataAccessSpikeGateway,
  Position,
} from "./run-data-access-spike";

const LINZ_ADDRESS_QUERY =
  "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Addresses/FeatureServer/0/query";
const LINZ_PARCEL_QUERY =
  "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query";
const LINZ_AERIAL_STYLE =
  "https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/style/aerial.json";

const allowedOrigins = new Set([
  "https://services.arcgis.com",
  "https://services1.arcgis.com",
  "https://mapspublic.aucklandcouncil.govt.nz",
  "https://basemaps.linz.govt.nz",
]);

const unitSlashAddressPattern =
  /^([\p{L}\p{N}-]+)\s*\/\s*(\d+)[\p{L}]?\s+([^,]+),/iu;
const namedUnitAddressPattern =
  /^unit\s+([\p{L}\p{N}-]+)\s*,\s*(\d+)[\p{L}]?\s+([^,]+),/iu;
const streetAddressPattern = /^(\d+)[\p{L}]?\s+([^,]+),/iu;

export interface OfficialGisGatewayOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class OfficialGisGateway implements DataAccessSpikeGateway {
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;

  constructor(options: OfficialGisGatewayOptions = {}) {
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxResponseBytes = options.maxResponseBytes ?? 2_000_000;
  }

  async searchAddresses(requestedAddress: string): Promise<unknown> {
    const parsed = parseSuppliedStreetAddress(requestedAddress);

    const url = new URL(LINZ_ADDRESS_QUERY);
    const unitClause = parsed.unit
      ? ` AND unit='${escapeArcGisText(parsed.unit)}'`
      : "";
    url.searchParams.set(
      "where",
      `address_number=${parsed.addressNumber} AND full_road_name='${escapeArcGisText(parsed.fullRoadName)}'${unitClause}`,
    );
    url.searchParams.set(
      "outFields",
      [
        "address_id",
        "full_address",
        "full_address_number",
        "unit",
        "address_number",
        "address_number_suffix",
        "full_road_name",
        "road_name",
        "road_name_type",
        "suburb_locality",
        "town_city",
        "territorial_authority",
        "address_lifecycle",
      ].join(","),
    );
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("f", "geojson");

    return this.#getJson(url);
  }

  async findParcelsAt([longitude, latitude]: Position): Promise<unknown> {
    const url = new URL(LINZ_PARCEL_QUERY);
    url.searchParams.set("where", "1=1");
    url.searchParams.set("geometry", `${longitude},${latitude}`);
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set(
      "outFields",
      "id,appellation,parcel_intent,land_district,titles,survey_area,calc_area",
    );
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("f", "geojson");

    return this.#getJson(url);
  }

  async countFeatures(
    dataset: QueryableDatasetKey,
    envelope: [number, number, number, number],
  ): Promise<CountResult> {
    const startedAt = performance.now();
    const entry = datasetCatalog[dataset];
    const url = new URL(entry.queryUrl);
    url.searchParams.set("where", entry.where ?? "1=1");
    url.searchParams.set("geometry", envelope.join(","));
    url.searchParams.set("geometryType", "esriGeometryEnvelope");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("returnCountOnly", "true");
    url.searchParams.set("f", "json");

    const result = await this.#getJson(url);
    if (
      !result ||
      typeof result !== "object" ||
      !("count" in result) ||
      typeof result.count !== "number"
    ) {
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }

    return {
      count: result.count,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  async checkAerial(apiKey: string): Promise<{ durationMs: number }> {
    const startedAt = performance.now();
    const url = new URL(LINZ_AERIAL_STYLE);
    url.searchParams.set("api", apiKey);
    await this.#getJson(url);
    return { durationMs: Math.round(performance.now() - startedAt) };
  }

  async #getJson(url: URL): Promise<unknown> {
    if (!allowedOrigins.has(url.origin)) {
      throw new Error("PROVIDER_URL_NOT_ALLOWED");
    }

    let response: Response;
    try {
      response = await this.#fetch(url, {
        headers: { Accept: "application/json, application/geo+json" },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error("PROVIDER_TIMEOUT");
      }
      throw new Error("PROVIDER_REQUEST_FAILED");
    }

    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > this.#maxResponseBytes) {
      throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
    }

    const body = await readTextWithinLimit(response, this.#maxResponseBytes);

    return JSON.parse(body) as unknown;
  }
}

async function readTextWithinLimit(
  response: Response,
  maxResponseBytes: number,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        await reader.cancel("PROVIDER_RESPONSE_TOO_LARGE");
        throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bodyBytes);
}

function escapeArcGisText(value: string): string {
  return value.replaceAll("'", "''");
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function parseSuppliedStreetAddress(requestedAddress: string): {
  unit?: string;
  addressNumber: number;
  fullRoadName: string;
} {
  const slashUnit = unitSlashAddressPattern.exec(requestedAddress);
  if (slashUnit) {
    return {
      unit: slashUnit[1],
      addressNumber: Number(slashUnit[2]),
      fullRoadName: slashUnit[3].trim(),
    };
  }

  const namedUnit = namedUnitAddressPattern.exec(requestedAddress);
  if (namedUnit) {
    return {
      unit: namedUnit[1],
      addressNumber: Number(namedUnit[2]),
      fullRoadName: namedUnit[3].trim(),
    };
  }

  const streetAddress = streetAddressPattern.exec(requestedAddress);
  if (streetAddress) {
    return {
      addressNumber: Number(streetAddress[1]),
      fullRoadName: streetAddress[2].trim(),
    };
  }

  throw new Error("ADDRESS_FORMAT_UNSUPPORTED");
}
