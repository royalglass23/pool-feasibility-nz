import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import pino from "pino";
import {
  apiErrorResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

export type PublicRateLimitAction =
  "property_check" | "property_check_stage" | "report_request";

type PublicRateLimitDecision = {
  success: boolean;
  remaining: number;
  reset: number;
};

export interface PublicRateLimiter {
  limit(
    action: PublicRateLimitAction,
    identifier: string,
  ): Promise<PublicRateLimitDecision>;
}

type PublicRateLimitLog = (event: {
  event: "public_rate_limit";
  action: PublicRateLimitAction;
  outcome: "allowed" | "rate_limited" | "unavailable";
  correlationId: string;
  status: number;
}) => void;

type PublicRateLimitRuntimeOptions = {
  limiter?: PublicRateLimiter;
  log?: PublicRateLimitLog;
};

const policies: Record<
  PublicRateLimitAction,
  { limit: number; windowMs: number }
> = {
  property_check: { limit: 10, windowMs: 30 * 60 * 1_000 },
  property_check_stage: { limit: 2, windowMs: 15 * 60 * 1_000 },
  report_request: { limit: 3, windowMs: 60 * 60 * 1_000 },
};
const logger = pino({ base: undefined });

export function createLocalPublicRateLimiter(input?: {
  now?: () => number;
}): PublicRateLimiter {
  const attempts = new Map<string, number[]>();
  const now = input?.now ?? Date.now;

  return {
    async limit(action, identifier) {
      const policy = policies[action];
      const currentTime = now();
      const cutoff = currentTime - policy.windowMs;
      const key = `${action}:${identifier}`;
      const active = (attempts.get(key) ?? []).filter(
        (timestamp) => timestamp > cutoff,
      );

      if (active.length >= policy.limit) {
        attempts.set(key, active);
        return {
          success: false,
          remaining: 0,
          reset: active[0]! + policy.windowMs,
        };
      }

      active.push(currentTime);
      attempts.set(key, active);
      return {
        success: true,
        remaining: policy.limit - active.length,
        reset: active[0]! + policy.windowMs,
      };
    },
  };
}

export function createUpstashPublicRateLimiter(input: {
  url: string;
  token: string;
  timeoutMs?: number;
}): PublicRateLimiter {
  const redis = new Redis({ url: input.url, token: input.token });
  const timeout = input.timeoutMs ?? 2_000;
  const limiters: Record<PublicRateLimitAction, Ratelimit> = {
    property_check: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "30 m"),
      prefix: "geomap:public-rate-limit:property-check:v1",
      analytics: false,
      timeout,
    }),
    property_check_stage: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(2, "15 m"),
      prefix: "geomap:public-rate-limit:property-check-stage:v1",
      analytics: false,
      timeout,
    }),
    report_request: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "geomap:public-rate-limit:report-request:v1",
      analytics: false,
      timeout,
    }),
  };

  return {
    async limit(action, identifier) {
      const result = await limiters[action].limit(identifier);
      if (result.reason === "timeout") {
        throw new Error("Managed public rate-limit store timed out.");
      }
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
      };
    },
  };
}

export function createPublicRateLimitedHandler(
  action: PublicRateLimitAction,
  next: (request: Request) => Promise<Response>,
  options?: PublicRateLimitRuntimeOptions,
): (request: Request) => Promise<Response> {
  const log = rateLimitLog(options);

  return async (request) => {
    const correlationId = requestCorrelationId(request);
    const denied = await publicRateLimitDeniedResponse(
      { request, action, correlationId },
      options,
    );
    if (denied) return denied;

    const response = await next(request);
    log({
      event: "public_rate_limit",
      action,
      outcome: "allowed",
      correlationId,
      status: response.status,
    });
    return response;
  };
}

export async function enforcePublicPropertyStageRateLimit(
  input: {
    request: Request;
    submissionId: string;
    correlationId: string;
  },
  options?: PublicRateLimitRuntimeOptions,
): Promise<Response | null> {
  return publicRateLimitDeniedResponse(
    {
      request: input.request,
      action: "property_check_stage",
      correlationId: input.correlationId,
      scope: input.submissionId,
    },
    options,
    true,
  );
}

async function publicRateLimitDeniedResponse(
  input: {
    request: Request;
    action: PublicRateLimitAction;
    correlationId: string;
    scope?: string;
  },
  options?: PublicRateLimitRuntimeOptions,
  logAllowed = false,
): Promise<Response | null> {
  const log = rateLimitLog(options);
  const clientIp = trustedClientIp(input.request);
  if (!clientIp) return unavailableResponseAndLog(input, log);

  let decision: PublicRateLimitDecision;
  try {
    const limiter = options?.limiter ?? configuredPublicRateLimiter();
    const identifier = input.scope ? `${clientIp}:${input.scope}` : clientIp;
    decision = await limiter.limit(input.action, hashClientIp(identifier));
  } catch {
    return unavailableResponseAndLog(input, log);
  }

  if (!decision.success) {
    const response = apiErrorResponse(
      { code: "RATE_LIMITED", message: "Please try again shortly." },
      429,
      input.correlationId,
      {
        "Cache-Control": "no-store",
        "Retry-After": String(
          Math.max(1, Math.ceil((decision.reset - Date.now()) / 1_000)),
        ),
      },
    );
    log({
      event: "public_rate_limit",
      action: input.action,
      outcome: "rate_limited",
      correlationId: input.correlationId,
      status: response.status,
    });
    return response;
  }

  if (logAllowed) {
    log({
      event: "public_rate_limit",
      action: input.action,
      outcome: "allowed",
      correlationId: input.correlationId,
      status: 200,
    });
  }
  return null;
}

function unavailableResponseAndLog(
  input: { action: PublicRateLimitAction; correlationId: string },
  log: PublicRateLimitLog,
): Response {
  const response = unavailableResponse(input.correlationId);
  log({
    event: "public_rate_limit",
    action: input.action,
    outcome: "unavailable",
    correlationId: input.correlationId,
    status: response.status,
  });
  return response;
}

function rateLimitLog(
  options?: PublicRateLimitRuntimeOptions,
): PublicRateLimitLog {
  return (
    options?.log ??
    ((event: Parameters<PublicRateLimitLog>[0]) => logger.info(event))
  );
}

let localDevelopmentLimiter: PublicRateLimiter | undefined;
let managedProductionLimiter: PublicRateLimiter | undefined;

function configuredPublicRateLimiter(): PublicRateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    managedProductionLimiter ??= createUpstashPublicRateLimiter({ url, token });
    return managedProductionLimiter;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Managed public rate-limit credentials are required.");
  }
  localDevelopmentLimiter ??= createLocalPublicRateLimiter();
  return localDevelopmentLimiter;
}

function trustedClientIp(request: Request): string | null {
  const vercelIp = firstValidIp(request.headers.get("x-vercel-forwarded-for"));
  if (vercelIp) return vercelIp;
  if (process.env.NODE_ENV === "production") return null;

  return firstValidIp(request.headers.get("x-forwarded-for")) ?? "127.0.0.1";
}

function firstValidIp(header: string | null): string | null {
  const candidate = header?.split(",", 1)[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

function hashClientIp(clientIp: string): string {
  return createHash("sha256").update(clientIp).digest("hex");
}

function unavailableResponse(correlationId: string): Response {
  return apiErrorResponse(
    { code: "TEMPORARILY_UNAVAILABLE", message: "Please try again shortly." },
    503,
    correlationId,
    { "Cache-Control": "no-store" },
  );
}
