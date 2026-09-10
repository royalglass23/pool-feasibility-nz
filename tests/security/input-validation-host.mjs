import { cp, mkdir, symlink, writeFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { neonConfig } from "@neondatabase/serverless";

const root = process.cwd();
const output = resolve(root, "tmp/input-security");
const app =
  process.env.INPUT_SECURITY_USE_CHECKOUT === "1"
    ? root
    : resolve(output, "app");
const mode = process.argv[2];
if (!["build", "serve", "diagnostic"].includes(mode))
  throw new Error("Use build, serve or diagnostic");
await mkdir(app, { recursive: true });
const environment = {};
const configuredLayers = new Map();
// Next loads .env files from cwd. Explicit blanks prevent test runs from using
// any configured credentials; only the fixture overrides below are retained.
for (const name of [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
]) {
  const contents = await readFile(resolve(root, name), "utf8").catch(
    (error) => {
      if (error.code === "ENOENT") return "";
      throw error; // Unreadable configuration cannot establish a safe target.
    },
  );
  const values = parse(contents);
  configuredLayers.set(name, values);
  for (const key of Object.keys(values)) environment[key] = "";
}
for (const [key, value] of Object.entries(process.env)) {
  if (
    /^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata|comspec|pathext|number_of_processors)$/i.test(
      key,
    )
  )
    environment[key] = value;
}
Object.assign(environment, {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  SITE_INDEXING_ENABLED: "false",
  APP_BASE_URL: "http://127.0.0.1:3217",
  REPORT_DELIVERY_MODE: "disabled",
  CONTACT_DELIVERY_MODE: "production",
  RESEND_API_KEY: "re_local_security_fixture",
  REPORT_FROM_EMAIL: "Security test <security@example.com>",
  UPSTASH_REDIS_REST_URL: "https://redis.input-security.invalid",
  UPSTASH_REDIS_REST_TOKEN: "local-security-fixture",
  INTERNAL_REPORT_SIGNING_SECRET:
    "local-input-security-signing-secret-2026-at-least-32-bytes",
  INPUT_SECURITY_MAIL_CAPTURE: resolve(output, "emails.jsonl"),
});
if (process.env.INPUT_SECURITY_DATABASE === "dev") {
  // Select the development target using Next's development precedence (highest
  // last). Production overrides never select the dev target. Check every raw
  // layer below, so an overridden production value cannot escape the guard.
  const configured = Object.assign(
    {},
    configuredLayers.get(".env"),
    configuredLayers.get(".env.development"),
    configuredLayers.get(".env.local"),
    configuredLayers.get(".env.development.local"),
    process.env,
  );
  const dev = configured.DATABASE_URL_DEV;
  if (!dev) throw new Error("DATABASE_URL_DEV_REQUIRED");
  const identity = (value) => {
    const url = new URL(value);
    return `${url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "")}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
  };
  for (const layer of [...configuredLayers.values(), process.env]) {
    for (const key of ["DATABASE_URL", "DATABASE_URL_PROD"]) {
      if (layer[key] && identity(layer[key]) === identity(dev))
        throw new Error("DEV_DATABASE_MUST_BE_DISTINCT_FROM_PRODUCTION");
    }
  }
  environment.DATABASE_URL = dev;
  environment.DATABASE_URL_DEV = dev;
  const databaseUrl = new URL(dev);
  environment.INPUT_SECURITY_DB_ENDPOINT =
    typeof neonConfig.fetchEndpoint === "function"
      ? neonConfig.fetchEndpoint(databaseUrl.hostname, databaseUrl.port, {
          jwtAuth: false,
        })
      : neonConfig.fetchEndpoint;
  console.log(
    "Approved dev database selected; distinct from configured production targets.",
  );
}
if (mode === "build") {
  for (const entry of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
  ]) {
    await cp(resolve(root, entry), resolve(app, entry), { recursive: true });
  }
  await symlink(
    resolve(root, "node_modules"),
    resolve(app, "node_modules"),
    "junction",
  ).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  const sourceHash = createHash("sha256");
  async function hashTree(path) {
    const { readdir } = await import("node:fs/promises");
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (entry.isDirectory()) await hashTree(resolve(path, entry.name));
      else {
        sourceHash.update(resolve(path, entry.name).slice(app.length));
        sourceHash.update(await readFile(resolve(path, entry.name)));
      }
    }
  }
  await hashTree(resolve(app, "src"));
  await writeFile(
    resolve(output, "environment.json"),
    JSON.stringify(
      {
        baseUrl: environment.APP_BASE_URL,
        productionTarget: false,
        buildMode: "production",
        database: "unconfigured; invalid-input tests only",
        thirdPartyFixtures: ["Resend capture", "Upstash sliding window"],
        sourceHash: sourceHash.digest("hex"),
      },
      null,
      2,
    ),
  );
}
if (mode === "diagnostic") environment.NODE_ENV = "development";
if (mode !== "build")
  await writeFile(environment.INPUT_SECURITY_MAIL_CAPTURE, "");
const log = createWriteStream(resolve(output, `${mode}.log`), { flags: "w" });
const child = spawn(
  process.execPath,
  [
    ...(mode !== "build"
      ? [
          "--import",
          pathToFileURL(
            resolve(
              root,
              "tests/security/input-validation-provider-fixture.mjs",
            ),
          ).href,
        ]
      : []),
    resolve(root, "node_modules/next/dist/bin/next"),
    ...(mode === "build"
      ? ["build"]
      : mode === "diagnostic"
        ? ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3217"]
        : ["start", "--hostname", "127.0.0.1", "--port", "3217"]),
  ],
  {
    cwd: app,
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.pipe(log);
child.stderr.pipe(log);
console.log(
  JSON.stringify({ mode, pid: child.pid, log: resolve(output, `${mode}.log`) }),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill());
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  log.end();
  process.exitCode = code ?? 1;
});
