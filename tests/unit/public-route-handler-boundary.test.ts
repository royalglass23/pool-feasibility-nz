import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/rate-limit/public-rate-limit", () => ({
  createPublicRateLimitedHandler: (
    _action: string,
    next: (request: Request) => Promise<Response>,
  ) => next,
  enforcePublicPropertyStageRateLimit: vi.fn(async () => null),
}));

import { POST as addressSuggestions } from "@/app/api/public/address-suggestions/route";
import { POST as aerialConflicts } from "@/app/api/public/aerial-conflicts/route";
import { GET as aerialTile } from "@/app/api/public/aerial/tiles/[z]/[x]/[y]/route";
import { POST as assessments } from "@/app/api/public/assessments/route";
import { POST as propertyCheck } from "@/app/api/public/property-check/route";
import { POST as propertyStages } from "@/app/api/public/property-check/stages/route";
import { POST as reportPdf } from "@/app/api/public/report/pdf/route";

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://pool.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const invalidPostRoutes = [
  [
    "address suggestions",
    addressSuggestions,
    "/api/public/address-suggestions",
    { query: "ab" },
  ],
  ["aerial conflicts", aerialConflicts, "/api/public/aerial-conflicts", {}],
  ["assessment submission", assessments, "/api/public/assessments", {}],
  ["property check", propertyCheck, "/api/public/property-check", {}],
  [
    "property stages",
    propertyStages,
    "/api/public/property-check/stages",
    {},
  ],
  ["PDF report", reportPdf, "/api/public/report/pdf", {}],
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("anonymous public adapters reach real bounded handlers", () => {
  it.each(invalidPostRoutes)(
    "returns application validation, not an auth challenge, for %s",
    async (_name, route, path, body) => {
      vi.stubEnv("NODE_ENV", "production");
      const response = await route(jsonRequest(path, body));

      expect(response.status).toBe(400);
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it("validates a public aerial tile before provider access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await aerialTile(
      new Request("https://pool.example/api/public/aerial/tiles/bad/0/0"),
      { params: Promise.resolve({ z: "bad", x: "0", y: "0" }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
