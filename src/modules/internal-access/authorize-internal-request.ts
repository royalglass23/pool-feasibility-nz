import { timingSafeEqual } from "node:crypto";
import { apiErrorResponse } from "@/shared/http/api-response";

export type InternalAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 401 | 503;
      code: "UNAUTHORIZED" | "ACCESS_CONTROL_MISCONFIGURED";
      message: string;
      challenge: boolean;
    };

export function authorizeInternalRequest(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): InternalAccessDecision {
  if (isLoopbackDevelopment(request, environment)) {
    return { allowed: true };
  }

  const expectedUsername = environment.INTERNAL_ACCESS_USERNAME;
  const expectedPassword = environment.INTERNAL_ACCESS_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return {
      allowed: false,
      status: 503,
      code: "ACCESS_CONTROL_MISCONFIGURED",
      message: "Internal access control is not configured.",
      challenge: false,
    };
  }

  const supplied = readBasicCredentials(request.headers.get("authorization"));
  if (
    !supplied ||
    !constantTimeEqual(supplied.username, expectedUsername) ||
    !constantTimeEqual(supplied.password, expectedPassword)
  ) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Royal Glass staff access is required.",
      challenge: true,
    };
  }

  return { allowed: true };
}

export function internalAccessDeniedResponse(
  decision: Exclude<InternalAccessDecision, { allowed: true }>,
  correlationId: string,
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  if (decision.challenge) {
    headers.set(
      "WWW-Authenticate",
      'Basic realm="Royal Glass Pool Feasibility", charset="UTF-8"',
    );
  }

  return apiErrorResponse(
    { code: decision.code, message: decision.message },
    decision.status,
    correlationId,
    headers,
  );
}

function isLoopbackDevelopment(
  request: Request,
  environment: NodeJS.ProcessEnv,
): boolean {
  if (environment.NODE_ENV !== "development") return false;

  const hostname = new URL(request.url).hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function readBasicCredentials(
  authorization: string | null,
): { username: string; password: string } | null {
  if (!authorization?.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString(
      "utf8",
    );
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}
