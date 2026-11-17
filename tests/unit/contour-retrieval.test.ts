import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import { executeFastPropertyDetailsRequest } from "@/modules/data-access-spike/execute-fast-property-details";

const envelope: [number, number, number, number] = [
  174.954, -36.929, 174.957, -36.928,
];
const line = (id: number) => ({
  type: "Feature",
  id,
  geometry: {
    type: "LineString",
    coordinates: [
      [174.95, -36.9285],
      [174.96, -36.9285],
    ],
  },
  properties: { OBJECTID: id, Elevation: id / 4, Year: "2016" },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("complete, bounded contour retrieval", () => {
  const manifest = (ids: number[] | null) =>
    Response.json({ objectIdFieldName: "OBJECTID", objectIds: ids });
  const isManifest = (input: Parameters<typeof fetch>[0]) =>
    new URL(String(input)).searchParams.get("returnIdsOnly") === "true";
  const requestedIds = (input: Parameters<typeof fetch>[0]) =>
    new URL(String(input)).searchParams
      .get("objectIds")!
      .split(",")
      .map(Number);

  it.each([2_677_880, 3_222_227])(
    "retrieves all contours when the combined response is %i bytes",
    async (size) => {
      const fetchStub = vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input));
        if (url.searchParams.get("returnIdsOnly") === "true") {
          return Response.json({
            objectIdFieldName: "OBJECTID",
            objectIds: [1, 2, 3, 4],
          });
        }
        const requested = url.searchParams
          .get("objectIds")
          ?.split(",")
          .map(Number);
        if (!requested || requested.length > 2) {
          return new Response("", {
            headers: { "Content-Length": String(size) },
          });
        }
        return Response.json({
          type: "FeatureCollection",
          features: requested.map(line),
          exceededTransferLimit: false,
        });
      });
      const result = await new OfficialGisGateway({
        fetch: fetchStub,
      }).queryFeatures("contours", envelope);
      expect(result.features.map((x) => x.id).sort()).toEqual([
        "1",
        "2",
        "3",
        "4",
      ]);
      for (const feature of result.features) {
        expect(feature.geometry).toEqual({
          type: "LineString",
          coordinates: [
            [174.954, -36.9285],
            [174.957, -36.9285],
          ],
        });
      }
      expect(fetchStub.mock.calls.length).toBeLessThanOrEqual(6);
    },
  );

  it("does not classify an incomplete empty provider page as verified empty", async () => {
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input));
        if (!url.pathname.includes("/Contours/"))
          return Response.json({ type: "FeatureCollection", features: [] });
        if (url.searchParams.get("returnIdsOnly") === "true")
          return Response.json({
            objectIdFieldName: "OBJECTID",
            objectIds: [1],
          });
        return Response.json({
          type: "FeatureCollection",
          features: [],
          exceededTransferLimit: true,
        });
      }),
    });
    vi.spyOn(gateway, "datasetCapability").mockImplementation((key) => ({
      detailedQuery: key === "contours",
      reason: key === "contours" ? null : "Not requested in this regression",
    }));
    const result = await executeFastPropertyDetailsRequest({
      body: {
        addressId: "incomplete-contour-regression",
        coordinates: [174.9556, -36.9285],
      },
      gateway,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.layers.find((x) => x.key === "contours")?.state).toBe(
      "provider_error",
    );
    expect(result.data.constraints.retryableLayerKeys).toContain("contours");
  });

  it("accepts a genuinely empty complete ID manifest without fetching geometry", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () => manifest(null));
    expect(
      (
        await new OfficialGisGateway({ fetch: fetchStub }).queryFeatures(
          "contours",
          envelope,
        )
      ).features,
    ).toEqual([]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("rejects an incomplete ID manifest even when it contains no IDs", async () => {
    const gateway = new OfficialGisGateway({
      fetch: async () =>
        Response.json({
          objectIdFieldName: "OBJECTID",
          objectIds: null,
          exceededTransferLimit: true,
        }),
    });
    await expect(gateway.queryFeatures("contours", envelope)).rejects.toThrow(
      "PROVIDER_RESPONSE_INVALID",
    );
  });

  it("splits truncated pages and returns every expected ID exactly once", async () => {
    const fetchStub = vi.fn<typeof fetch>(async (input) => {
      if (isManifest(input)) return manifest([4, 3, 2, 1]);
      const ids = requestedIds(input);
      return Response.json({
        type: "FeatureCollection",
        features: ids.slice(0, 2).map(line),
        exceededTransferLimit: ids.length > 2,
      });
    });
    const result = await new OfficialGisGateway({
      fetch: fetchStub,
    }).queryFeatures("contours", envelope);
    expect(result.features.map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    expect(fetchStub).toHaveBeenCalledTimes(4);
  });

  it.each([
    [line(1)],
    [line(1), line(1)],
    [line(1), line(3)],
    [line(1), { ...line(2), properties: { OBJECTID: true } }],
  ])(
    "rejects missing, repeated or foreign IDs rather than returning partial geometry: %j",
    async (...features) => {
      const gateway = new OfficialGisGateway({
        fetch: async (input) =>
          isManifest(input)
            ? manifest([1, 2])
            : Response.json({ type: "FeatureCollection", features }),
      });
      await expect(gateway.queryFeatures("contours", envelope)).rejects.toThrow(
        "PROVIDER_RESPONSE_INVALID",
      );
    },
  );

  it("does not return the earlier successful batch if a later batch is incomplete", async () => {
    const gateway = new OfficialGisGateway({
      fetch: async (input) => {
        if (isManifest(input))
          return manifest(Array.from({ length: 65 }, (_, i) => i + 1));
        const ids = requestedIds(input);
        return Response.json({
          type: "FeatureCollection",
          features: ids[0] === 65 ? [] : ids.map(line),
        });
      },
    });
    await expect(gateway.queryFeatures("contours", envelope)).rejects.toThrow(
      "PROVIDER_RESPONSE_INVALID",
    );
  });

  it("clips a long full-provider line before applying the small map-output budget", async () => {
    const feature = {
      ...line(1),
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 6001 }, (_, i) => [
          174.95 + (i / 6000) * 0.01,
          -36.9285,
        ]),
      },
    };
    const gateway = new OfficialGisGateway({
      fetch: async (input) =>
        isManifest(input)
          ? manifest([1])
          : Response.json({ type: "FeatureCollection", features: [feature] }),
    });
    const result = await gateway.queryFeatures("contours", envelope);
    expect(result.features).toHaveLength(1);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(100_000);
  });

  it("keeps an oversized individual feature unavailable instead of raising the shared byte limit", async () => {
    const fetchStub = vi.fn<typeof fetch>(async (input) =>
      isManifest(input)
        ? manifest([1])
        : new Response("", { headers: { "Content-Length": "5000000" } }),
    );
    await expect(
      new OfficialGisGateway({ fetch: fetchStub }).queryFeatures(
        "contours",
        envelope,
      ),
    ).rejects.toThrow("PROVIDER_RESPONSE_TOO_LARGE");
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("bounds the ID manifest before issuing geometry requests", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      manifest(Array.from({ length: 2001 }, (_, i) => i + 1)),
    );
    await expect(
      new OfficialGisGateway({ fetch: fetchStub }).queryFeatures(
        "contours",
        envelope,
      ),
    ).rejects.toThrow("PROVIDER_RESPONSE_TOO_LARGE");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("caps repeated page splitting instead of looping indefinitely", async () => {
    const fetchStub = vi.fn<typeof fetch>(async (input) => {
      if (isManifest(input))
        return manifest(Array.from({ length: 64 }, (_, i) => i + 1));
      const ids = requestedIds(input);
      return Response.json({
        type: "FeatureCollection",
        features: ids.length === 1 ? ids.map(line) : [],
        exceededTransferLimit: ids.length > 1,
      });
    });
    await expect(
      new OfficialGisGateway({ fetch: fetchStub }).queryFeatures(
        "contours",
        envelope,
      ),
    ).rejects.toThrow("contour operation budget exceeded");
    expect(fetchStub).toHaveBeenCalledTimes(64);
  });

  it("caps aggregate bytes across rejected and successful split reads", async () => {
    const fetchStub = vi.fn<typeof fetch>(async (input) => {
      if (isManifest(input))
        return manifest(Array.from({ length: 64 }, (_, i) => i + 1));
      const ids = requestedIds(input);
      if (ids.length > 1)
        return new Response("", { headers: { "Content-Length": "2000001" } });
      return new Response(
        " ".repeat(400_000) +
          JSON.stringify({
            type: "FeatureCollection",
            features: ids.map(line),
          }),
      );
    });
    await expect(
      new OfficialGisGateway({ fetch: fetchStub }).queryFeatures(
        "contours",
        envelope,
      ),
    ).rejects.toThrow("contour operation budget exceeded");
    expect(fetchStub.mock.calls.length).toBeLessThan(20);
  });

  it("bounds final map size even when individual provider responses fit", async () => {
    const feature = {
      ...line(1),
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 19000 }, (_, i) => [
          174.9541 + (i % 2) * 0.002,
          -36.9284 + (i % 3) * 0.00001,
        ]),
      },
    };
    const gateway = new OfficialGisGateway({
      fetch: async (input) =>
        isManifest(input)
          ? manifest([1])
          : Response.json({ type: "FeatureCollection", features: [feature] }),
    });
    expect(Buffer.byteLength(JSON.stringify(feature))).toBeGreaterThan(500_000);
    const error = await gateway.queryFeatures("contours", envelope).then(
      () => null,
      (error) => error.message,
    );
    expect(error).toContain("contour operation budget exceeded");
  });

  it("bounds map vertex count independently of serialized byte size", async () => {
    const feature = {
      ...line(1),
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 20001 }, (_, i) => [
          174.5 + (i % 2) * 0.001,
          -36.5,
        ]),
      },
    };
    expect(Buffer.byteLength(JSON.stringify(feature))).toBeLessThan(500_000);
    const gateway = new OfficialGisGateway({
      fetch: async (input) =>
        isManifest(input)
          ? manifest([1])
          : Response.json({ type: "FeatureCollection", features: [feature] }),
    });
    const error = await gateway
      .queryFeatures("contours", [174, -37, 175, -36])
      .then(
        () => null,
        (error) => error.message,
      );
    expect(error).toContain("contour operation budget exceeded");
  });

  it("limits simultaneous geometry reads to two while completing multiple batches", async () => {
    let active = 0;
    let maximum = 0;
    const fetchStub = vi.fn<typeof fetch>(async (input) => {
      if (isManifest(input))
        return manifest(Array.from({ length: 130 }, (_, i) => i + 1));
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return Response.json({
        type: "FeatureCollection",
        features: requestedIds(input).map(line),
      });
    });
    const result = await new OfficialGisGateway({
      fetch: fetchStub,
    }).queryFeatures("contours", envelope);
    expect(result.features).toHaveLength(130);
    expect(maximum).toBe(2);
    expect(fetchStub).toHaveBeenCalledTimes(4);
  });

  it("aborts outstanding requests at the whole-operation deadline", async () => {
    let aborted = false;
    const gateway = new OfficialGisGateway({
      timeoutMs: 100,
      fetch: async (input, init) => {
        if (isManifest(input)) return manifest([1]);
        return new Promise<Response>((_, reject) =>
          init!.signal!.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          ),
        );
      },
    });
    await expect(gateway.queryFeatures("contours", envelope)).rejects.toThrow(
      "PROVIDER_TIMEOUT",
    );
    expect(aborted).toBe(true);
  });

  it("also rejects explicitly truncated non-contour responses", async () => {
    const gateway = new OfficialGisGateway({
      fetch: async () =>
        Response.json({
          type: "FeatureCollection",
          features: [],
          exceededTransferLimit: true,
        }),
    });
    await expect(
      gateway.queryFeatures("building_footprints", envelope),
    ).rejects.toThrow("PROVIDER_RESPONSE_INVALID");
  });
});
