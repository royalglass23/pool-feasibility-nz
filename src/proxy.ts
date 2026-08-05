import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export function proxy(request: NextRequest): Response {
  if (usesStaffSessionBoundary(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const access = authorizeInternalRequest(request);
  return access.allowed
    ? NextResponse.next()
    : internalAccessDeniedResponse(access, requestCorrelationId(request));
}

function usesStaffSessionBoundary(pathname: string): boolean {
  return (
    pathname === "/staff" ||
    pathname.startsWith("/staff/") ||
    pathname === "/api/internal/assessments" ||
    pathname.startsWith("/api/internal/assessments/")
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
