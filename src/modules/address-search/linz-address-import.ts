import { z } from "zod";
import { normalizeAddressQuery } from "@/shared/text/normalize-address-query";
import {
  BodyLimitError,
  fetchProviderBody,
  providerTimeoutMs,
} from "@/shared/http/provider-runtime";

export const linzAddressQueryUrl =
  "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Addresses/FeatureServer/0/query";
const MAX_LINZ_ADDRESS_PAGE_BYTES = 8_000_000;

const pageSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      properties: z.object({
        OBJECTID: z.number().int(),
        address_id: z.union([z.string(), z.number()]),
        full_address: z.string().min(1),
        full_address_ascii: z.string().min(1).optional(),
        full_address_number: z.string().min(1),
        unit: z.string().nullable().optional(),
        territorial_authority: z.string().min(1),
        suburb_locality: z.string().nullable().optional(),
        town_city: z.string().nullable().optional(),
        address_lifecycle: z.string(),
      }),
    }),
  ),
});

export type IndexedLinzAddress = {
  addressId: string;
  sourceObjectId: number;
  fullAddress: string;
  fullAddressNumber: string;
  unit: string | null;
  territorialAuthority: string;
  suburbLocality: string | null;
  townCity: string | null;
  postcode: string | null;
  searchText: string;
  longitude: number;
  latitude: number;
  isCurrent: boolean;
};

export async function fetchAucklandAddressPage(input: {
  afterObjectId: number;
  fetch?: typeof fetch;
}): Promise<IndexedLinzAddress[]> {
  const url = new URL(linzAddressQueryUrl);
  url.searchParams.set(
    "where",
    `territorial_authority='Auckland' AND address_lifecycle='Current' AND OBJECTID>${input.afterObjectId}`,
  );
  url.searchParams.set(
    "outFields",
    "OBJECTID,address_id,full_address,full_address_ascii,full_address_number,unit,territorial_authority,suburb_locality,town_city,address_lifecycle",
  );
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("resultRecordCount", "2000");
  url.searchParams.set("orderByFields", "OBJECTID ASC");
  url.searchParams.set("f", "geojson");

  const page = pageSchema.safeParse(
    await fetchLinzAddressJson(
      url,
      input.fetch ?? fetch,
      "application/geo+json",
    ),
  );
  if (!page.success) throw new Error("LINZ_ADDRESS_IMPORT_INVALID_RESPONSE");
  return page.data.features.map((feature) => ({
    addressId: String(feature.properties.address_id),
    sourceObjectId: feature.properties.OBJECTID,
    fullAddress: feature.properties.full_address,
    fullAddressNumber: feature.properties.full_address_number,
    unit: feature.properties.unit ?? null,
    territorialAuthority: feature.properties.territorial_authority,
    suburbLocality: feature.properties.suburb_locality ?? null,
    townCity: feature.properties.town_city ?? null,
    postcode: null,
    searchText: normalizeAddressQuery(
      `${feature.properties.full_address_ascii ?? feature.properties.full_address} ${feature.properties.suburb_locality ?? ""} ${feature.properties.town_city ?? ""}`,
    ),
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
    isCurrent: feature.properties.address_lifecycle === "Current",
  }));
}

export async function fetchAucklandAddressCount(
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const url = new URL(linzAddressQueryUrl);
  url.searchParams.set(
    "where",
    "territorial_authority='Auckland' AND address_lifecycle='Current'",
  );
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("f", "json");
  const body = (await fetchLinzAddressJson(
    url,
    fetcher,
    "application/json",
  )) as {
    count?: unknown;
  };
  if (!body || typeof body.count !== "number") {
    throw new Error("LINZ_ADDRESS_IMPORT_INVALID_RESPONSE");
  }
  return body.count;
}

async function fetchLinzAddressJson(
  url: URL,
  fetcher: typeof fetch,
  accept: string,
): Promise<unknown> {
  try {
    const result = await fetchProviderBody({
      provider: "linz",
      fetch: fetcher,
      url,
      init: { headers: { Accept: accept } },
      timeoutMs: providerTimeoutMs(),
      maxBytes: MAX_LINZ_ADDRESS_PAGE_BYTES,
    });
    if (!result.response.ok || !result.bytes) {
      throw new Error("LINZ_ADDRESS_IMPORT_HTTP_ERROR");
    }
    return JSON.parse(new TextDecoder().decode(result.bytes));
  } catch (error) {
    if (error instanceof BodyLimitError) {
      throw new Error("LINZ_ADDRESS_IMPORT_RESPONSE_TOO_LARGE");
    }
    throw error;
  }
}
