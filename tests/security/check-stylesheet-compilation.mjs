import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

if (process.argv[2] !== "worker") {
  const result = spawnSync(process.execPath, [import.meta.filename, "worker"], {
    cwd: resolve(process.argv[2] ?? "."),
    timeout: 30_000,
    encoding: "utf8",
    windowsHide: true,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  assert.equal(
    result.error?.code,
    undefined,
    "Stylesheet compilation exceeded 30 seconds",
  );
  assert.equal(result.status, 0, "Stylesheet compilation failed");
} else {
  const { default: postcss } = await import("postcss");
  const { default: tailwind } = await import("@tailwindcss/postcss");
  const { default: config } = await import(
    pathToFileURL(resolve("postcss.config.mjs"))
  );
  const from = resolve("src/app/globals.css");
  const started = performance.now();
  const result = await postcss([
    tailwind(config.plugins["@tailwindcss/postcss"]),
  ]).process(await readFile(from, "utf8"), { from });
  assert.ok(
    result.css.includes(".sr-only"),
    "Application utility styles must remain generated",
  );
  console.log(
    JSON.stringify({
      elapsedMs: Math.round(performance.now() - started),
      cssBytes: result.css.length,
    }),
  );
}
