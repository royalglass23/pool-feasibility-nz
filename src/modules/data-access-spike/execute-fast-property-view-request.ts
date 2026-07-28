import { z } from "zod";
import {
  DataAccessSpikeError,
  type BoundaryState,
} from "./run-data-access-spike";
import {
  resolveFastPropertyAddress,
  type FastPropertyViewResult,
} from "./fast-property-view";
import type { DataAccessSpikeGateway } from "./data-access-gateway";
import { isProviderEvidenceError } from "./data-access-gateway";

const requestSchema = z
  .object({
    address: z.string().trim().min(8).max(200),
    selectedAddressId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type FastPropertyViewRequestError = {
  code:
    | "INVALID_ADDRESS"
    | "ADDRESS_NOT_FOUND"
    | "DATA_PROVIDER_ERROR"
    | "ANALYSIS_FAILED"
    | "ADDRESS_AMBIGUOUS";
  message: string;
  options?: Array<{ addressId: string; fullAddress: string }>;
  boundaryState?: BoundaryState;
};

export type FastPropertyViewRequestResponse =
  | { ok: true; status: 200; data: FastPropertyViewResult }
  | {
      ok: false;
      status: 400 | 404 | 409 | 502 | 500;
      error: FastPropertyViewRequestError;
    };

export async function executeFastPropertyViewRequest(input: {
  body: unknown;
  gateway: DataAccessSpikeGateway;
  basemapApiKey?: string;
  now?: () => Date;
}): Promise<FastPropertyViewRequestResponse> {
  const request = requestSchema.safeParse(input.body);
  if (!request.success)
    return failure(
      400,
      "INVALID_ADDRESS",
      "Enter a complete New Zealand property address.",
    );
  try {
    return {
      ok: true,
      status: 200,
      data: await resolveFastPropertyAddress({
        requestedAddress: request.data.address,
        selectedAddressId: request.data.selectedAddressId,
        gateway: input.gateway,
        now: input.now,
      }),
    };
  } catch (error) {
    if (error instanceof DataAccessSpikeError) {
      if (error.code === "ADDRESS_AMBIGUOUS")
        return {
          ok: false,
          status: 409,
          error: {
            code: error.code,
            message: "Select the correct New Zealand address to continue.",
            options: error.addressOptions,
          },
        };
      if (error.code === "ADDRESS_NOT_FOUND")
        return failure(
          404,
          error.code,
          "No exact New Zealand address match was found.",
        );
    }
    if (isProviderEvidenceError(error))
      return failure(
        502,
        "DATA_PROVIDER_ERROR",
        "The address provider could not complete the fast view. Try again shortly.",
      );
    return failure(
      500,
      "ANALYSIS_FAILED",
      "The fast property view could not be completed.",
    );
  }
}

function failure(
  status: 400 | 404 | 409 | 502 | 500,
  code: FastPropertyViewRequestError["code"],
  message: string,
) {
  return { ok: false as const, status, error: { code, message } };
}
