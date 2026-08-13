import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

describe("staff CLI runtime", () => {
  it("runs staff account commands with Next's react-server condition", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    ) as PackageManifest;

    expect(packageJson.scripts?.["staff:bootstrap"]).toContain(
      "--conditions=react-server",
    );
    expect(packageJson.scripts?.["staff:reset-password"]).toContain(
      "--conditions=react-server",
    );
  });
});
