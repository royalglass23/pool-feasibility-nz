// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const buildDirectories: string[] = [];
const chromiumFile =
  "../../../../../../node_modules/@sparticuz/chromium/bin/chromium.br";

const tracedRoutes = [
  "server/app/api/internal/assessments/[id]/report/route.js.nft.json",
  "server/app/api/public/assessments/route.js.nft.json",
  "server/app/api/public/assessments/report/delivery/status/route.js.nft.json",
  "server/app/api/public/assessments/report/delivery/route.js.nft.json",
  "server/app/api/internal/report/pdf/route.js.nft.json",
  "server/app/api/public/report/pdf/route.js.nft.json",
  "server/app/api/public/assessments/report/pdf/route.js.nft.json",
];

afterEach(() => {
  for (const directory of buildDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Next.js build tracing regression checker", () => {
  it("rejects a build when the public assessment save route loses Chromium", () => {
    const buildDirectory = mkdtempSync(
      path.join(tmpdir(), "poolready-build-tracing-"),
    );
    buildDirectories.push(buildDirectory);

    for (const trace of tracedRoutes) {
      const tracePath = path.join(buildDirectory, ...trace.split("/"));
      mkdirSync(path.dirname(tracePath), { recursive: true });
      const shouldIncludeChromium =
        !trace.includes("/public/assessments/route.js.nft.json") &&
        !trace.includes("/delivery/status/");
      writeFileSync(
        tracePath,
        JSON.stringify({ files: shouldIncludeChromium ? [chromiumFile] : [] }),
      );
    }

    const result = spawnSync(
      process.execPath,
      ["scripts/check-next-build-tracing.mjs", buildDirectory],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "/api/public/assessments: expected Chromium binaries to be present",
    );
  });
});
