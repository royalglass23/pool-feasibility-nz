import { readAucklandDemWindow } from "../src/modules/providers/linz/read-auckland-dem-window";
import { assessPoolAreaSlope } from "../src/modules/terrain/assess-pool-area-slope";

async function main() {
  if (!process.argv.includes("--live")) {
    console.error(
      "Live Auckland DEM access is opt-in. Re-run with --live to read a bounded public COG window.",
    );
    process.exitCode = 2;
  } else {
    const boundsNztm = {
      minimumEast: 1_758_390,
      minimumNorth: 5_920_790,
      maximumEast: 1_758_410,
      maximumNorth: 5_920_810,
    };
    const startedAt = performance.now();
    const window = await readAucklandDemWindow({
      assetUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA32_10000_0401.tiff",
      boundsNztm,
      provenance: {
        stacItemUrl:
          "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA32_10000_0401.json",
        assetChecksum:
          "122006b2c8bd1cf34188e2a20886dfb1069083a31198d4ec7d2f8482cf1e94090b92",
        assetUpdatedAt: "2026-01-13T03:02:19Z",
        retrievedAt: new Date().toISOString(),
      },
    });

    if (window.status === "needs_checking") {
      console.error(JSON.stringify(window, null, 2));
      process.exitCode = 1;
    } else {
      const slope = assessPoolAreaSlope({
        grid: window.grid,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [boundsNztm.minimumEast, boundsNztm.minimumNorth],
              [boundsNztm.maximumEast, boundsNztm.minimumNorth],
              [boundsNztm.maximumEast, boundsNztm.maximumNorth],
              [boundsNztm.minimumEast, boundsNztm.maximumNorth],
              [boundsNztm.minimumEast, boundsNztm.minimumNorth],
            ],
          ],
        },
      });
      console.log(
        JSON.stringify(
          {
            source: window.provenance,
            boundsNztm,
            dimensions: [window.grid.width, window.grid.height],
            validCells: window.grid.elevationsMetres.filter(Number.isFinite)
              .length,
            durationMs: Math.round(performance.now() - startedAt),
            slope,
          },
          null,
          2,
        ),
      );
      if (slope.status === "needs_checking") process.exitCode = 1;
    }
  }
}

void main().catch(() => {
  console.error("The Auckland DEM slope probe failed unexpectedly.");
  process.exitCode = 1;
});
