import type { MetadataRoute } from "next";
import { isSiteIndexingEnabled } from "@/config/site-indexing";

export default function robots(): MetadataRoute.Robots {
  if (isSiteIndexingEnabled()) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/staff/", "/prototype/"],
      },
      sitemap: "https://www.poolready.co.nz/sitemap.xml",
    };
  }

  return { rules: { userAgent: "*", disallow: "/" } };
}
