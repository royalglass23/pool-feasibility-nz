import { describe, expect, it, vi } from "vitest";
import {
  fetchAucklandAddressPage,
  fetchBrownsBayAddressPage,
} from "@/modules/address-search/linz-address-import";

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

  it("fetches a bounded page of current Browns Bay addresses", async () => {
    const requestedUrls: string[] = [];
    const fetcher: typeof fetch = vi.fn(async (input) => {
      requestedUrls.push(String(input));
      return Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [174.75, -36.714] },
            properties: {
              OBJECTID: 123,
              address_id: 456,
              full_address: "1 Test Street, Browns Bay, Auckland",
              full_address_number: "1",
              unit: null,
              territorial_authority: "Auckland",
              suburb_locality: "Browns Bay",
              town_city: "Auckland",
              address_lifecycle: "Current",
            },
          },
        ],
      });
    });

    await expect(
      fetchBrownsBayAddressPage({ offset: 2000, fetch: fetcher }),
    ).resolves.toHaveLength(1);
    const requested = new URL(requestedUrls[0]!);
    expect(requested.searchParams.get("where")).toBe(
      "territorial_authority='Auckland' AND suburb_locality='Browns Bay' AND address_lifecycle='Current'",
    );
    expect(requested.searchParams.get("resultOffset")).toBe("2000");
    expect(requested.searchParams.get("resultRecordCount")).toBe("2000");
  });
});
