import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/data-access/route";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/internal/data-access authorization", () => {
  it("rejects an unauthenticated deployed request before validating its body", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await POST(
      new Request("https://pool.example/api/internal/data-access", {
        method: "POST",
        headers: { "X-Correlation-ID": "test-correlation-401" },
        body: JSON.stringify({ address: "short" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="Royal Glass Pool Feasibility", charset="UTF-8"',
    );
    expect(response.headers.get("x-correlation-id")).toBe(
      "test-correlation-401",
    );
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Royal Glass staff access is required.",
        correlationId: "test-correlation-401",
      },
    });
  });

  it("allows valid deployed staff credentials to reach request validation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");

    const response = await POST(
      new Request("https://pool.example/api/internal/data-access", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`,
        },
        body: JSON.stringify({ address: "short" }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: "INVALID_ADDRESS", correlationId: expect.any(String) },
    });
    expect(response.headers.get("x-correlation-id")).toBe(
      body.error.correlationId,
    );
  });

  it("keeps loopback development testable without deployed credentials", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "");

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/data-access", {
        method: "POST",
        body: JSON.stringify({ address: "short" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_ADDRESS" },
    });
  });

  it("rejects an oversized request without echoing submitted content", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const submittedContent = "sensitive-address-data".repeat(120);
    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/data-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: submittedContent }),
      }),
    );

    expect(response.status).toBe(413);
    const responseText = await response.text();
    expect(responseText).not.toContain(submittedContent);
    expect(JSON.parse(responseText)).toMatchObject({
      error: {
        code: "REQUEST_TOO_LARGE",
        message: "The submitted request is too large.",
      },
    });
  });
});
