import { describe, expect, it, vi } from "vitest";
import { AUCKLAND_DEM_REQUIRED_METADATA } from "@/modules/providers/linz/auckland-dem-source-contract";
import { parseAucklandDemTileCatalogue } from "@/modules/providers/linz/auckland-dem-tile-catalogue";

vi.mock("server-only", () => ({}));

describe("Auckland DEM tile catalogue boundary", () => {
  it("rejects malformed catalogue JSON before terrain resolution", () => {
    expect(() =>
      parseAucklandDemTileCatalogue({
        source: "LINZ Auckland 2024 DEM STAC",
        sourceUpdatedAt: "2026-01-13T21:29:07Z",
        ...AUCKLAND_DEM_REQUIRED_METADATA,
        tiles: null,
      }),
    ).toThrowError("Invalid Auckland DEM tile catalogue.");
  });
});
