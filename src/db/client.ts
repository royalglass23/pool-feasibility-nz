import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";
import * as schema from "@/db/schema";

export function getDb() {
  const databaseUrl =
    env.DATABASE_URL ??
    (process.env.VERCEL_ENV === "preview"
      ? process.env.DATABASE_URL_DEV?.trim()
      : undefined);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for persisted assessments.");
  }

  return drizzle(neon(databaseUrl), { schema });
}
