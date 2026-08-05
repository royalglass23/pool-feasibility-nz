import "server-only";

import { getDb } from "@/db/client";
import {
  hasActiveStaffSession,
  staffSessionConfig,
} from "@/db/repositories/staff-auth-repository";
import { apiErrorResponse } from "@/shared/http/api-response";

export { staffSessionConfig };

export async function hasAuthenticatedStaffSession(
  request: Request,
): Promise<boolean> {
  return hasAuthenticatedStaffSessionToken(readStaffSessionToken(request));
}

export async function hasAuthenticatedStaffSessionToken(
  sessionToken: string | undefined,
): Promise<boolean> {
  return hasActiveStaffSession(getDb(), sessionToken);
}

export function readStaffSessionToken(request: Request): string | undefined {
  return readCookie(request.headers.get("cookie"), staffSessionConfig.cookieName);
}

export function staffSessionCookieOptions(
  environment: { NODE_ENV?: string } = process.env,
) {
  return {
    httpOnly: true,
    secure: environment.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: staffSessionConfig.maxAgeSeconds,
    path: "/",
  };
}

export async function staffSessionDeniedResponse(
  request: Request,
  correlationId: string,
): Promise<Response | null> {
  if (await hasAuthenticatedStaffSession(request)) return null;
  return apiErrorResponse(
    { code: "STAFF_AUTH_REQUIRED", message: "Staff sign-in is required." },
    401,
    correlationId,
    { "Cache-Control": "no-store" },
  );
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=") || undefined;
  }
  return undefined;
}
