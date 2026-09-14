import nextEnvironment from "@next/env";

const { loadEnvConfig } = nextEnvironment;

const productionDatabaseKeys = ["DATABASE_URL", "DATABASE_URL_PROD"];

/** @typedef {Record<string, string | undefined>} Environment */
/** @typedef {{ path: string, env?: Environment }} LoadedEnvironmentFile */

export function loadLoadTestDatabaseTarget(root) {
  const loadedEnvironment = loadEnvConfig(root, false, console, true);
  return {
    environment: loadedEnvironment.combinedEnv,
    ...resolveLoadTestDatabaseTarget(loadedEnvironment),
  };
}

/**
 * @param {{
 *   combinedEnv: Environment,
 *   loadedEnvFiles?: LoadedEnvironmentFile[],
 * }} input
 */
export function resolveLoadTestDatabaseTarget({
  combinedEnv,
  loadedEnvFiles = [],
}) {
  const developmentUrl = requiredDatabaseUrl(
    combinedEnv.DATABASE_URL_DEV,
    "DATABASE_URL_DEV_REQUIRED",
  );
  const developmentIdentity = databaseIdentity(
    developmentUrl,
    "DEVELOPMENT_DATABASE_URL_INVALID",
  );
  const productionTargets = [
    ...productionDatabaseKeys.map((key) => combinedEnv[key]),
    ...loadedEnvFiles.flatMap(({ env = {} }) =>
      productionDatabaseKeys.map((key) => env[key]),
    ),
  ].filter((value) => value?.trim());

  if (productionTargets.length === 0) {
    throw new Error("PRODUCTION_DATABASE_TARGET_REQUIRED");
  }

  if (
    productionTargets.some(
      (target) =>
        databaseIdentity(target, "PRODUCTION_DATABASE_URL_INVALID") ===
        developmentIdentity,
    )
  ) {
    throw new Error("DEVELOPMENT_DATABASE_NOT_DISTINCT");
  }

  return {
    databaseUrl: developmentUrl,
    databaseIdentity: developmentIdentity,
  };
}

function requiredDatabaseUrl(value, missingCode) {
  if (!value?.trim()) throw new Error(missingCode);
  return value.trim();
}

function databaseIdentity(value, invalidCode) {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/-pooler(?=\.)/, "")}${url.pathname}`;
  } catch {
    throw new Error(invalidCode);
  }
}
