import { describe, expect, it } from "vitest";
import { feature, point } from "@turf/turf";
import type { FeatureCollection, Polygon } from "geojson";
import type { DetailedLayerResult, FastPropertyDetails } from "@/modules/data-access-spike/execute-fast-property-details";
import { classifyFastPoolWarning, type FastPoolWarningInput } from "@/modules/data-access-spike/fast-pool-warning";

const pool = feature<Polygon>({
  type: "Polygon",
  coordinates: [[[174.6, -36.86], [174.601, -36.86], [174.601, -36.861], [174.6, -36.86]]],
});

function details(layers: DetailedLayerResult[]): FastPropertyDetails {
  return {
    status: "complete",
    layers,
    retrievedAt: "2026-07-28T00:00:00.000Z",
    durationMs: 10,
    region: "New Zealand",
    limitations: [],
  };
}

function layer(
  key: DetailedLayerResult["key"],
  state: DetailedLayerResult["state"],
  geometry: FeatureCollection | null = null,
): DetailedLayerResult {
  return {
    key,
    state,
    geometry,
    evidence: {
      provider: "fixture",
      dataset: key,
      datasetIdentifier: key,
      status: state === "returned" ? "success" : "available",
      licenceStatus: "permitted",
      evidenceUse: "report_allowed",
      retrievedAt: "2026-07-28T00:00:00.000Z",
      datasetDate: null,
      licence: "fixture",
      attribution: null,
      geometryUsed: null,
      attributesUsed: [],
      evidenceType: "mapped",
      confidence: "limited",
    },
    message: state,
  };
}

function input(overrides: Partial<FastPoolWarningInput> = {}): FastPoolWarningInput {
  return {
    boundaryState: "confirmed",
    pool,
    detailedChecks: details([layer("contours", "verified_empty")]),
    ...overrides,
  };
}

describe("fast pool warning integration contract", () => {
  it("transitions through Needs Checking, No Warning, and Blocked from loaded evidence", () => {
    expect(classifyFastPoolWarning(input({ detailedChecks: undefined })).status).toBe("needs_checking");
    expect(classifyFastPoolWarning(input()).status).toBe("no_warning");
    expect(
      classifyFastPoolWarning(
        input({
          detailedChecks: details([
            layer("watercourses", "returned", {
              type: "FeatureCollection",
              features: [point([174.6005, -36.8605])],
            }),
          ]),
        }),
      ).status,
    ).toBe("blocked");
  });
});
