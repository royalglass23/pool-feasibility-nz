// Local-only load-test host. No application source or .env files are changed.
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import { loadLoadTestDatabaseTarget } from "./load-test-database-target.mjs";

const root = process.cwd();
const mode = process.argv[2];
if (!["build", "serve"].includes(mode)) throw new Error("Use build or serve");
const {
  databaseUrl: dev,
  databaseIdentity: devIdentity,
  environment: configured,
} = loadLoadTestDatabaseTarget(root);
const output = resolve(root, "output/load-tests/local-host");
await mkdir(output, { recursive: true });
const signingKey = randomBytes(40).toString("hex");
if (mode === "serve") {
  await mkdir(resolve(root, "tmp/local-load-test"), { recursive: true });
  await writeFile(
    resolve(root, "tmp/local-load-test/signing-key.txt"),
    signingKey,
  );
}
const environment = {
  ...process.env,
  ...configured,
  NODE_ENV: "production",
  VERCEL: "",
  VERCEL_ENV: "",
  DATABASE_URL: dev,
  DATABASE_URL_DEV: dev,
  DATABASE_URL_PROD: "",
  APP_BASE_URL: "http://127.0.0.1:3100",
  REPORT_DELIVERY_MODE: "disabled",
  RESEND_API_KEY: "",
  REPORT_FROM_EMAIL: "",
  PREVIEW_REPORT_FROM_EMAIL: "",
  SERVICEM8_FORWARD_EMAIL: "",
  OPENAI_API_KEY: "",
  AI_PROVIDER: "none",
  BLOB_READ_WRITE_TOKEN: "",
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: "",
  NEXT_PUBLIC_HOTJAR_SITE_ID: "",
  SITE_INDEXING_ENABLED: "false",
  CRON_SECRET: "",
  INTERNAL_REPORT_SIGNING_SECRET: signingKey,
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:3199",
  UPSTASH_REDIS_REST_TOKEN: "local-load-test-only",
  NEXT_TELEMETRY_DISABLED: "1",
};

// Emulates only the installed SDK's single-region sliding-window Lua boundary.
// Application policies and denial handling remain active. No external Redis writes.
const counts = new Map();
let redisCalls = 0;
const execute = (command) => {
  const [op, , keyCount, ...args] = command;
  if (
    !["eval", "evalsha"].includes(String(op).toLowerCase()) ||
    Number(keyCount) !== 3 ||
    args.length !== 7
  ) {
    throw new Error("UNSUPPORTED_LOCAL_REDIS_COMMAND");
  }
  const [
    currentKey,
    previousKey,
    dynamicKey,
    tokensRaw,
    nowRaw,
    windowRaw,
    incrementRaw,
  ] = args;
  if (
    dynamicKey ||
    !String(currentKey).startsWith("geomap:public-rate-limit:")
  ) {
    throw new Error("UNSUPPORTED_LOCAL_REDIS_KEY");
  }
  const [tokens, now, window, increment] = [
    tokensRaw,
    nowRaw,
    windowRaw,
    incrementRaw,
  ].map(Number);
  if (![tokens, now, window, increment].every(Number.isFinite) || window <= 0)
    throw new Error("INVALID_LOCAL_REDIS_ARGUMENTS");
  const current = counts.get(currentKey) ?? 0;
  const previous = Math.floor(
    (1 - (now % window) / window) * (counts.get(previousKey) ?? 0),
  );
  redisCalls++;
  if (increment > 0 && previous + current >= tokens)
    return { result: [-1, tokens] };
  counts.set(currentKey, current + increment);
  return { result: [tokens - current - increment - previous, tokens] };
};
const redis = createServer(async (request, response) => {
  if (request.url === "/health" && request.method === "GET") {
    response.end(
      JSON.stringify({
        localLoadTest: true,
        emailDisabled: true,
        databaseFingerprint: createHash("sha256")
          .update(devIdentity)
          .digest("hex")
          .slice(0, 16),
        redisCalls,
      }),
    );
    return;
  }
  try {
    if (request.headers.authorization !== "Bearer local-load-test-only")
      throw new Error("LOCAL_AUTH_REQUIRED");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const command = JSON.parse(Buffer.concat(chunks).toString());
    const result =
      request.url === "/pipeline" ? command.map(execute) : execute(command);
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result));
  } catch (error) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: error.message }));
  }
});
if (mode === "serve")
  await new Promise((done, reject) => {
    redis.once("error", reject);
    redis.listen(3199, "127.0.0.1", done);
  });
const log = createWriteStream(resolve(output, `${mode}.log`), { flags: "w" });
const args = [
  resolve(root, "node_modules/next/dist/bin/next"),
  ...(mode === "build"
    ? ["build", "--webpack"]
    : ["start", "--hostname", "127.0.0.1", "--port", "3100"]),
];
const child = spawn(process.execPath, args, {
  cwd: root,
  env: environment,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.pipe(log);
child.stderr.pipe(log);
await writeFile(
  resolve(output, "environment.json"),
  JSON.stringify(
    {
      baseURL: environment.APP_BASE_URL,
      databaseKey: "DATABASE_URL_DEV",
      databaseFingerprint: createHash("sha256")
        .update(devIdentity)
        .digest("hex")
        .slice(0, 16),
      emailDelivery: "disabled",
      rateLimitStore: "local sliding-window emulator",
      providers: "live",
      mode,
      launcherPid: process.pid,
      childPid: child.pid,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    mode,
    log: resolve(output, `${mode}.log`),
    childPid: child.pid,
  }),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    child.kill();
    redis.close();
  });
const code = await new Promise((done, reject) => {
  child.once("error", reject);
  child.once("exit", done);
});
redis.close();
log.end();
console.log(JSON.stringify({ mode, exitCode: code }));
process.exitCode = code ?? 1;
