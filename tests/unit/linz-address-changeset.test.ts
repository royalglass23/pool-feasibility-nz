import { describe, expect, it, vi } from "vitest";
import { fetchAucklandAddressChangesPage } from "@/modules/address-search/linz-address-changeset";

describe("LINZ address changeset", () => {
  it("requests only Auckland address identifiers and change actions", async () => {
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = new URL(String(request));
      expect(url.pathname).toContain("/wfs/layer-123113-changeset");
      expect(url.searchParams.get("viewparams")).toBe(
        "from:2026-09-09T00:00:00.000Z;to:2026-09-11T00:00:00.000Z",
      );
      expect(url.searchParams.get("cql_filter")).toBe(
        "territorial_authority='Auckland'",
      );
      expect(url.searchParams.get("propertyName")).toBe(
        "address_id,__change__",
      );
      expect(url.searchParams.get("sortBy")).toBe("address_id");
      return Response.json({
        features: [
          { properties: { __change__: "UPDATE", address_id: 2359811 } },
          { properties: { __change__: "DELETE", address_id: 2359812 } },
        ],
      });
    });

    await expect(
      fetchAucklandAddressChangesPage({
        apiKey: "test-api-key",
        from: new Date("2026-09-09T00:00:00.000Z"),
        to: new Date("2026-09-11T00:00:00.000Z"),
        startIndex: 0,
        fetch: fetcher as typeof fetch,
      }),
    ).resolves.toEqual([
      { action: "UPDATE", addressId: "2359811" },
      { action: "DELETE", addressId: "2359812" },
    ]);
  });

  it("rejects malformed changes instead of advancing the refresh cursor", async () => {
    await expect(
      fetchAucklandAddressChangesPage({
        apiKey: "test-api-key",
        from: new Date("2026-09-09T00:00:00.000Z"),
        to: new Date("2026-09-11T00:00:00.000Z"),
        startIndex: 0,
        fetch: vi.fn(async () =>
          Response.json({
            features: [
              { properties: { __change__: "UNKNOWN", address_id: 1 } },
            ],
          }),
        ) as typeof fetch,
      }),
    ).rejects.toThrow("LINZ_ADDRESS_REFRESH_INVALID_RESPONSE");
  });
});
