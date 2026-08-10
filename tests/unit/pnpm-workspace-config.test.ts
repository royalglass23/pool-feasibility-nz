// @vitest-environment node

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Vercel dependency installation", () => {
  it("uses a symlink-free node_modules layout for serverless packaging", () => {
    const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "pnpm.cmd config get node-linker"]
        : ["config", "get", "node-linker"];
    const nodeLinker = execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();

    expect(nodeLinker).toBe("hoisted");
  });
});
