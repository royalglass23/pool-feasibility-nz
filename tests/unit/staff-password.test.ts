import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hashStaffPassword,
  verifyStaffPassword,
} from "@/modules/staff/staff-password";

describe("staff password hashing", () => {
  it("accepts a 14-character password and verifies it without retaining the password", async () => {
    const password = "correct horse 254";

    const hash = await hashStaffPassword(password);

    expect(hash).toContain("scrypt$16384$8$5$");
    expect(hash).not.toContain(password);
    await expect(verifyStaffPassword(password, hash)).resolves.toBe(true);
    await expect(verifyStaffPassword("incorrect password", hash)).resolves.toBe(
      false,
    );
  });

  it("rejects passwords shorter than 14 characters", async () => {
    await expect(hashStaffPassword("too-short-123")).rejects.toThrow(
      "at least 14 characters",
    );
  });
});
