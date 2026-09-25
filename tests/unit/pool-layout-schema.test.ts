import { describe, expect, it } from "vitest";
import { namedPoolLayoutSchema } from "@/modules/assessment/pool-layout-schema";

describe("named pool layout contract", () => {
  it.each([
    ["plunge", "Plunge", 4, 2.4],
    ["compact", "Compact", 6.5, 3],
    ["slimline", "Slimline", 8, 3],
    ["family", "Family", 8, 4],
    ["large", "Large", 10, 4.4],
    ["custom", "Custom", 6.5, 3],
  ] as const)(
    "accepts %s with its approved name and dimensions",
    (layoutId, layoutName, lengthMetres, widthMetres) => {
      expect(
        namedPoolLayoutSchema.parse({
          layoutId,
          layoutName,
          lengthMetres,
          widthMetres,
        }),
      ).toEqual({ layoutId, layoutName, lengthMetres, widthMetres });
    },
  );

  it("keeps Compact and Custom distinct at the same dimensions", () => {
    const compact = namedPoolLayoutSchema.parse({
      layoutId: "compact",
      layoutName: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    });
    const custom = namedPoolLayoutSchema.parse({
      layoutId: "custom",
      layoutName: "Custom",
      lengthMetres: 6.5,
      widthMetres: 3,
    });

    expect(compact.layoutId).not.toBe(custom.layoutId);
  });

  it.each([
    {
      layoutId: "compact",
      layoutName: "Custom",
      lengthMetres: 6.5,
      widthMetres: 3,
    },
    {
      layoutId: "compact",
      layoutName: "Compact",
      lengthMetres: 7,
      widthMetres: 3,
    },
    {
      layoutId: "unknown",
      layoutName: "Unknown",
      lengthMetres: 6.5,
      widthMetres: 3,
    },
  ])("rejects incompatible or unknown layout metadata", (layout) => {
    expect(namedPoolLayoutSchema.safeParse(layout).success).toBe(false);
  });
});
