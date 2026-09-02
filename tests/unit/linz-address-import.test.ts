import { describe, expect, it, vi } from "vitest";
import { fetchAucklandAddressPage } from "@/modules/address-search/linz-address-import";

describe("Auckland LINZ address import", () => {
  it("rejects an oversized provider page before parsing it", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("{}", {
          headers: { "content-length": "9000000" },
        }),
    );

    await expect(
      fetchAucklandAddressPage({ afterObjectId: 0, fetch: fetcher }),
    ).rejects.toThrow("LINZ_ADDRESS_IMPORT_RESPONSE_TOO_LARGE");
  });
});
