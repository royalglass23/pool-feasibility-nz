import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createLocalPublicRateLimiter,
  createPublicRateLimitedHandler,
  createUpstashPublicRateLimiter,
  enforcePublicPropertyStageRateLimit,
} from "@/modules/rate-limit/public-rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(path = "/api/public/property-check", ip = "203.0.113.10") {
  return new Request(`https://pool.example${path}`, {
    method: "POST",
    headers: { "x-vercel-forwarded-for": ip },
  });
}

describe("public Property Check rate limit", () => {
  it("allows the tenth attempt, denies the eleventh, and resets after 30 minutes", async () => {
    let now = Date.parse("2026-08-05T00:00:00.000Z");
    const next = vi.fn(async () => Response.json({ ok: true }));
    const handler = createPublicRateLimitedHandler("property_check", next, {
      limiter: createLocalPublicRateLimiter({ now: () => now }),
      log: vi.fn(),
    });

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await handler(request());
      expect(response.status, `attempt ${attempt}`).toBe(200);
    }

    const denied = await handler(request());
    expect(denied.status).toBe(429);
    expect(await denied.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "Please try again shortly.",
      },
    });
    expect(next).toHaveBeenCalledTimes(10);

    now += 30 * 60 * 1_000;
    const afterExpiry = await handler(request());
    expect(afterExpiry.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(11);
  });

  it("keeps limits independent per client IP and public action", async () => {
    const limiter = createLocalPublicRateLimiter();
    const next = vi.fn(async () => Response.json({ ok: true }));
    const propertyCheck = createPublicRateLimitedHandler(
      "property_check",
      next,
      { limiter, log: vi.fn() },
    );
    const reportRequest = createPublicRateLimitedHandler(
      "report_request",
      next,
      { limiter, log: vi.fn() },
    );

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await propertyCheck(request())).status).toBe(200);
    }
    expect((await propertyCheck(request())).status).toBe(429);
    expect(
      (
        await propertyCheck(
          request("/api/public/property-check", "198.51.100.20"),
        )
      ).status,
    ).toBe(200);
    expect(
      (await reportRequest(request("/api/public/assessments"))).status,
    ).toBe(200);
  });
});

describe("public report-request rate limit", () => {
  it("allows the third attempt, denies the fourth, and resets after one hour", async () => {
    let now = Date.parse("2026-08-05T00:00:00.000Z");
    const next = vi.fn(async () => Response.json({ ok: true }));
    const handler = createPublicRateLimitedHandler("report_request", next, {
      limiter: createLocalPublicRateLimiter({ now: () => now }),
      log: vi.fn(),
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await handler(request("/api/public/assessments"));
      expect(response.status, `attempt ${attempt}`).toBe(200);
    }

    const denied = await handler(request("/api/public/assessments"));
    expect(denied.status).toBe(429);
    expect(await denied.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "Please try again shortly.",
      },
    });
    expect(next).toHaveBeenCalledTimes(3);

    now += 60 * 60 * 1_000;
    const afterExpiry = await handler(request("/api/public/assessments"));
    expect(afterExpiry.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(4);
  });
});

describe("public Property Check stage allowance", () => {
  it("allows two provider stages per signed session and denies a replay", async () => {
    const limiter = createLocalPublicRateLimiter();
    const options = { limiter, log: vi.fn() };
    const input = {
      request: request("/api/public/property-check/stages"),
      submissionId: "signed-property-check-session",
      correlationId: "mt-257-stage-limit",
    };

    await expect(
      enforcePublicPropertyStageRateLimit(input, options),
    ).resolves.toBeNull();
    await expect(
      enforcePublicPropertyStageRateLimit(input, options),
    ).resolves.toBeNull();

    const denied = await enforcePublicPropertyStageRateLimit(input, options);
    expect(denied?.status).toBe(429);
    await expect(denied?.json()).resolves.toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "Please try again shortly.",
      },
    });

    await expect(
      enforcePublicPropertyStageRateLimit(
        { ...input, submissionId: "another-signed-session" },
        options,
      ),
    ).resolves.toBeNull();
  });
});

describe("public rate-limit deployment configuration", () => {
  it("fails closed before downstream work when production store credentials are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const next = vi.fn(async () => Response.json({ ok: true }));
    const handler = createPublicRateLimitedHandler("property_check", next);

    const response = await handler(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed before downstream work when the managed store times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const next = vi.fn(async () => Response.json({ ok: true }));
    const handler = createPublicRateLimitedHandler("property_check", next, {
      limiter: createUpstashPublicRateLimiter({
        url: "https://managed-rate-limit.example",
        token: "test-token",
        timeoutMs: 5,
      }),
      log: vi.fn(),
    });

    const response = await handler(request());

    expect(response.status).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("uses an enforcing local fallback only during development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const next = vi.fn(async () => Response.json({ ok: true }));
    const handler = createPublicRateLimitedHandler("property_check", next);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await handler(
        new Request("http://localhost:3000/api/public/property-check", {
          method: "POST",
        }),
      );
      expect(response.status, `attempt ${attempt}`).toBe(200);
    }

    const denied = await handler(
      new Request("http://localhost:3000/api/public/property-check", {
        method: "POST",
      }),
    );
    expect(denied.status).toBe(429);
    expect(next).toHaveBeenCalledTimes(10);
  });
});
