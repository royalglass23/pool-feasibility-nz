import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseStaffSignInInput } from "@/modules/staff/staff-sign-in-input";

describe("Staff sign-in input", () => {
  it("accepts bounded credentials", () => {
    expect(
      parseStaffSignInInput({ username: "admin", password: "a valid password" }),
    ).toEqual({ username: "admin", password: "a valid password" });
  });

  it("rejects oversized credentials before password hashing", () => {
    expect(
      parseStaffSignInInput({ username: "a".repeat(65), password: "a valid password" }),
    ).toBeNull();
    expect(
      parseStaffSignInInput({ username: "admin", password: "a".repeat(1025) }),
    ).toBeNull();
  });
});
