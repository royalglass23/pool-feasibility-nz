import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export function proxy(request: NextRequest): Response {
  const access = authorizeInternalRequest(request);
  return access.allowed
    ? NextResponse.next()
    : internalAccessDeniedResponse(access, requestCorrelationId(request));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
