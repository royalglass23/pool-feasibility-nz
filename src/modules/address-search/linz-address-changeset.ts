import { z } from "zod";
import {
  BodyLimitError,
  fetchProviderBody,
  providerTimeoutMs,
} from "@/shared/http/provider-runtime";

export const linzAddressChangesetMarker =
  "https://data.linz.govt.nz/layer/123113-nz-addresses/changeset";

export const LINZ_CHANGESET_PAGE_SIZE = 1_000;
const MAX_LINZ_CHANGESET_BYTES = 2_000_000;

const changesetSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        __change__: z.enum(["INSERT", "UPDATE", "DELETE"]),
        address_id: z.union([z.string(), z.number()]),
      }),
    }),
  ),
});

export type LinzAddressChange = {
  action: "INSERT" | "UPDATE" | "DELETE";
  addressId: string;
};

export async function fetchAucklandAddressChangesPage(input: {
  apiKey: string;
  from: Date;
  to: Date;
  startIndex: number;
  fetch?: typeof fetch;
}): Promise<LinzAddressChange[]> {
  if (!(input.from < input.to)) {
    throw new Error("LINZ_ADDRESS_REFRESH_INVALID_WINDOW");
  }

  const url = new URL(
    `https://data.linz.govt.nz/services;key=${encodeURIComponent(input.apiKey)}/wfs/layer-123113-changeset`,
  );
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", "layer-123113-changeset");
  url.searchParams.set(
    "viewparams",
    `from:${input.from.toISOString()};to:${input.to.toISOString()}`,
  );
  url.searchParams.set("cql_filter", "territorial_authority='Auckland'");
  url.searchParams.set("propertyName", "address_id,__change__");
  url.searchParams.set("sortBy", "address_id");
  url.searchParams.set("startIndex", String(input.startIndex));
  url.searchParams.set("count", String(LINZ_CHANGESET_PAGE_SIZE));
  url.searchParams.set("outputFormat", "json");

  try {
    const result = await fetchProviderBody({
      provider: "linz",
      fetch: input.fetch ?? fetch,
      url,
      init: { headers: { Accept: "application/json" } },
      timeoutMs: providerTimeoutMs(),
      maxBytes: MAX_LINZ_CHANGESET_BYTES,
    });
    if (!result.response.ok || !result.bytes) {
      throw new Error("LINZ_ADDRESS_REFRESH_HTTP_ERROR");
    }
    const parsed = changesetSchema.safeParse(
      JSON.parse(new TextDecoder().decode(result.bytes)),
    );
    if (!parsed.success) {
      throw new Error("LINZ_ADDRESS_REFRESH_INVALID_RESPONSE");
    }
    return parsed.data.features.map(({ properties }) => ({
      action: properties.__change__,
      addressId: String(properties.address_id),
    }));
  } catch (error) {
    if (error instanceof BodyLimitError) {
      throw new Error("LINZ_ADDRESS_REFRESH_RESPONSE_TOO_LARGE");
    }
    throw error;
  }
}
