// @vitest-environment node

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import robots from "@/app/robots";
import { metadata } from "@/app/layout";

describe("Vercel test deployment indexing", () => {
  it("defaults to durable noindex directives until public indexing is enabled", async () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(robots()).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });

    const headers = await nextConfig.headers?.();
    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ]);
  });
});
