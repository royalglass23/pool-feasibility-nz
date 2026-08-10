import type { NextConfig } from "next";
import { isSiteIndexingEnabled } from "./src/config/site-indexing";

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
    "/api/internal/report/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/public/report/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/public/assessments": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
