import { z } from "zod";
import {
  DataAccessSpikeError,
  runDataAccessSpike,
  type DataAccessSpikeGateway,
  type DataAccessSpikeResult,
  type AddressOption,
} from "./run-data-access-spike";
import { isProviderEvidenceError } from "./data-access-gateway";

const requestSchema = z
  .object({
    address: z.string().trim().min(8).max(200),
    selectedAddressId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type DataAccessRequestErrorCode =
  | "INVALID_ADDRESS"
  | "ADDRESS_FORMAT_UNSUPPORTED"
  | "ADDRESS_NOT_FOUND"
  | "ADDRESS_AMBIGUOUS"
  | "PARCEL_NOT_FOUND"
  | "PARCEL_AMBIGUOUS"
  | "PARCEL_UNCONFIRMED"
  | "OUTSIDE_SUPPORTED_REGION"
  | "DATA_PROVIDER_ERROR"
  | "ANALYSIS_FAILED";

export type DataAccessRequestResponse =
  | {
      ok: true;
      status: 200;
      data: DataAccessSpikeResult;
    }
  | {
      ok: false;
      status: 400 | 404 | 409 | 422 | 500 | 502;
      error: {
        code: DataAccessRequestErrorCode;
        message: string;
        options?: AddressOption[];
      };
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
      "Enter a complete Auckland property address.",
    );
  }

  try {
    const data = await runDataAccessSpike({
      requestedAddress: request.data.address,
      selectedAddressId: request.data.selectedAddressId,
      gateway: input.gateway,
      basemapApiKey: input.basemapApiKey,
      now: input.now,
    });

    if (
      data.parcelMatch.status !== "mapped_primary_parcel" ||
      !data.identityCheck.distinctFromAlternatives
    ) {
      return requestError(
        409,
        "PARCEL_UNCONFIRMED",
        "The legal parcel could not be confirmed for this address. Manual property review is required.",
      );
    }

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
          "No exact Auckland address match was found.",
        );
      case "ADDRESS_AMBIGUOUS":
        return {
          ok: false,
          status: 409,
          error: {
            code: error.code,
            message: "Select the correct Auckland address to continue.",
            options: error.addressOptions,
          },
        };
      case "PARCEL_NOT_FOUND":
        return requestError(
          404,
          error.code,
          "No legal parcel was found at the resolved address point.",
        );
      case "PARCEL_AMBIGUOUS":
        return requestError(
          409,
          error.code,
          "More than one legal parcel contains this address point. Manual review is required.",
        );
      case "OUTSIDE_SUPPORTED_REGION":
        return requestError(
          422,
          error.code,
          "This proof of concept currently supports Auckland addresses only.",
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
      "Use a street address such as 42A Bahari Drive, Ranui, Auckland.",
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
): DataAccessRequestResponse {
  return { ok: false, status, error: { code, message } };
}
