import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";

const host = resolve("tests/security/input-validation-host.mjs");
const dev = "postgresql://fixture:fixture@ep-dev.example.test/devdb";
const production =
  "postgresql://fixture:fixture@ep-production.example.test/proddb";

async function runHost(files, inherited = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "input-host-test-"));
  try {
    for (const [file, contents] of Object.entries(files))
      await writeFile(resolve(directory, file), contents);
    // Observe the command's decision to launch Next; no server or DB is started.
    const next = resolve(directory, "node_modules/next/dist/bin/next");
    await mkdir(dirname(next), { recursive: true });
    await writeFile(
      next,
      'console.log("NEXT_STARTED:" + new URL(process.env.DATABASE_URL).pathname);',
    );
    const preload = resolve(
      directory,
      "tests/security/input-validation-provider-fixture.mjs",
    );
    await mkdir(dirname(preload), { recursive: true });
    await writeFile(preload, "");
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        /^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata|comspec|pathext)$/i.test(
          key,
        ),
      ),
    );
    const result = spawnSync(process.execPath, [host, "serve"], {
      cwd: directory,
      env: { ...environment, INPUT_SECURITY_DATABASE: "dev", ...inherited },
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    assert.equal(result.error, undefined);
    const log = await readFile(
      resolve(directory, "tmp/input-security/serve.log"),
      "utf8",
    ).catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    return {
      status: result.status,
      output: result.stdout + result.stderr + log,
    };
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("input-host-test-"));
    await rm(directory, { recursive: true, force: true });
  }
}

test("refuses a dev target also declared as production outside .env", async () => {
  const result = await runHost({
    ".env": `DATABASE_URL_DEV=${dev}\nDATABASE_URL=${production}\n`,
    ".env.production.local": `DATABASE_URL=${dev}\n`,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.output, /DEV_DATABASE_MUST_BE_DISTINCT_FROM_PRODUCTION/);
  assert.doesNotMatch(result.output, /NEXT_STARTED/);
});

for (const file of [
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
]) {
  test(`refuses a production alias in ${file}, including overridden values`, async () => {
    const result = await runHost({
      ".env": `DATABASE_URL_DEV=${dev}\n`,
      [file]: `DATABASE_URL_PROD=${dev.replace("ep-dev.", "ep-dev-pooler.")}\n`,
      ".env.production.local": `DATABASE_URL_PROD=${production}\n`,
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.output,
      /DEV_DATABASE_MUST_BE_DISTINCT_FROM_PRODUCTION/,
    );
    assert.doesNotMatch(result.output, /NEXT_STARTED/);
  });
}

test("checks inherited production configuration too", async () => {
  const result = await runHost(
    { ".env": `DATABASE_URL_DEV=${dev}\n` },
    { DATABASE_URL_PROD: dev },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /DEV_DATABASE_MUST_BE_DISTINCT_FROM_PRODUCTION/);
});

test("selects dev through documented precedence without using production overrides", async () => {
  const result = await runHost({
    ".env": `DATABASE_URL_DEV=${dev}\nDATABASE_URL=${production}\n`,
    ".env.development": `DATABASE_URL_DEV=${dev.replace("/devdb", "/development")}\n`,
    ".env.local": `DATABASE_URL_DEV=${dev.replace("/devdb", "/local")}\n`,
    ".env.development.local": `DATABASE_URL_DEV=${dev.replace("/devdb", "/selected")}\n`,
    ".env.production.local": `DATABASE_URL_DEV=${production}\nDATABASE_URL=${production}\n`,
  });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /NEXT_STARTED:\/selected/);
});

test("explicit inherited dev target has highest precedence", async () => {
  const result = await runHost(
    { ".env": `DATABASE_URL_DEV=${dev}\nDATABASE_URL=${production}\n` },
    { DATABASE_URL_DEV: dev.replace("/devdb", "/inherited") },
  );
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /NEXT_STARTED:\/inherited/);
});
