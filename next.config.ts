import type { NextConfig } from "next";
import { isSiteIndexingEnabled } from "./src/config/site-indexing";

const CHROMIUM_BINARY_GLOB = "./node_modules/@sparticuz/chromium/bin/**/*";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    if (isSiteIndexingEnabled()) return [];

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    // This Next 16 App Router build requires `/route`-suffixed trace keys to
    // scope includes to one handler. Broader request-path keys also match
    // descendants such as `delivery/status`; test:build-tracing verifies the
    // emitted .nft.json files so Chromium does not leak into unrelated routes.
    "/api/internal/report/pdf/route": [CHROMIUM_BINARY_GLOB],
    "/api/public/report/pdf/route": [CHROMIUM_BINARY_GLOB],
    "/api/public/assessments/report/delivery/route": [CHROMIUM_BINARY_GLOB],
    "/api/public/assessments/report/pdf/route": [CHROMIUM_BINARY_GLOB],
    "/api/public/assessments/route": [
      "./node_modules/@img/sharp-linux-x64/package.json",
      "./node_modules/@img/sharp-linux-x64/index.cjs",
      "./node_modules/@img/sharp-linux-x64/lib/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/package.json",
      "./node_modules/@img/sharp-libvips-linux-x64/versions.json",
      "./node_modules/@img/sharp-libvips-linux-x64/lib/**/*",
      CHROMIUM_BINARY_GLOB,
    ],
  },
};

export default nextConfig;
