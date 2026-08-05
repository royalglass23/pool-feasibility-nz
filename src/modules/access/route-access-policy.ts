export type RouteAccess = "public" | "admin_session" | "legacy_internal";

export function classifyRouteAccess(pathname: string): RouteAccess {
  if (
    pathname === "/staff" ||
    pathname.startsWith("/staff/") ||
    pathname === "/api/internal/assessments" ||
    pathname.startsWith("/api/internal/assessments/")
  ) {
    return "admin_session";
  }

  return pathname.startsWith("/api/internal/")
    ? "legacy_internal"
    : "public";
}
