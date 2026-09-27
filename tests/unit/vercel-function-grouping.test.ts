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

describe("Vercel function grouping", () => {
  it("matches exactly the Chromium-dependent handlers with one shared configuration", () => {
    const configuredPatterns = Object.keys(vercelConfig.functions ?? {});
    const matchedRouteFiles = configuredPatterns.map((pattern) => {
      const unmatchedPattern = pattern
        .replaceAll("[[]", "")
        .replaceAll("[]]", "");
      expect(unmatchedPattern).not.toMatch(/[*?[\]{}]/);

      const routeFile = pattern.replaceAll("[[]", "[").replaceAll("[]]", "]");
      expect(existsSync(path.resolve(process.cwd(), routeFile))).toBe(true);
      return routeFile;
    });

    expect(configuredPatterns).toEqual(chromiumRoutePatterns);
    expect([...new Set(matchedRouteFiles)].sort()).toEqual(
      [...chromiumRouteFiles].sort(),
    );
    expect(
      Object.values(vercelConfig.functions ?? {}).map(
        ({ maxDuration }) => maxDuration,
      ),
    ).toEqual(chromiumRoutePatterns.map(() => 300));
    expect(matchedRouteFiles).not.toContain(
      "src/app/api/public/assessments/report/delivery/status/route.ts",
    );
  });
});
