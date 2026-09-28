// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const vercelConfig = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8"),
) as {
  functions?: Record<string, { maxDuration?: number }>;
};

const chromiumRoutePatterns = [
  "src/app/api/internal/assessments/[[]id[]]/report/route.ts",
  "src/app/api/internal/report/pdf/route.ts",
  "src/app/api/public/assessments/route.ts",
  "src/app/api/public/assessments/report/delivery/route.ts",
  "src/app/api/public/assessments/report/pdf/route.ts",
  "src/app/api/public/report/pdf/route.ts",
];

const chromiumRouteFiles = [
  "src/app/api/internal/assessments/[id]/report/route.ts",
  "src/app/api/internal/report/pdf/route.ts",
  "src/app/api/public/assessments/route.ts",
  "src/app/api/public/assessments/report/delivery/route.ts",
  "src/app/api/public/assessments/report/pdf/route.ts",
  "src/app/api/public/report/pdf/route.ts",
];
const linzRefreshRoutePattern =
  "src/app/api/cron/linz-address-refresh/route.ts";

describe("Vercel function grouping", () => {
  it("gives the LINZ refresh cron an explicit runtime budget", () => {
    expect(vercelConfig.functions?.[linzRefreshRoutePattern]).toEqual({
      maxDuration: 300,
    });
  });

  it("matches the Chromium-dependent handlers with one shared configuration", () => {
    expect(Object.keys(vercelConfig.functions ?? {})).toEqual([
      ...chromiumRoutePatterns,
      linzRefreshRoutePattern,
    ]);
    const matchedRouteFiles = chromiumRoutePatterns.map((pattern) => {
      expect(vercelConfig.functions?.[pattern]).toEqual({ maxDuration: 300 });
      const unmatchedPattern = pattern
        .replaceAll("[[]", "")
        .replaceAll("[]]", "");
      expect(unmatchedPattern).not.toMatch(/[*?[\]{}]/);

      const routeFile = pattern.replaceAll("[[]", "[").replaceAll("[]]", "]");
      expect(existsSync(path.resolve(process.cwd(), routeFile))).toBe(true);
      return routeFile;
    });

    expect([...new Set(matchedRouteFiles)].sort()).toEqual(
      [...chromiumRouteFiles].sort(),
    );
    expect(matchedRouteFiles).not.toContain(
      "src/app/api/public/assessments/report/delivery/status/route.ts",
    );
  });
});
