import "server-only";

import { hashStaffPassword } from "@/modules/staff/staff-password";
import { normalizeStaffUsername } from "@/modules/staff/staff-authentication";

const STAFF_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;

export async function prepareStaffAdminProvisioning(input: {
  username: string;
  password: string;
  passwordConfirmation: string;
  provision: (admin: {
    username: string;
    passwordHash: string;
  }) => Promise<void>;
}): Promise<void> {
  if (input.password !== input.passwordConfirmation) {
    throw new Error("The Staff Admin passwords do not match.");
  }

  const username = normalizeStaffUsername(input.username);
  if (!STAFF_USERNAME_PATTERN.test(username)) {
    throw new Error(
      "The Staff Admin username must be 3-64 lowercase letters, numbers, dots, hyphens, or underscores.",
    );
  }

  await input.provision({
    username,
    passwordHash: await hashStaffPassword(input.password),
  });
}
