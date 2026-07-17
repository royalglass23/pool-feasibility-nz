import { describe, expect, it } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { summarizeLiveLayerSmoke } from "@/modules/data-access-spike/live-layer-smoke";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";

describe("summarizeLiveLayerSmoke", () => {
  it("records provider access separately from fixture-backed acceptance evidence", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-17T01:02:03.000Z"),
    });

    expect(summarizeLiveLayerSmoke(result)).toMatchObject({
      checkedAt: "2026-07-17T01:02:03.000Z",
      addressId: "2359811",
      parcelId: "8545868",
      overall: "pass",
      providers: {
        LINZ: { accessible: true },
        "Auckland Council": { accessible: true },
        Watercare: {
          accessible: true,
          evidenceUse: "internal_reference",
        },
      },
    });
  });

  it("fails when any required mapped layer is not currently accessible", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-17T01:02:03.000Z"),
    });
    result.datasets.flood_plains = {
      ...result.datasets.flood_plains,
      status: "error",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      errorCode: "PROVIDER_TIMEOUT",
      geometry: undefined,
    };

    expect(summarizeLiveLayerSmoke(result)).toMatchObject({
      overall: "fail",
      providers: {
        "Auckland Council": {
          accessible: false,
        },
      },
    });
  });
});
