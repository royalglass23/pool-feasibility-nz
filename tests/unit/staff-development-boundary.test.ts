import { describe, expect, it } from "vitest";
import { isDevelopmentStaffAccessAllowed } from "@/modules/staff/development-staff-access";

describe("development-only staff access boundary", () => {
  it("allows local development and tests but fails closed in production", () => {
    expect(isDevelopmentStaffAccessAllowed({ NODE_ENV: "development" })).toBe(
      true,
    );
    expect(isDevelopmentStaffAccessAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(isDevelopmentStaffAccessAllowed({ NODE_ENV: "production" })).toBe(
      false,
    );
    expect(isDevelopmentStaffAccessAllowed({})).toBe(false);
  });
});
