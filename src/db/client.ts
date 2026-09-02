import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";
import * as schema from "@/db/schema";

export function getDb() {
  const databaseUrl =
    process.env.VERCEL_ENV === "preview"
      ? process.env.DATABASE_URL_DEV?.trim()
      : env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      process.env.VERCEL_ENV === "preview"
        ? "DATABASE_URL_DEV is required for persisted assessments in Vercel Preview."
        : "DATABASE_URL is required for persisted assessments.",
    );
  }

  return drizzle(neon(databaseUrl), { schema });
}
