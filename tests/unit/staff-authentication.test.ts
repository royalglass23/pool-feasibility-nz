import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  attemptStaffSignIn,
  type StaffAuthenticationStore,
} from "@/modules/staff/staff-authentication";
import { hashStaffPassword } from "@/modules/staff/staff-password";

const NOW = new Date("2026-08-05T00:00:00.000Z");

describe("staff sign-in", () => {
  it("locks the Admin account server-side after five failed attempts for 15 minutes", async () => {
    const store = await createStore();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(
        attemptStaffSignIn(store, {
          username: "admin",
          password: "an incorrect password",
          now: NOW,
        }),
      ).resolves.toEqual({ outcome: "failed" });
    }

    await expect(
      attemptStaffSignIn(store, {
        username: "admin",
        password: "an incorrect password",
        now: NOW,
      }),
    ).resolves.toEqual({ outcome: "locked" });
    await expect(
      attemptStaffSignIn(store, {
        username: "admin",
        password: "correct staff password",
        now: new Date("2026-08-05T00:14:59.999Z"),
      }),
    ).resolves.toEqual({ outcome: "locked" });
    await expect(
      attemptStaffSignIn(store, {
        username: "admin",
        password: "correct staff password",
        now: new Date("2026-08-05T00:15:00.000Z"),
      }),
    ).resolves.toEqual({ outcome: "authenticated", sessionToken: "session-1" });
  });

  it("starts a fresh five-attempt window after an expired lock", async () => {
    const store = await createStore();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await attemptStaffSignIn(store, {
        username: "admin",
        password: "an incorrect password",
        now: NOW,
      });
    }

    await expect(
      attemptStaffSignIn(store, {
        username: "admin",
        password: "an incorrect password",
        now: new Date("2026-08-05T00:15:00.000Z"),
      }),
    ).resolves.toEqual({ outcome: "failed" });
  });
});

async function createStore(): Promise<StaffAuthenticationStore> {
  let failedAttemptCount = 0;
  let lockedUntil: Date | null = null;
  const passwordHash = await hashStaffPassword("correct staff password");

  return {
    async getAdminAccount() {
      return { id: "admin", username: "admin", passwordHash, lockedUntil };
    },
    async recordFailedSignIn(now) {
      if (lockedUntil && lockedUntil > now) return { locked: true };

      if (lockedUntil && lockedUntil <= now) {
        failedAttemptCount = 0;
        lockedUntil = null;
      }

      failedAttemptCount += 1;
      if (failedAttemptCount >= 5) {
        lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
        return { locked: true };
      }
      return { locked: false };
    },
    async completeSuccessfulSignIn(now) {
      if (lockedUntil && lockedUntil > now) return null;
      failedAttemptCount = 0;
      lockedUntil = null;
      return { sessionToken: "session-1" };
    },
  };
}
