import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => vi.fn());
const addressIndexConstructorError = vi.hoisted(() => ({
  error: null as Error | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/address-search/neon-linz-address-search", () => ({
  NeonLinzAddressSearch: class {
    constructor() {
      if (addressIndexConstructorError.error) {
        throw addressIndexConstructorError.error;
      }
    }

    search = search;
  },
}));

import { POST } from "@/app/api/internal/address-suggestions/route";
import { POST as POST_PUBLIC } from "@/app/api/public/address-suggestions/route";
import { AddressIndexUnavailableError } from "@/modules/address-search/address-search";

const authHeader = `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`;

afterEach(() => {
  search.mockReset();
  addressIndexConstructorError.error = null;
  vi.unstubAllEnvs();
});

function suggestionRequest(path: string, query: string, headers?: HeadersInit) {
  return new Request(`https://pool.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ query }),
  });
}

describe("POST /api/public/address-suggestions", () => {
  it("returns a retryable response when address-index setup is unavailable", async () => {
    addressIndexConstructorError.error = new AddressIndexUnavailableError();

    const response = await POST_PUBLIC(
      suggestionRequest("/api/public/address-suggestions", "bahari"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
  });

  it("serves an anonymous visitor without Basic credentials", async () => {
    vi.stubEnv("NODE_ENV", "development");
    search.mockResolvedValue([
      {
        addressId: "1",
        fullAddress: "1 Bahari Drive, Auckland",
        fullAddressNumber: "1",
        unit: null,
        territorialAuthority: "Auckland",
        coordinates: [174.6082, -36.8603],
      },
    ]);

    const response = await POST_PUBLIC(
      suggestionRequest("/api/public/address-suggestions", "bahari"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      suggestions: [
        {
          addressId: "1",
          fullAddress: "1 Bahari Drive, Auckland",
          fullAddressNumber: "1",
          unit: null,
          territorialAuthority: "Auckland",
        },
      ],
    });
    expect(search).toHaveBeenCalledWith("bahari");
  });
});

describe("POST /api/internal/address-suggestions", () => {
  it("requires the existing login boundary", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await POST(
      suggestionRequest("/api/internal/address-suggestions", "42"),
    );

    expect(response.status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });

  it("validates the minimum query before calling LINZ", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await POST(
      suggestionRequest("/api/internal/address-suggestions", "ab", {
        Authorization: authHeader,
      }),
    );

    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it("validates the maximum query before calling LINZ", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await POST(
      suggestionRequest("/api/internal/address-suggestions", "a".repeat(101), {
        Authorization: authHeader,
      }),
    );

    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it("bounds the normalized response to eight suggestions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    search.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        addressId: String(index + 1),
        fullAddress: `${index + 1} Bahari Drive, Auckland`,
      })),
    );

    const response = await POST(
      suggestionRequest("/api/internal/address-suggestions", "bahari", {
        Authorization: authHeader,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      suggestions: expect.arrayContaining([
        { addressId: "1", fullAddress: "1 Bahari Drive, Auckland" },
      ]),
    });
    expect(body.suggestions).toHaveLength(8);
  });

  it("maps provider failure to a safe response", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    search.mockRejectedValue(new Error("secret provider detail"));

    const response = await POST(
      suggestionRequest("/api/internal/address-suggestions", "bahari", {
        Authorization: authHeader,
      }),
    );

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain("secret provider detail");
    expect(text).not.toContain("https://");
  });
});
