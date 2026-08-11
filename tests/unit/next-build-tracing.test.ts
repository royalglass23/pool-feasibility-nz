// @vitest-environment node

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Vercel native package tracing", () => {
  it("packages the native runtimes needed by public assessment saves and saved-report delivery", () => {
    const assessmentIncludes =
      nextConfig.outputFileTracingIncludes?.["/api/public/assessments"];
    const savedReportIncludes =
      nextConfig.outputFileTracingIncludes?.[
        "/api/public/assessments/report/*"
      ];

    expect(assessmentIncludes).toEqual([
      "./node_modules/@img/sharp-linux-x64/package.json",
      "./node_modules/@img/sharp-linux-x64/index.cjs",
      "./node_modules/@img/sharp-linux-x64/lib/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/package.json",
      "./node_modules/@img/sharp-libvips-linux-x64/versions.json",
      "./node_modules/@img/sharp-libvips-linux-x64/lib/**/*",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ]);
    expect(assessmentIncludes).not.toContain("./node_modules/sharp/**/*");
    expect(savedReportIncludes).toEqual([
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ]);
  });
});
