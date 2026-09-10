import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { GET } from "@/app/api/internal/assessments/route";

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "unrelated=value", "rg_staff_session="])(
  "denies anonymous staff access without database configuration (cookie: %s)",
  async (cookie) => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL_DEV", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await GET(
      new Request("http://localhost/api/internal/assessments", {
        headers: cookie ? { cookie } : undefined,
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      error: { code: "STAFF_AUTH_REQUIRED" },
    });
  },
);
