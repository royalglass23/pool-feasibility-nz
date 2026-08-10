// @vitest-environment node

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Vercel native package tracing", () => {
  it("packages the Linux Sharp runtime for public assessment saves", () => {
    expect(
      nextConfig.outputFileTracingIncludes?.["/api/public/assessments"],
    ).toEqual(
      expect.arrayContaining([
        "./node_modules/sharp/**/*",
        "./node_modules/@img/sharp-linux-x64/**/*",
        "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      ]),
    );
  });
});
