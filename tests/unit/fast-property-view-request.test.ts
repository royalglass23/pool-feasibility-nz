import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AddressIndexUnavailableError } from "@/modules/address-search/neon-linz-address-search";
import { executeFastPropertyViewRequest } from "@/modules/data-access-spike/execute-fast-property-view-request";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";

describe("selected-address Property Check request", () => {
  it("returns a retryable unavailable response when the address index is stale", async () => {
    const response = await executeFastPropertyViewRequest({
      body: {
        address: "42A Bahari Drive, Ranui, Auckland",
        selectedAddressId: "2359811",
      },
      addressSearch: {
        search: vi.fn(),
        getById: vi.fn(async () => {
          throw new AddressIndexUnavailableError();
        }),
        status: vi.fn(async () => ({ indexedAt: null, isFresh: false })),
      },
      propertyLayers: createDataAccessGateway(),
    });

    expect(response).toEqual({
      ok: false,
      status: 503,
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
  });
});
