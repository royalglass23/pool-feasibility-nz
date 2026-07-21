import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import { z } from "zod";
import {
  BodyLimitError,
  fetchProviderBody,
  ProviderFetchError,
  providerTimeoutMs,
} from "@/shared/http/provider-runtime";
import {
  datasetCatalog,
  linzAddressQueryUrl,
  linzAerialStyleUrl,
  linzParcelQueryUrl,
  officialDatasetEvidence,
} from "./official-dataset-catalog";
import type {
  DatasetKey,
  QueryableDatasetKey,
} from "../data-access-spike/dataset-catalog";
import type {
  AddressMatch,
  CountResult,
  DataAccessSpikeGateway,
  DatasetEvidence,
  ParcelMatch,
  ParcelQueryResult,
  Position,
} from "../data-access-spike/data-access-gateway";

const LINZ_AERIAL_ATTRIBUTION_URL =
  "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution";

const linzAerialStyleSchema = z.object({
  sources: z.record(
    z.string(),
    z
      .object({
        type: z.string(),
        attribution: z.string().trim().min(1).optional(),
      })
      .passthrough(),
  ),
});

const longitudeSchema = z.number().min(160).max(180);
const latitudeSchema = z.number().min(-48).max(-33);
const positionSchema = z.tuple([longitudeSchema, latitudeSchema]);
const mappedPositionSchema = z
  .union([
    positionSchema,
    z.tuple([longitudeSchema, latitudeSchema, z.number()]),
    z.tuple([longitudeSchema, latitudeSchema, z.number(), z.number()]),
  ])
  .transform(([longitude, latitude]) => [longitude, latitude] as Position);
const addressCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.object({
          type: z.literal("Point"),
          coordinates: positionSchema,
        }),
        properties: z.object({
          address_id: z.union([z.string(), z.number()]),
          full_address: z.string(),
          full_address_number: z.string(),
          unit: z.string().nullable().optional(),
          territorial_authority: z.string(),
          address_lifecycle: z.string(),
        }),
      }),
    )
    .max(20),
});
const parcelCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.object({
          type: z.literal("Polygon"),
          coordinates: z
            .array(z.array(positionSchema).min(4).max(5_000))
            .min(1)
            .max(100),
        }),
        properties: z.object({
          id: z.union([z.string(), z.number()]),
          appellation: z.string(),
          parcel_intent: z.string(),
          land_district: z.string(),
          titles: z.string().nullable(),
          survey_area: z.number().nullable(),
          calc_area: z.number().nullable(),
        }),
      }),
    )
    .max(20),
});
const mappedGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Point"),
    coordinates: mappedPositionSchema,
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z
      .array(z.array(mappedPositionSchema).min(4).max(5_000))
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("LineString"),
    coordinates: z.array(mappedPositionSchema).min(2).max(5_000),
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z
      .array(
        z
          .array(z.array(mappedPositionSchema).min(4).max(5_000))
          .min(1)
          .max(100),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("MultiLineString"),
    coordinates: z
      .array(z.array(mappedPositionSchema).min(2).max(5_000))
      .min(1)
      .max(100),
  }),
]);
const mappedFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        id: z.union([z.string(), z.number()]).optional(),
        geometry: mappedGeometrySchema,
        properties: z.record(z.string(), z.unknown()),
      }),
    )
    .max(2_000),
});

const allowedOrigins = new Set([
  "https://services.arcgis.com",
  "https://services1.arcgis.com",
  "https://services5.arcgis.com",
  "https://mapspublic.aucklandcouncil.govt.nz",
  "https://basemaps.linz.govt.nz",
]);

export function assertAllowedProviderUrl(url: URL): void {
  if (!allowedOrigins.has(url.origin)) {
    throw new Error("PROVIDER_URL_NOT_ALLOWED");
  }
}

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
    this.#timeoutMs = options.timeoutMs ?? providerTimeoutMs();
    this.#maxResponseBytes = options.maxResponseBytes ?? 2_000_000;
  }

  datasetEvidence(dataset: DatasetKey, retrievedAt: string): DatasetEvidence {
    return officialDatasetEvidence(dataset, retrievedAt);
  }

  async searchAddresses(requestedAddress: string): Promise<AddressMatch[]> {
    const parsed = parseSuppliedStreetAddress(requestedAddress);

    const url = new URL(linzAddressQueryUrl);
    const unitClause = parsed.unit
      ? ` AND unit='${escapeArcGisText(parsed.unit)}'`
      : "";
    url.searchParams.set(
      "where",
      `address_number=${parsed.addressNumber} AND full_road_name='${escapeArcGisText(parsed.fullRoadName)}' AND address_lifecycle='Current'${unitClause}`,
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

    return normalizeAddressResponse(await this.#getJson(url));
  }

  async findParcelsAt([
    longitude,
    latitude,
  ]: Position): Promise<ParcelQueryResult> {
    const url = new URL(linzParcelQueryUrl);
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

    return normalizeParcelResponse(await this.#getJson(url));
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

  async queryFeatures(
    dataset: QueryableDatasetKey,
    envelope: [number, number, number, number],
  ): Promise<
    FeatureCollection<
      Polygon | MultiPolygon | LineString | MultiLineString | Point
    >
  > {
    const entry = datasetCatalog[dataset];
    const url = new URL(entry.queryUrl);
    url.searchParams.set("where", entry.where ?? "1=1");
    url.searchParams.set("geometry", envelope.join(","));
    url.searchParams.set("geometryType", "esriGeometryEnvelope");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("outFields", "*");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("maxAllowableOffset", "0.000001");
    url.searchParams.set("geometryPrecision", "7");
    url.searchParams.set("f", "geojson");

    const response = parseProviderJson(
      mappedFeatureCollectionSchema,
      await this.#getJson(url),
    );
    return {
      type: "FeatureCollection",
      features: response.features.map((feature) => ({
        type: "Feature",
        ...(feature.id === undefined ? {} : { id: String(feature.id) }),
        geometry: feature.geometry,
        properties: feature.properties,
      })),
    };
  }

  async checkAerial(apiKey: string): Promise<{
    durationMs: number;
    attribution: { text: string; url: string };
  }> {
    const startedAt = performance.now();
    const url = new URL(linzAerialStyleUrl);
    url.searchParams.set("api", apiKey);
    const style = linzAerialStyleSchema.safeParse(await this.#getJson(url));
    if (!style.success) {
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }

    const attribution = Object.values(style.data.sources).find(
      (source) => source.type === "raster" && source.attribution,
    )?.attribution;
    if (!attribution) {
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }

    return {
      durationMs: Math.round(performance.now() - startedAt),
      attribution: {
        text: attribution,
        url: LINZ_AERIAL_ATTRIBUTION_URL,
      },
    };
  }

  async #getJson(url: URL): Promise<unknown> {
    assertAllowedProviderUrl(url);

    let result: Awaited<ReturnType<typeof fetchProviderBody>>;
    try {
      result = await fetchProviderBody({
        provider: providerKey(url),
        fetch: this.#fetch,
        url,
        init: {
          headers: { Accept: "application/json, application/geo+json" },
        },
        timeoutMs: this.#timeoutMs,
        maxBytes: this.#maxResponseBytes,
      });
    } catch (error) {
      if (error instanceof ProviderFetchError) {
        throw new Error(error.code);
      }
      if (error instanceof BodyLimitError && error.code === "BODY_TOO_LARGE") {
        throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
      }
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }

    if (!result.response.ok) {
      throw new Error("PROVIDER_HTTP_ERROR");
    }
    if (!result.bytes) {
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }

    try {
      return JSON.parse(new TextDecoder().decode(result.bytes)) as unknown;
    } catch {
      throw new Error("PROVIDER_RESPONSE_INVALID");
    }
  }
}

function parseProviderJson<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    if (result.error.issues.some((issue) => issue.code === "too_big")) {
      throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
    }
    throw new Error("PROVIDER_RESPONSE_INVALID");
  }
  return result.data;
}

export function normalizeAddressResponse(value: unknown): AddressMatch[] {
  const response = parseProviderJson(addressCollectionSchema, value);
  return response.features
    .filter((feature) => feature.properties.address_lifecycle === "Current")
    .map((feature) => ({
      addressId: String(feature.properties.address_id),
      fullAddress: feature.properties.full_address,
      fullAddressNumber: feature.properties.full_address_number,
      unit: feature.properties.unit ?? null,
      territorialAuthority: feature.properties.territorial_authority,
      coordinates: feature.geometry.coordinates,
    }));
}

export function normalizeParcelResponse(value: unknown): ParcelQueryResult {
  const response = parseProviderJson(parcelCollectionSchema, value);
  const byId = new Map<string, ParcelMatch>();
  for (const feature of response.features) {
    const parcelId = String(feature.properties.id);
    if (byId.has(parcelId)) continue;

    byId.set(parcelId, {
      parcelId,
      appellation: feature.properties.appellation,
      parcelIntent: feature.properties.parcel_intent,
      landDistrict: feature.properties.land_district,
      titles: feature.properties.titles
        ? feature.properties.titles.split(",").map((title) => title.trim())
        : [],
      surveyAreaSquareMetres: feature.properties.survey_area,
      calculatedAreaSquareMetres: feature.properties.calc_area,
      geometry: feature.geometry as Polygon,
    });
  }

  return {
    parcels: [...byId.values()],
    duplicatesRemoved: response.features.length - byId.size,
  };
}

function escapeArcGisText(value: string): string {
  return value.replaceAll("'", "''");
}

function providerKey(url: URL): "linz" | "auckland_council" | "watercare" {
  if (
    url.hostname === "services5.arcgis.com" &&
    url.pathname.includes("/PnnKqtqi3qfxnaPc/")
  ) {
    return "watercare";
  }
  return url.hostname.endsWith("aucklandcouncil.govt.nz") ||
    url.hostname === "services1.arcgis.com"
    ? "auckland_council"
    : "linz";
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
