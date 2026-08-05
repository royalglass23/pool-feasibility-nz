import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("staff proxy boundary", () => {
  it("allows the Staff sign-in and session-protected report routes to reach their session checks", () => {
    vi.stubEnv("NODE_ENV", "production");

    const signIn = proxy(new NextRequest("https://pool.example/staff/sign-in"));
    const savedReport = proxy(
      new NextRequest(
        "https://pool.example/api/internal/assessments/assessment-1/report",
      ),
    );

    expect(signIn.headers.get("x-middleware-next")).toBe("1");
    expect(savedReport.headers.get("x-middleware-next")).toBe("1");
  });
});
