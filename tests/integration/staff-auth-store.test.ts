import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import * as schema from "@/db/schema";
import {
  createStaffAuthenticationStore,
  hasActiveStaffSession,
  invalidateStaffSession,
  provisionStaffAdmin,
} from "@/db/repositories/staff-auth-repository";
import { attemptStaffSignIn } from "@/modules/staff/staff-authentication";
import { hashStaffPassword } from "@/modules/staff/staff-password";

const databaseUrl = process.env.MT254_DATABASE_URL;
const isolatedDatabaseSentinel = process.env.MT254_DATABASE_SENTINEL;
const REQUIRED_ISOLATED_DATABASE_SENTINEL = "geomap-mt254-isolated";

describe.skipIf(
  !databaseUrl ||
    isolatedDatabaseSentinel !== REQUIRED_ISOLATED_DATABASE_SENTINEL,
)(
  "Staff Admin authentication store",
  { timeout: 30_000 },
  () => {
    it("enforces lockout, session expiry, and server-side sign-out", async () => {
      const db = drizzle(neon(databaseUrl!), { schema });
      const now = new Date("2026-08-05T00:00:00.000Z");

      const existingAccount = await db.query.staffAdminAccounts.findFirst({
        columns: { id: true },
      });
      if (existingAccount) {
        throw new Error(
          "MT254_DATABASE_URL must point to an empty isolated authentication database.",
        );
      }
      try {
        await provisionStaffAdmin(db, {
          username: "admin",
          passwordHash: await hashStaffPassword("correct staff password"),
        });
        const store = createStaffAuthenticationStore(db);

        for (let attempt = 1; attempt <= 4; attempt += 1) {
          await expect(
            attemptStaffSignIn(store, {
              username: "admin",
              password: "an incorrect password",
              now,
            }),
          ).resolves.toEqual({ outcome: "failed" });
        }
        await expect(
          attemptStaffSignIn(store, {
            username: "admin",
            password: "an incorrect password",
            now,
          }),
        ).resolves.toEqual({ outcome: "locked" });

        const signedIn = await attemptStaffSignIn(store, {
          username: "admin",
          password: "correct staff password",
          now: new Date("2026-08-05T00:15:00.000Z"),
        });
        expect(signedIn.outcome).toBe("authenticated");
        if (signedIn.outcome !== "authenticated") return;

        await expect(
          hasActiveStaffSession(db, signedIn.sessionToken, now),
        ).resolves.toBe(true);
        await expect(
          hasActiveStaffSession(
            db,
            signedIn.sessionToken,
            new Date("2026-08-05T08:15:00.000Z"),
          ),
        ).resolves.toBe(false);
        await invalidateStaffSession(db, signedIn.sessionToken);
        await expect(
          hasActiveStaffSession(db, signedIn.sessionToken, now),
        ).resolves.toBe(false);
      } finally {
        await db
          .delete(schema.staffSessions)
          .where(eq(schema.staffSessions.adminAccountId, 1));
        await db
          .delete(schema.staffAdminAccounts)
          .where(eq(schema.staffAdminAccounts.id, 1));
      }
    });
  },
);
