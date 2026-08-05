import "server-only";

import { timingSafeEqual } from "node:crypto";
import { verifyStaffPassword } from "@/modules/staff/staff-password";

const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$5$p1lXlt45BHhuFBhCiSel3A$mTvvafpyMnw-Zlp_7AZhTwBE0TMk-OWzCljetahmWNIHu4Vz-1HpvgnI_fr7meRONxl_deTYqf07xkXBs-0j2g";

export type StaffAuthenticationStore = {
  getAdminAccount(): Promise<{
    id: string;
    username: string;
    passwordHash: string;
    lockedUntil: Date | null;
  } | null>;
  recordFailedSignIn(now: Date): Promise<{ locked: boolean }>;
  completeSuccessfulSignIn(now: Date): Promise<{ sessionToken: string } | null>;
};

export type StaffSignInResult =
  | { outcome: "authenticated"; sessionToken: string }
  | { outcome: "failed" }
  | { outcome: "locked" };

export async function attemptStaffSignIn(
  store: StaffAuthenticationStore,
  input: { username: string; password: string; now: Date },
): Promise<StaffSignInResult> {
  const account = await store.getAdminAccount();
  if (account?.lockedUntil && account.lockedUntil > input.now) {
    return { outcome: "locked" };
  }

  const passwordMatches = await verifyStaffPassword(
    input.password,
    account?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!account || !passwordMatches || !safeUsernameEqual(input.username, account.username)) {
    const failure = await store.recordFailedSignIn(input.now);
    return failure.locked ? { outcome: "locked" } : { outcome: "failed" };
  }

  const session = await store.completeSuccessfulSignIn(input.now);
  return session
    ? { outcome: "authenticated", sessionToken: session.sessionToken }
    : { outcome: "locked" };
}

function safeUsernameEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(normalizeStaffUsername(actual));
  const expectedBytes = Buffer.from(normalizeStaffUsername(expected));
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export function normalizeStaffUsername(username: string): string {
  return username.trim().toLowerCase();
}
