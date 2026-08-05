import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import type { StaffAuthenticationStore } from "@/modules/staff/staff-authentication";

type Database = NeonHttpDatabase<typeof schema>;

const ADMIN_ACCOUNT_ID = 1;
const LOCKOUT_AFTER_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1_000;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1_000;

export function createStaffAuthenticationStore(
  db: Database,
): StaffAuthenticationStore {
  return {
    getAdminAccount: async () => {
      const account = await db.query.staffAdminAccounts.findFirst({
        where: eq(schema.staffAdminAccounts.id, ADMIN_ACCOUNT_ID),
      });
      if (!account) return null;
      return {
        id: String(account.id),
        username: account.username,
        passwordHash: account.passwordHash,
        lockedUntil: account.lockedUntil,
      };
    },
    recordFailedSignIn: async (now) => {
      const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      const nextFailedSignInCount = sql<number>`case when ${schema.staffAdminAccounts.lockedUntil} is not null and ${schema.staffAdminAccounts.lockedUntil} <= ${now} then 1 else ${schema.staffAdminAccounts.failedSignInCount} + 1 end`;
      const [account] = await db
        .update(schema.staffAdminAccounts)
        .set({
          failedSignInCount: nextFailedSignInCount,
          lockedUntil: sql`case when ${nextFailedSignInCount} >= ${LOCKOUT_AFTER_FAILED_ATTEMPTS} then ${lockedUntil}::timestamptz else null::timestamptz end`,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.staffAdminAccounts.id, ADMIN_ACCOUNT_ID),
            or(
              isNull(schema.staffAdminAccounts.lockedUntil),
              lte(schema.staffAdminAccounts.lockedUntil, now),
            ),
          ),
        )
        .returning({ lockedUntil: schema.staffAdminAccounts.lockedUntil });
      return { locked: !account || account.lockedUntil !== null };
    },
    completeSuccessfulSignIn: async (now) => {
      const [account] = await db
        .update(schema.staffAdminAccounts)
        .set({
          failedSignInCount: 0,
          lockedUntil: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.staffAdminAccounts.id, ADMIN_ACCOUNT_ID),
            or(
              isNull(schema.staffAdminAccounts.lockedUntil),
              lte(schema.staffAdminAccounts.lockedUntil, now),
            ),
          ),
        )
        .returning({ id: schema.staffAdminAccounts.id });
      if (!account) return null;

      const sessionToken = randomBytes(32).toString("base64url");
      await db.insert(schema.staffSessions).values({
        id: randomUUID(),
        adminAccountId: account.id,
        tokenHash: hashStaffSessionToken(sessionToken),
        expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      });
      return { sessionToken };
    },
  };
}

export async function hasActiveStaffSession(
  db: Database,
  sessionToken: string | undefined,
  now: Date = new Date(),
): Promise<boolean> {
  if (!sessionToken) return false;

  const session = await db.query.staffSessions.findFirst({
    columns: { id: true },
    where: and(
      eq(schema.staffSessions.tokenHash, hashStaffSessionToken(sessionToken)),
      gt(schema.staffSessions.expiresAt, now),
    ),
  });
  return Boolean(session);
}

export async function invalidateStaffSession(
  db: Database,
  sessionToken: string | undefined,
): Promise<void> {
  if (!sessionToken) return;
  await db
    .delete(schema.staffSessions)
    .where(eq(schema.staffSessions.tokenHash, hashStaffSessionToken(sessionToken)));
}

export async function provisionStaffAdmin(
  db: Database,
  input: { username: string; passwordHash: string },
): Promise<void> {
  const [account] = await db
    .insert(schema.staffAdminAccounts)
    .values({
      id: ADMIN_ACCOUNT_ID,
      username: input.username,
      passwordHash: input.passwordHash,
    })
    .onConflictDoNothing()
    .returning({ id: schema.staffAdminAccounts.id });
  if (!account) {
    throw new Error("The Staff Admin account is already provisioned.");
  }
}

export async function resetStaffAdminPassword(
  db: Database,
  passwordHash: string,
): Promise<void> {
  const [account] = await db
    .update(schema.staffAdminAccounts)
    .set({
      passwordHash,
      failedSignInCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.staffAdminAccounts.id, ADMIN_ACCOUNT_ID))
    .returning({ id: schema.staffAdminAccounts.id });
  if (!account) {
    throw new Error("The Staff Admin account has not been provisioned.");
  }
  await db
    .delete(schema.staffSessions)
    .where(eq(schema.staffSessions.adminAccountId, account.id));
}

export function hashStaffSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("base64url");
}

export const staffSessionConfig = {
  cookieName: "rg_staff_session",
  maxAgeSeconds: SESSION_DURATION_MS / 1_000,
} as const;
