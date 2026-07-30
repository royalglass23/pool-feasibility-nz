import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";
import * as schema from "@/db/schema";

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for persisted assessments.");
  }

  return drizzle(neon(env.DATABASE_URL), { schema });
}
