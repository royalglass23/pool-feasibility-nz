import { describe, expect, it, vi } from "vitest";
import {
  assertAllowedProviderUrl,
  OfficialGisGateway,
} from "@/modules/providers/official-gis-gateway";
import addressesFixture from "../fixtures/linz/42-bahari-addresses.json";
import parcelsFixture from "../fixtures/linz/42-bahari-parcels.json";

describe("OfficialGisGateway", () => {
  it("rejects provider requests outside the explicit origin allow-list", () => {
    expect(() =>
      assertAllowedProviderUrl(new URL("https://example.com/private")),
    ).toThrow("PROVIDER_URL_NOT_ALLOWED");
  });

  it("returns validated WGS84 geometry for an official structure layer", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 901,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [174.60782, -36.86028],
                  [174.60796, -36.86028],
                  [174.60796, -36.86016],
                  [174.60782, -36.86016],
                  [174.60782, -36.86028],
                ],
              ],
            },
            properties: {
              building_id: 901,
              capture_source: "Aerial imagery",
            },
          },
        ],
      }),
    );
    const gateway = new OfficialGisGateway({ fetch: fetchStub });

    await expect(
      gateway.queryFeatures(
        "building_footprints",
        [174.6078, -36.8603, 174.608, -36.8601],
      ),
    ).resolves.toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "901",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [174.60782, -36.86028],
                [174.60796, -36.86028],
                [174.60796, -36.86016],
                [174.60782, -36.86016],
                [174.60782, -36.86028],
              ],
            ],
          },
          properties: {
            building_id: 901,
            capture_source: "Aerial imagery",
          },
        },
      ],
    });

    const requestedUrl = new URL(String(fetchStub.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("returnGeometry")).toBe("true");
    expect(requestedUrl.searchParams.get("outSR")).toBe("4326");
    expect(requestedUrl.searchParams.get("maxAllowableOffset")).toBe(
      "0.000001",
    );
    expect(requestedUrl.searchParams.get("geometryPrecision")).toBe("7");
    expect(requestedUrl.searchParams.get("f")).toBe("geojson");
  });

  it("returns validated WGS84 geometry for an official line constraint", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "flow-22",
            geometry: {
              type: "LineString",
              coordinates: [
                [174.60779, -36.8603],
                [174.60801, -36.86011],
              ],
            },
            properties: { asset_id: "flow-22", status: "Current" },
          },
        ],
      }),
    );
    const gateway = new OfficialGisGateway({ fetch: fetchStub });

    await expect(
      gateway.queryFeatures(
        "overland_flow_paths",
        [174.6078, -36.8603, 174.608, -36.8601],
      ),
    ).resolves.toMatchObject({
      features: [
        {
          id: "flow-22",
          geometry: {
            type: "LineString",
            coordinates: [
              [174.60779, -36.8603],
              [174.60801, -36.86011],
            ],
          },
        },
      ],
    });
  });

  it("normalizes provider elevation ordinates to 2D WGS84 geometry", async () => {
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () =>
        Response.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: "contour-16.75",
              geometry: {
                type: "LineString",
                coordinates: [
                  [174.60779, -36.8603, 16.75],
                  [174.60801, -36.86011, 16.75],
                ],
              },
              properties: { elevation: 16.75 },
            },
          ],
        }),
      ),
    });

    await expect(
      gateway.queryFeatures(
        "contours",
        [174.6078, -36.8603, 174.608, -36.8601],
      ),
    ).resolves.toMatchObject({
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [174.60779, -36.8603],
              [174.60801, -36.86011],
            ],
          },
        },
      ],
    });
  });

  it("returns Watercare point geometry only from the catalogued official service", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 317,
            geometry: {
              type: "Point",
              coordinates: [174.60777, -36.86009],
            },
            properties: { COMPKEY: 317, STATUS: "In Service" },
          },
        ],
      }),
    );
    const gateway = new OfficialGisGateway({ fetch: fetchStub });

    await expect(
      gateway.queryFeatures(
        "wastewater_manholes",
        [174.6078, -36.8603, 174.608, -36.8601],
      ),
    ).resolves.toMatchObject({
      features: [
        {
          id: "317",
          geometry: {
            type: "Point",
            coordinates: [174.60777, -36.86009],
          },
        },
      ],
    });

    expect(
      String(fetchStub.mock.calls[0]?.[0]).startsWith(
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Wastewater_Network/FeatureServer/3/query",
      ),
    ).toBe(true);
  });

  it("preserves valid multipart provider geometry", async () => {
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () =>
        Response.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: "zone-4",
              geometry: {
                type: "MultiPolygon",
                coordinates: [
                  [
                    [
                      [174.6078, -36.8603],
                      [174.608, -36.8603],
                      [174.608, -36.8601],
                      [174.6078, -36.8601],
                      [174.6078, -36.8603],
                    ],
                  ],
                ],
              },
              properties: { zone: "Residential - Mixed Housing Suburban" },
            },
          ],
        }),
      ),
    });

    await expect(
      gateway.queryFeatures(
        "planning_zone",
        [174.6078, -36.8603, 174.608, -36.8601],
      ),
    ).resolves.toMatchObject({
      features: [{ id: "zone-4", geometry: { type: "MultiPolygon" } }],
    });
  });

  it("preserves the attribution returned by the LINZ aerial style", async () => {
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () =>
        Response.json({
          id: "aerial",
          name: "aerial",
          version: 8,
          sources: {
            "basemaps-aerial": {
              type: "raster",
              attribution: "© Crown copyright: Eagle Technology, LINZ",
            },
          },
          layers: [],
        }),
      ),
    });

    await expect(gateway.checkAerial("test-key")).resolves.toMatchObject({
      attribution: {
        text: "© Crown copyright: Eagle Technology, LINZ",
        url: "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
      },
    });
  });

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
      "address_number=49 AND full_road_name='Pigeon Mountain Road' AND address_lifecycle='Current' AND unit='2'",
    );
  });

  it("builds a bounded current-address autocomplete lookup", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({ type: "FeatureCollection", features: [] }),
    );
    const gateway = new OfficialGisGateway({ fetch: fetchStub });

    await gateway.suggestAddresses("42 bahari");

    const requestedUrl = new URL(String(fetchStub.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("where")).toBe(
      "territorial_authority='Auckland' AND address_lifecycle='Current' AND full_address LIKE '%42 bahari%'",
    );
    expect(requestedUrl.searchParams.get("resultRecordCount")).toBe("8");
    expect(requestedUrl.searchParams.get("returnGeometry")).toBe("true");
  });

  it("does not normalize a retired address returned by the provider", async () => {
    const retiredResponse = {
      ...addressesFixture,
      features: addressesFixture.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          address_lifecycle: "Retired",
        },
      })),
    };
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () => Response.json(retiredResponse)),
    });

    await expect(
      gateway.searchAddresses("42A Bahari Drive, Ranui, Auckland"),
    ).resolves.toEqual([]);
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

  it("redacts provider HTTP status details behind a stable error code", async () => {
    vi.stubEnv("PROVIDER_RETRY_COUNT", "0");
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response("upstream request id secret-123", { status: 503 }),
      ),
    });

    await expect(
      gateway.queryFeatures(
        "flood_plains",
        [174.6078, -36.8603, 174.608, -36.8601],
      ),
    ).rejects.toThrow("PROVIDER_HTTP_ERROR");
    vi.unstubAllEnvs();
  });

  it("retries one transient provider failure within the configured bound", async () => {
    vi.stubEnv("PROVIDER_RETRY_COUNT", "1");
    let retryBodyCancelled = false;
    const retryBody = new ReadableStream<Uint8Array>({
      cancel() {
        retryBodyCancelled = true;
      },
    });
    const fetchStub = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(retryBody, { status: 503 }))
      .mockResolvedValueOnce(Response.json(addressesFixture));
    const gateway = new OfficialGisGateway({ fetch: fetchStub });

    await expect(
      gateway.searchAddresses("42A Bahari Drive, Ranui, Auckland"),
    ).resolves.toHaveLength(2);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(retryBodyCancelled).toBe(true);
    vi.unstubAllEnvs();
  });

  it("caps concurrent LINZ work across separate gateway instances", async () => {
    let activeBodies = 0;
    let maximumActiveBodies = 0;
    const responseBytes = new TextEncoder().encode(
      JSON.stringify(addressesFixture),
    );
    const fetchStub = vi.fn<typeof fetch>(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          activeBodies += 1;
          maximumActiveBodies = Math.max(maximumActiveBodies, activeBodies);
          setTimeout(() => {
            controller.enqueue(responseBytes);
            controller.close();
            activeBodies -= 1;
          }, 0);
        },
      });
      return new Response(body, {
        headers: { "Content-Type": "application/json" },
      });
    });

    await Promise.all(
      Array.from({ length: 8 }, () =>
        new OfficialGisGateway({ fetch: fetchStub }).searchAddresses(
          "42A Bahari Drive, Ranui, Auckland",
        ),
      ),
    );

    expect(maximumActiveBodies).toBeLessThanOrEqual(4);
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

  it("rejects parcel geometry that exceeds the provider vertex limit", async () => {
    const oversizedRing = Array.from({ length: 5_001 }, (_, index) => [
      174.6078 + index / 1_000_000_000,
      -36.8602,
    ]);
    const oversizedParcelResponse = {
      ...parcelsFixture["42A"],
      features: parcelsFixture["42A"].features.map((feature) => ({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [oversizedRing],
        },
      })),
    };
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async () =>
        Response.json(oversizedParcelResponse),
      ),
    });

    await expect(gateway.findParcelsAt([174.6079, -36.8602])).rejects.toThrow(
      "PROVIDER_RESPONSE_TOO_LARGE",
    );
  });
});
