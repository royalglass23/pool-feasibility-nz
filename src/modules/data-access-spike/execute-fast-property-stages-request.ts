import { z } from "zod";
import type { AddressMatch, DataAccessSpikeGateway } from "./data-access-gateway";
import { loadFastPropertyStages, type FastPropertyViewStage } from "./fast-property-view";

const requestSchema = z.object({
  addressId: z.string().trim().min(1).max(100),
  coordinates: z.tuple([z.number().min(160).max(180), z.number().min(-48).max(-33)]),
}).strict();

export type FastPropertyStagesResponse =
  | { ok: true; status: 200; data: FastPropertyViewStage }
  | { ok: false; status: 400; error: { code: "INVALID_REQUEST"; message: string } };

export async function executeFastPropertyStagesRequest(input: {
  body: unknown;
  gateway: DataAccessSpikeGateway;
  basemapApiKey?: string;
}): Promise<FastPropertyStagesResponse> {
  const request = requestSchema.safeParse(input.body);
  if (!request.success) {
    return {
      ok: false,
      status: 400,
      error: { code: "INVALID_REQUEST", message: "Submit one selected address point." },
    };
  }
  const resolvedAddress = {
    addressId: request.data.addressId,
    fullAddress: "",
    fullAddressNumber: "",
    unit: null,
    territorialAuthority: "",
    coordinates: request.data.coordinates,
  } satisfies AddressMatch;
  return {
    ok: true,
    status: 200,
    data: await loadFastPropertyStages({
      resolvedAddress,
      gateway: input.gateway,
      basemapApiKey: input.basemapApiKey,
    }),
  };
}
