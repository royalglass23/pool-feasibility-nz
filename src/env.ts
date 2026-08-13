import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import {
  DEFAULT_PROVIDER_RETRY_COUNT,
  DEFAULT_PROVIDER_TIMEOUT_MS,
} from "@/shared/http/provider-runtime";

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
      .default(DEFAULT_PROVIDER_TIMEOUT_MS),
    PROVIDER_RETRY_COUNT: z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .default(DEFAULT_PROVIDER_RETRY_COUNT),
    INTERNAL_ACCESS_USERNAME: z.string().min(1).optional(),
    INTERNAL_ACCESS_PASSWORD: z.string().min(12).optional(),
    DATABASE_URL: z.url().optional(),
    LINZ_DATA_SERVICE_API_KEY: z.string().min(1).optional(),
    LINZ_BASEMAPS_API_KEY: z.string().min(1).optional(),
    AUCKLAND_COUNCIL_API_KEY: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    REPORT_FROM_EMAIL: z.string().min(3).max(320).optional(),
    REPORT_DELIVERY_MODE: z
      .enum(["synthetic_test", "production_test", "production"])
      .optional(),
    PREVIEW_REPORT_DELIVERY_TEST: z.literal("true").optional(),
    SERVICEM8_FORWARD_EMAIL: z.email().max(320).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    AI_PROVIDER: z.enum(["none", "openai"]).default("none"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  },
  client: {
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: z
      .string()
      .regex(/^G-[A-Z0-9]+$/i)
      .optional(),
  },
  runtimeEnv: {
    APP_BASE_URL: process.env.APP_BASE_URL,
    ANALYSIS_VERSION: process.env.ANALYSIS_VERSION,
    LOG_LEVEL: process.env.LOG_LEVEL,
    PROVIDER_TIMEOUT_MS: process.env.PROVIDER_TIMEOUT_MS,
    PROVIDER_RETRY_COUNT: process.env.PROVIDER_RETRY_COUNT,
    INTERNAL_ACCESS_USERNAME: process.env.INTERNAL_ACCESS_USERNAME,
    INTERNAL_ACCESS_PASSWORD: process.env.INTERNAL_ACCESS_PASSWORD,
    DATABASE_URL: process.env.DATABASE_URL,
    LINZ_DATA_SERVICE_API_KEY: process.env.LINZ_DATA_SERVICE_API_KEY,
    LINZ_BASEMAPS_API_KEY: process.env.LINZ_BASEMAPS_API_KEY,
    AUCKLAND_COUNCIL_API_KEY: process.env.AUCKLAND_COUNCIL_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    REPORT_FROM_EMAIL: process.env.REPORT_FROM_EMAIL,
    REPORT_DELIVERY_MODE: process.env.REPORT_DELIVERY_MODE,
    PREVIEW_REPORT_DELIVERY_TEST: process.env.PREVIEW_REPORT_DELIVERY_TEST,
    SERVICEM8_FORWARD_EMAIL: process.env.SERVICEM8_FORWARD_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
