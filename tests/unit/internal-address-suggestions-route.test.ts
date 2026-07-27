import { afterEach, describe, expect, it, vi } from "vitest";

const suggestAddresses = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/modules/providers/official-gis-gateway", () => ({
  OfficialGisGateway: class {
    suggestAddresses = suggestAddresses;
  },
}));

import { GET } from "@/app/api/internal/address-suggestions/route";

const authHeader = `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`;

afterEach(() => {
  suggestAddresses.mockReset();
  vi.unstubAllEnvs();
});

describe("GET /api/internal/address-suggestions", () => {
  it("requires the existing login boundary", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await GET(
      new Request("https://pool.example/api/internal/address-suggestions?q=42"),
    );

    expect(response.status).toBe(401);
    expect(suggestAddresses).not.toHaveBeenCalled();
  });

  it("validates the minimum query before calling LINZ", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await GET(
      new Request("https://pool.example/api/internal/address-suggestions?q=ab", {
        headers: { Authorization: authHeader },
      }),
    );

    expect(response.status).toBe(400);
    expect(suggestAddresses).not.toHaveBeenCalled();
  });

  it("validates the maximum query before calling LINZ", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await GET(
      new Request(
        `https://pool.example/api/internal/address-suggestions?q=${"a".repeat(101)}`,
        { headers: { Authorization: authHeader } },
      ),
    );

    expect(response.status).toBe(400);
    expect(suggestAddresses).not.toHaveBeenCalled();
  });

  it("bounds the normalized response to eight suggestions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    suggestAddresses.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        addressId: String(index + 1),
        fullAddress: `${index + 1} Bahari Drive, Auckland`,
      })),
    );

    const response = await GET(
      new Request("https://pool.example/api/internal/address-suggestions?q=bahari", {
        headers: { Authorization: authHeader },
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
    suggestAddresses.mockRejectedValue(new Error("secret provider detail"));

    const response = await GET(
      new Request("https://pool.example/api/internal/address-suggestions?q=bahari", {
        headers: { Authorization: authHeader },
      }),
    );

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain("secret provider detail");
    expect(text).not.toContain("https://");
  });
});
