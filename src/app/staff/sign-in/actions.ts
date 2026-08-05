"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  createStaffAuthenticationStore,
  invalidateStaffSession,
  staffSessionConfig,
} from "@/db/repositories/staff-auth-repository";
import { attemptStaffSignIn } from "@/modules/staff/staff-authentication";
import { parseStaffSignInInput } from "@/modules/staff/staff-sign-in-input";
import { staffSessionCookieOptions } from "@/modules/staff/staff-session";

export async function signInStaffAdmin(formData: FormData): Promise<never> {
  const username = readField(formData, "username");
  const password = readField(formData, "password");
  const input = parseStaffSignInInput({ username, password });
  if (!input) redirect("/staff/sign-in?error=1");

  const result = await attemptStaffSignIn(
    createStaffAuthenticationStore(getDb()),
    { ...input, now: new Date() },
  );
  if (result.outcome !== "authenticated") {
    redirect("/staff/sign-in?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    staffSessionConfig.cookieName,
    result.sessionToken,
    staffSessionCookieOptions(),
  );
  redirect("/staff");
}

export async function signOutStaffAdmin(): Promise<never> {
  const cookieStore = await cookies();
  await invalidateStaffSession(
    getDb(),
    cookieStore.get(staffSessionConfig.cookieName)?.value,
  );
  cookieStore.delete(staffSessionConfig.cookieName);
  redirect("/staff/sign-in");
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
