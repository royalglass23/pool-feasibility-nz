import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadAucklandSlopeDemo } = vi.hoisted(() => ({
  loadAucklandSlopeDemo: vi.fn(),
}));

vi.mock("@/modules/terrain/load-auckland-slope-demo", () => ({
  loadAucklandSlopeDemo,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import TerrainSlopeDemoPage from "@/app/prototype/terrain-slope/page";

describe("terrain slope demo page", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("shows the live indicative slope sample without presenting it as property-specific", async () => {
    loadAucklandSlopeDemo.mockResolvedValue({
      status: "measured",
      boundsNztm: {
        minimumEast: 1_758_390,
        minimumNorth: 5_920_790,
        maximumEast: 1_758_410,
        maximumNorth: 5_920_810,
      },
      dimensions: [20, 20],
      validCells: 400,
      durationMs: 1_527,
      source: {
        dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
        datasetIdentifier:
          "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
        retrievedAt: "2026-09-13T21:51:00.261Z",
      },
      slope: {
        status: "measured",
        averageSlopeDegrees: 1.284,
        upperSlopeDegrees: 3.366,
        estimatedFallMetres: 0.105,
        downhillBearingDegrees: 138.813,
        downhillDirection: "SE",
        confidence: "indicative",
      },
    });

    render(await TerrainSlopeDemoPage());

    expect(
      screen.getByRole("heading", {
        name: "Read the ground, not the contours",
      }),
    ).toBeVisible();
    expect(screen.getByText("1.3°")).toBeVisible();
    expect(screen.getByText("Falls SE")).toBeVisible();
    expect(screen.getByText("0.10 m")).toBeVisible();
    expect(screen.getByText(/fixed 20 × 20 m demo window/i)).toBeVisible();
    expect(screen.getByText(/not your selected property/i)).toBeVisible();
    expect(screen.getByText(/indicative, not a site survey/i)).toBeVisible();
  });

  it("does not expose the prototype or request DEM data in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(TerrainSlopeDemoPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadAucklandSlopeDemo).not.toHaveBeenCalled();
  });

  it("gives a clear Needs Checking state when live elevation cannot be read", async () => {
    loadAucklandSlopeDemo.mockResolvedValue({
      status: "needs_checking",
      reasons: ["The Auckland elevation data could not be read."],
    });

    render(await TerrainSlopeDemoPage());

    expect(
      screen.getByRole("heading", { name: "Slope needs checking" }),
    ).toBeVisible();
    expect(
      screen.getByText("The Auckland elevation data could not be read."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/prototype/terrain-slope",
    );
  });
});
