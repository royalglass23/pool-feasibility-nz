import { describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ info: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("pino", () => ({ default: () => logger }));

import {
  createLocalPublicRateLimiter,
  createPublicRateLimitedHandler,
} from "@/modules/rate-limit/public-rate-limit";

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
});
