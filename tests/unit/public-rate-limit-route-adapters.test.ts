import { afterEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => ({
  propertyCheck: vi.fn(async () => new Response(null, { status: 204 })),
  reportRequest: vi.fn(async () => new Response(null, { status: 204 })),
}));

vi.mock("server-only", () => ({}));
vi.mock(
  "@/modules/data-access-spike/handle-fast-property-view-request",
  () => ({ POST: handlers.propertyCheck }),
);
vi.mock("@/modules/assessment/handle-assessment-requests", () => ({
  POST: handlers.reportRequest,
}));

import { POST as propertyCheck } from "@/app/api/public/property-check/route";
import { POST as reportRequest } from "@/app/api/public/assessments/route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function request(path: string) {
  return new Request(`https://pool.example${path}`, {
    method: "POST",
    headers: { "x-vercel-forwarded-for": "203.0.113.10" },
  });
}

describe("public rate-limit route adapters", () => {
  it.each([
    [
      "Property Check",
      propertyCheck,
      handlers.propertyCheck,
      "/api/public/property-check",
    ],
    [
      "report request",
      reportRequest,
      handlers.reportRequest,
      "/api/public/assessments",
    ],
  ] as const)(
    "fails closed before %s downstream work when production protection is unavailable",
    async (_name, route, downstream, path) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const response = await route(request(path));

      expect(response.status).toBe(503);
      expect(downstream).not.toHaveBeenCalled();
    },
  );
});
