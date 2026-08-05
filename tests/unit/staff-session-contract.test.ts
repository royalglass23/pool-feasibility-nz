import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { staffSessionCookieOptions } from "@/modules/staff/staff-session";

describe("Staff session cookie contract", () => {
  it("uses an HttpOnly, SameSite session cookie with an eight-hour maximum lifetime", () => {
    expect(staffSessionCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      maxAge: 28_800,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
    expect(staffSessionCookieOptions({ NODE_ENV: "development" }).secure).toBe(
      false,
    );
  });
});
