import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    APP_BASE_URL: z.url().default("http://localhost:3000"),
    ANALYSIS_VERSION: z.string().min(1).default("poc-v1"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(30_000)
      .default(10_000),
    PROVIDER_RETRY_COUNT: z.coerce.number().int().min(0).max(3).default(2),
    DATABASE_URL: z.url(),
    LINZ_DATA_SERVICE_API_KEY: z.string().min(1).optional(),
    LINZ_BASEMAPS_API_KEY: z.string().min(1).optional(),
    AUCKLAND_COUNCIL_API_KEY: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    AI_PROVIDER: z.enum(["none", "openai"]).default("none"),
    OPENAI_API_KEY: z.string().min(1).optional(),
  },
  client: {},
  runtimeEnv: {
    APP_BASE_URL: process.env.APP_BASE_URL,
    ANALYSIS_VERSION: process.env.ANALYSIS_VERSION,
    LOG_LEVEL: process.env.LOG_LEVEL,
    PROVIDER_TIMEOUT_MS: process.env.PROVIDER_TIMEOUT_MS,
    PROVIDER_RETRY_COUNT: process.env.PROVIDER_RETRY_COUNT,
    DATABASE_URL: process.env.DATABASE_URL,
    LINZ_DATA_SERVICE_API_KEY: process.env.LINZ_DATA_SERVICE_API_KEY,
    LINZ_BASEMAPS_API_KEY: process.env.LINZ_BASEMAPS_API_KEY,
    AUCKLAND_COUNCIL_API_KEY: process.env.AUCKLAND_COUNCIL_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
