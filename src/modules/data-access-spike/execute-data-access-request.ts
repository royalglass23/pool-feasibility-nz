import { z } from "zod";
import {
  DataAccessSpikeError,
  runDataAccessSpike,
  type DataAccessSpikeGateway,
  type DataAccessSpikeResult,
  type AddressOption,
  type BoundaryState,
} from "./run-data-access-spike";
import { isProviderEvidenceError } from "./data-access-gateway";

const requestSchema = z
  .object({
    address: z.string().trim().min(8).max(200),
    selectedAddressId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type DataAccessRequestError =
  | {
      code:
        | "INVALID_ADDRESS"
        | "ADDRESS_FORMAT_UNSUPPORTED"
        | "ADDRESS_NOT_FOUND"
        | "PARCEL_UNCONFIRMED"
        | "DATA_PROVIDER_ERROR"
        | "ANALYSIS_FAILED";
      message: string;
      options?: never;
      boundaryState?: never;
    }
  | {
      code: "ADDRESS_AMBIGUOUS";
      message: string;
      options: AddressOption[];
      boundaryState?: never;
    }
  | {
      code: "PARCEL_NOT_FOUND";
      message: string;
      options?: never;
      boundaryState: "unavailable";
    }
  | {
      code: "PARCEL_AMBIGUOUS";
      message: string;
      options?: never;
      boundaryState: "multiple";
    };

export type DataAccessRequestErrorCode = DataAccessRequestError["code"];

export type DataAccessRequestResponse =
  | {
      ok: true;
      status: 200;
      data: DataAccessSpikeResult;
    }
  | {
      ok: false;
      status: 400 | 404 | 409 | 422 | 500 | 502;
      error: DataAccessRequestError;
    };

export async function executeDataAccessRequest(input: {
  body: unknown;
  gateway: DataAccessSpikeGateway;
  basemapApiKey?: string;
  now?: () => Date;
}): Promise<DataAccessRequestResponse> {
  const request = requestSchema.safeParse(input.body);
  if (!request.success) {
    return requestError(
      400,
      "INVALID_ADDRESS",
      "Enter a complete New Zealand property address.",
    );
  }

  try {
    const data = await runDataAccessSpike({
      requestedAddress: request.data.address,
      selectedAddressId: request.data.selectedAddressId,
      preferences: {
        frontageDirection: null,
        preferredLocation: "any",
        preferredSize: null,
      },
      gateway: input.gateway,
      basemapApiKey: input.basemapApiKey,
      now: input.now,
    });

    return { ok: true, status: 200, data };
  } catch (error) {
    return mapDataAccessError(error);
  }
}

function mapDataAccessError(error: unknown): DataAccessRequestResponse {
  if (error instanceof DataAccessSpikeError) {
    switch (error.code) {
      case "ADDRESS_NOT_FOUND":
        return requestError(
          404,
          error.code,
          "No exact New Zealand address match was found.",
        );
      case "ADDRESS_AMBIGUOUS":
        return {
          ok: false,
          status: 409,
          error: {
            code: error.code,
            message: "Select the correct New Zealand address to continue.",
            options: error.addressOptions,
          },
        };
      case "PARCEL_NOT_FOUND":
        return requestError(
          404,
          error.code,
          "No mapped property boundary was found at the selected address point.",
          error.boundaryState ?? undefined,
        );
      case "PARCEL_AMBIGUOUS":
        return requestError(
          409,
          error.code,
          "More than one mapped property boundary contains this address point. Manual review is required.",
          error.boundaryState ?? undefined,
        );
    }
  }

  if (
    error instanceof Error &&
    error.message === "ADDRESS_FORMAT_UNSUPPORTED"
  ) {
    return requestError(
      400,
      "ADDRESS_FORMAT_UNSUPPORTED",
      "Use a complete street address such as 42A Bahari Drive, Ranui, Auckland.",
    );
  }

  if (isProviderEvidenceError(error)) {
    return providerError();
  }

  return requestError(
    500,
    "ANALYSIS_FAILED",
    "The property analysis could not be completed.",
  );
}

function providerError(): DataAccessRequestResponse {
  return requestError(
    502,
    "DATA_PROVIDER_ERROR",
    "An official data provider could not complete the request. Try again shortly.",
  );
}

function requestError(
  status: 400 | 404 | 409 | 422 | 500 | 502,
  code: DataAccessRequestErrorCode,
  message: string,
  boundaryState?: BoundaryState,
): DataAccessRequestResponse {
  return {
    ok: false,
    status,
    error: {
      code,
      message,
      ...(boundaryState ? { boundaryState } : {}),
    },
  } as DataAccessRequestResponse;
}
