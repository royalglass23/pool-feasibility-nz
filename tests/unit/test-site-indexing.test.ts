// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata } from "@/app/layout";

afterEach(() => vi.unstubAllEnvs());

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

  it("publishes the production sitemap while keeping private routes out of crawlers", () => {
    vi.stubEnv("SITE_INDEXING_ENABLED", "true");

    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/staff/", "/prototype/"],
      },
      sitemap: "https://www.poolready.co.nz/sitemap.xml",
    });
  });

  it("lists only canonical public PoolReady pages in the sitemap", () => {
    expect(sitemap()).toEqual([
      {
        url: "https://www.poolready.co.nz/",
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: "https://www.poolready.co.nz/can-my-auckland-property-suit-a-pool",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://www.poolready.co.nz/auckland-pool-planning-for-builders",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://www.poolready.co.nz/partners",
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: "https://www.poolready.co.nz/privacy",
        changeFrequency: "yearly",
        priority: 0.3,
      },
    ]);
  });

  it("describes PoolReady as an Auckland pool feasibility and site assessment tool", () => {
    expect(metadata.title).toBe(
      "Pool Feasibility Auckland | Check Your Property | PoolReady",
    );
    expect(metadata.description).toBe(
      "Check your Auckland property for pool placement and planning constraints with a preliminary PoolReady site assessment before design and construction.",
    );
  });
});
