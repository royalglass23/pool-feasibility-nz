import { describe, expect, it } from "vitest";
import { buildFastPoolGeometry } from "@/modules/data-access-spike/fast-pool-placement";
import { calculatePoolShellClearances } from "@/modules/spatial/pool-shell-clearances";

describe("pool-shell clearances", () => {
  it("measures the four outward side-centre distances to the mapped boundary and rounds them to one decimal metre", () => {
    const boundary = buildFastPoolGeometry(
      [174.76, -36.85],
      20,
      20,
    ).geometry;
    const shell = buildFastPoolGeometry([174.76, -36.85], 6, 4).geometry;

    const clearances = calculatePoolShellClearances({
      shellGeometry: shell,
      boundaryGeometry: boundary,
    });

    expect(clearances).toHaveLength(4);
    expect(clearances.map((clearance) => clearance.metres).sort()).toEqual([
      7,
      7,
      8,
      8,
    ]);
    expect(clearances.map((clearance) => clearance.label)).toEqual([
      "8.0 m",
      "7.0 m",
      "8.0 m",
      "7.0 m",
    ]);
  });

  it("returns no measurements for malformed polygon coordinates", () => {
    const boundary = buildFastPoolGeometry(
      [174.76, -36.85],
      20,
      20,
    ).geometry;
    const malformedShell = {
      type: "Polygon" as const,
      coordinates: [["not a position"]],
    } as unknown as typeof boundary;

    expect(
      calculatePoolShellClearances({
        shellGeometry: malformedShell,
        boundaryGeometry: boundary,
      }),
    ).toEqual([]);

    const boundaryWithMalformedInteriorRing = {
      ...boundary,
      coordinates: [boundary.coordinates[0], [["not a position"]]],
    } as unknown as typeof boundary;
    const shell = buildFastPoolGeometry([174.76, -36.85], 6, 4).geometry;

    expect(
      calculatePoolShellClearances({
        shellGeometry: shell,
        boundaryGeometry: boundaryWithMalformedInteriorRing,
      }),
    ).toEqual([]);
  });
});
