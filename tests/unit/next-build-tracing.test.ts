// @vitest-environment node

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Vercel native package tracing", () => {
  it("packages only the Linux Sharp runtime files needed by public assessment saves", () => {
    const includes =
      nextConfig.outputFileTracingIncludes?.["/api/public/assessments"];

    expect(includes).toEqual([
      "./node_modules/@img/sharp-linux-x64/package.json",
      "./node_modules/@img/sharp-linux-x64/index.cjs",
      "./node_modules/@img/sharp-linux-x64/lib/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/package.json",
      "./node_modules/@img/sharp-libvips-linux-x64/versions.json",
      "./node_modules/@img/sharp-libvips-linux-x64/lib/**/*",
    ]);
    expect(includes).not.toContain("./node_modules/sharp/**/*");
  });
});
