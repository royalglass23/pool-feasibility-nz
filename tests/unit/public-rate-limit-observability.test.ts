import { afterEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ info: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("pino", () => ({ default: () => logger }));

import {
  createLocalPublicRateLimiter,
  createPublicRateLimitedHandler,
  createUpstashPublicRateLimiter,
} from "@/modules/rate-limit/public-rate-limit";

afterEach(() => {
  logger.info.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request() {
  return new Request("https://pool.example/api/public/assessments", {
    method: "POST",
    headers: {
      "x-correlation-id": "mt-257-observability",
      "x-vercel-forwarded-for": "203.0.113.77",
    },
  });
}

describe("public rate-limit observability", () => {
  it("logs allowed and rate-limited outcomes without the client IP or payload", async () => {
    const handler = createPublicRateLimitedHandler(
      "report_request",
      async () => new Response(null, { status: 201 }),
      { limiter: createLocalPublicRateLimiter() },
    );

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await handler(request());
    }

    expect(logger.info).toHaveBeenCalledWith({
      event: "public_rate_limit",
      action: "report_request",
      outcome: "allowed",
      correlationId: "mt-257-observability",
      status: 201,
    });
    expect(logger.info).toHaveBeenLastCalledWith({
      event: "public_rate_limit",
      action: "report_request",
      outcome: "rate_limited",
      correlationId: "mt-257-observability",
      status: 429,
    });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      "203.0.113.77",
    );
  });

  it("logs a safe, actionable reason when production configuration is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const handler = createPublicRateLimitedHandler(
      "report_request",
      async () => new Response(null, { status: 201 }),
    );

    const response = await handler(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "RATE_LIMIT_UNAVAILABLE",
        correlationId: "mt-257-observability",
      },
    });
    expect(logger.info).toHaveBeenLastCalledWith({
      event: "public_rate_limit",
      action: "report_request",
      outcome: "unavailable",
      reason: "configuration_missing",
      correlationId: "mt-257-observability",
      status: 503,
    });
  });

  it("distinguishes a managed-store timeout from other limiter failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const handler = createPublicRateLimitedHandler(
      "report_request",
      async () => new Response(null, { status: 201 }),
      {
        limiter: createUpstashPublicRateLimiter({
          url: "https://managed-rate-limit.example",
          token: "test-token",
          timeoutMs: 5,
        }),
      },
    );

    const response = await handler(request());

    expect(response.status).toBe(503);
    expect(logger.info).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: "unavailable",
        reason: "store_timeout",
        correlationId: "mt-257-observability",
      }),
    );
  });

  it.each([
    [
      "a missing trusted production client IP",
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        headers: { "x-correlation-id": "missing-ip-reference" },
      }),
      undefined,
      "client_ip_missing",
      "missing-ip-reference",
    ],
    [
      "an unclassified managed-store error",
      request(),
      { limit: vi.fn(async () => Promise.reject(new Error("store offline"))) },
      "store_error",
      "mt-257-observability",
    ],
  ] as const)(
    "logs %s without exposing the underlying exception",
    async (_case, rateLimitRequest, limiter, reason, correlationId) => {
      vi.stubEnv("NODE_ENV", "production");
      const handler = createPublicRateLimitedHandler(
        "report_request",
        async () => new Response(null, { status: 201 }),
        limiter ? { limiter } : undefined,
      );

      const response = await handler(rateLimitRequest);

      expect(response.status).toBe(503);
      expect(logger.info).toHaveBeenLastCalledWith({
        event: "public_rate_limit",
        action: "report_request",
        outcome: "unavailable",
        reason,
        correlationId,
        status: 503,
      });
      expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
        "store offline",
      );
    },
  );
});
