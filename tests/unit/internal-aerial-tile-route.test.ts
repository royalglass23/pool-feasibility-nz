import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/aerial/tiles/[z]/[x]/[y]/route";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/internal/aerial/tiles/:z/:x/:y", () => {
  it("returns an authenticated LINZ aerial tile without exposing the API key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    vi.stubEnv("LINZ_BASEMAPS_API_KEY", "linz-secret-key");
    const fetchMock = vi.fn(
      async (...args: [URL | RequestInfo, RequestInit?]) => {
        void args;
        return new Response(new Uint8Array([82, 73, 70, 70]), {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "https://pool.example/api/internal/aerial/tiles/18/258210/160518",
        {
          headers: {
            Authorization: `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`,
          },
        },
      ),
      { params: Promise.resolve({ z: "18", x: "258210", y: "160518" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([82, 73, 70, 70]),
    );
    const upstreamUrl = fetchMock.mock.calls[0][0] as URL;
    expect(upstreamUrl.origin).toBe("https://basemaps.linz.govt.nz");
    expect(upstreamUrl.pathname).toBe(
      "/v1/tiles/aerial/3857/18/258210/160518.webp",
    );
    expect(upstreamUrl.searchParams.get("api")).toBe("linz-secret-key");
    expect(response.headers.get("x-linz-api-key")).toBeNull();
  });

  it("retries one transient LINZ tile failure within the configured bound", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    vi.stubEnv("LINZ_BASEMAPS_API_KEY", "linz-secret-key");
    vi.stubEnv("PROVIDER_RETRY_COUNT", "1");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([82, 73, 70, 70]), {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "https://pool.example/api/internal/aerial/tiles/18/258210/160518",
        {
          headers: {
            Authorization: `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`,
          },
        },
      ),
      { params: Promise.resolve({ z: "18", x: "258210", y: "160518" }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops an oversized tile stream without waiting for the provider to close it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    vi.stubEnv("LINZ_BASEMAPS_API_KEY", "linz-secret-key");
    let sentOversizedChunk = false;
    const neverClosingBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sentOversizedChunk) {
          sentOversizedChunk = true;
          controller.enqueue(new Uint8Array(2_000_001));
        }
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(neverClosingBody, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          }),
      ),
    );

    const response = await Promise.race([
      GET(
        new Request(
          "https://pool.example/api/internal/aerial/tiles/18/258210/160518",
          {
            headers: {
              Authorization: `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`,
              "X-Correlation-ID": "test-correlation-tile",
            },
          },
        ),
        { params: Promise.resolve({ z: "18", x: "258210", y: "160518" }) },
      ),
      new Promise<"timed-out">((resolve) =>
        setTimeout(() => resolve("timed-out"), 500),
      ),
    ]);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) return;
    expect(response.status).toBe(502);
    expect(response.headers.get("x-correlation-id")).toBe(
      "test-correlation-tile",
    );
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "AERIAL_PROVIDER_ERROR",
        message: "LINZ aerial imagery returned an invalid tile.",
        correlationId: "test-correlation-tile",
      },
    });
  });
});
