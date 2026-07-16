import { describe, expect, it, vi } from "vitest";
import { OfficialGisGateway } from "@/modules/data-access-spike/official-gis-gateway";

describe("OfficialGisGateway", () => {
  it("builds a bounded LINZ lookup for a supplied unit address", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({ type: "FeatureCollection", features: [] }),
    );
    const gateway = new OfficialGisGateway({ fetch: fetchStub });

    await gateway.searchAddresses(
      "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland",
    );

    const requestedUrl = new URL(String(fetchStub.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("where")).toBe(
      "address_number=49 AND full_road_name='Pigeon Mountain Road' AND unit='2'",
    );
  });

  it("converts runtime timeout errors into a stable provider code", async () => {
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () => {
        throw new DOMException("The operation timed out", "TimeoutError");
      }),
    });

    await expect(
      gateway.searchAddresses(
        "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland",
      ),
    ).rejects.toThrow("PROVIDER_TIMEOUT");
  });

  it("stops reading an unknown-length provider response after the byte limit", async () => {
    const totalChunks = 20;
    let chunksServed = 0;
    const responseBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksServed += 1;
        controller.enqueue(new TextEncoder().encode("12345678"));
        if (chunksServed === totalChunks) {
          controller.close();
        }
      },
    });
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () => new Response(responseBody)),
      maxResponseBytes: 10,
    });

    await expect(
      gateway.searchAddresses("42A Bahari Drive, Ranui, Auckland"),
    ).rejects.toThrow("PROVIDER_RESPONSE_TOO_LARGE");
    expect(chunksServed).toBeLessThan(totalChunks);
  });
});
