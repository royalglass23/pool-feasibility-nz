import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public and Admin proxy boundary", () => {
  it("opens public pages and the dedicated public API without shared credentials", () => {
    vi.stubEnv("NODE_ENV", "production");

    const home = proxy(new NextRequest("https://pool.example/"));
    const propertyCheck = proxy(
      new NextRequest("https://pool.example/api/public/property-check", {
        method: "POST",
      }),
    );

    expect(home.headers.get("x-middleware-next")).toBe("1");
    expect(propertyCheck.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows sign-in and Admin routes to reach their server-side session checks", () => {
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

  it("keeps legacy internal endpoints behind the old deployment gate", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = proxy(
      new NextRequest("https://pool.example/api/internal/data-access", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ACCESS_CONTROL_MISCONFIGURED" },
    });
  });
});
