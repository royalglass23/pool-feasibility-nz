import type { MetadataRoute } from "next";
import { isSiteIndexingEnabled } from "@/config/site-indexing";

export default function robots(): MetadataRoute.Robots {
  if (isSiteIndexingEnabled()) {
    return { rules: { userAgent: "*", allow: "/" } };
  }

  return { rules: { userAgent: "*", disallow: "/" } };
}
