import { describe, expect, it } from "vitest";

import { PROJECT } from "@/config/project";

describe("Stage 1 project contract", () => {
  it("identifies the standalone Auckland POC", () => {
    expect(PROJECT).toEqual({
      name: "pool-feasibility-nz",
      supportedRegion: "Auckland",
      analysisVersion: "poc-v1",
    });
  });
});
