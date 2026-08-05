import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prepareStaffAdminProvisioning } from "@/modules/staff/staff-admin-bootstrap";
import { verifyStaffPassword } from "@/modules/staff/staff-password";

describe("Staff Admin bootstrap", () => {
  it("normalizes the provisioned username and passes only a password hash to persistence", async () => {
    const provision = vi.fn().mockResolvedValue(undefined);

    await prepareStaffAdminProvisioning({
      username: "  RoyalGlassAdmin ",
      password: "a fourteen char password",
      passwordConfirmation: "a fourteen char password",
      provision,
    });

    expect(provision).toHaveBeenCalledOnce();
    const [input] = provision.mock.calls[0]!;
    expect(input.username).toBe("royalglassadmin");
    expect(input.passwordHash).not.toContain("a fourteen char password");
    await expect(
      verifyStaffPassword("a fourteen char password", input.passwordHash),
    ).resolves.toBe(true);
  });

  it("rejects a confirmation that does not match the password", async () => {
    await expect(
      prepareStaffAdminProvisioning({
        username: "admin",
        password: "a fourteen char password",
        passwordConfirmation: "a different password",
        provision: vi.fn(),
      }),
    ).rejects.toThrow("do not match");
  });
});
