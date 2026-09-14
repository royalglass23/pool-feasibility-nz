import { loadAucklandSlopeDemo } from "../src/modules/terrain/load-auckland-slope-demo";

async function main() {
  if (!process.argv.includes("--live")) {
    console.error(
      "Live Auckland DEM access is opt-in. Re-run with --live to read a bounded public COG window.",
    );
    process.exitCode = 2;
  } else {
    const demo = await loadAucklandSlopeDemo();

    if (demo.status === "needs_checking") {
      console.error(JSON.stringify(demo, null, 2));
      process.exitCode = 1;
    } else {
      console.log(
        JSON.stringify(
          {
            source: demo.source,
            boundsNztm: demo.boundsNztm,
            dimensions: demo.dimensions,
            validCells: demo.validCells,
            durationMs: demo.durationMs,
            slope: demo.slope,
          },
          null,
          2,
        ),
      );
    }
  }
}

void main().catch(() => {
  console.error("The Auckland DEM slope probe failed unexpectedly.");
  process.exitCode = 1;
});
