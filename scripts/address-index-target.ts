export type AddressIndexTarget = "development" | "production";

type Environment = Record<string, string | undefined>;

export function resolveAddressIndexTarget(input: {
  argv: readonly string[];
  env?: Environment;
}): { target: AddressIndexTarget; databaseUrl: string } {
  const env = input.env ?? process.env;
  const target: AddressIndexTarget = input.argv.includes("--production")
    ? "production"
    : "development";

  if (target === "development") {
    const databaseUrl = env.DATABASE_URL_DEV?.trim();
    if (!databaseUrl) throw new Error("DATABASE_URL_DEV is required.");
    if (databaseUrl === env.DATABASE_URL?.trim()) {
      throw new Error(
        "Use the dedicated DATABASE_URL_DEV target, not DATABASE_URL.",
      );
    }
    return { target, databaseUrl };
  }

  if (!input.argv.includes("--confirm-production-address-index")) {
    throw new Error("CONFIRM_PRODUCTION_ADDRESS_INDEX_REQUIRED");
  }
  const databaseUrl = env.DATABASE_URL_PROD?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL_PROD is required.");
  if (databaseUrl === env.DATABASE_URL_DEV?.trim()) {
    throw new Error("PRODUCTION_ADDRESS_INDEX_TARGET_MATCHES_DEVELOPMENT");
  }

  const expectedHost = env.ADDRESS_INDEX_PRODUCTION_HOST?.trim();
  if (!expectedHost) throw new Error("ADDRESS_INDEX_PRODUCTION_HOST is required.");
  if (new URL(databaseUrl).hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    throw new Error("PRODUCTION_ADDRESS_INDEX_HOST_MISMATCH");
  }
  return { target, databaseUrl };
}
