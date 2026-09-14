import "server-only";

import {
  readAucklandDemWindow,
  type AucklandDemProvenance,
} from "@/modules/providers/linz/read-auckland-dem-window";
import {
  assessPoolAreaSlope,
  type PoolAreaSlopeAssessment,
} from "@/modules/terrain/assess-pool-area-slope";

const DEMO_BOUNDS_NZTM = {
  minimumEast: 1_758_390,
  minimumNorth: 5_920_790,
  maximumEast: 1_758_410,
  maximumNorth: 5_920_810,
} as const;

export type AucklandSlopeDemoResult =
  | {
      status: "measured";
      boundsNztm: typeof DEMO_BOUNDS_NZTM;
      dimensions: [number, number];
      validCells: number;
      durationMs: number;
      source: AucklandDemProvenance;
      slope: Extract<PoolAreaSlopeAssessment, { status: "measured" }>;
    }
  | {
      status: "needs_checking";
      reasons: string[];
    };

export async function loadAucklandSlopeDemo(): Promise<AucklandSlopeDemoResult> {
  const startedAt = performance.now();
  const window = await readAucklandDemWindow({
    assetUrl:
      "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA32_10000_0401.tiff",
    boundsNztm: DEMO_BOUNDS_NZTM,
    provenance: {
      stacItemUrl:
        "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/BA32_10000_0401.json",
      assetChecksum:
        "122006b2c8bd1cf34188e2a20886dfb1069083a31198d4ec7d2f8482cf1e94090b92",
      assetUpdatedAt: "2026-01-13T03:02:19Z",
      retrievedAt: new Date().toISOString(),
    },
  });

  if (window.status === "needs_checking") return window;

  const slope = assessPoolAreaSlope({
    grid: window.grid,
    footprint: {
      type: "Polygon",
      coordinates: [
        [
          [DEMO_BOUNDS_NZTM.minimumEast, DEMO_BOUNDS_NZTM.minimumNorth],
          [DEMO_BOUNDS_NZTM.maximumEast, DEMO_BOUNDS_NZTM.minimumNorth],
          [DEMO_BOUNDS_NZTM.maximumEast, DEMO_BOUNDS_NZTM.maximumNorth],
          [DEMO_BOUNDS_NZTM.minimumEast, DEMO_BOUNDS_NZTM.maximumNorth],
          [DEMO_BOUNDS_NZTM.minimumEast, DEMO_BOUNDS_NZTM.minimumNorth],
        ],
      ],
    },
  });

  if (slope.status === "needs_checking") return slope;

  return {
    status: "measured",
    boundsNztm: DEMO_BOUNDS_NZTM,
    dimensions: [window.grid.width, window.grid.height],
    validCells: window.grid.elevationsMetres.filter(Number.isFinite).length,
    durationMs: Math.round(performance.now() - startedAt),
    source: window.provenance,
    slope,
  };
}
