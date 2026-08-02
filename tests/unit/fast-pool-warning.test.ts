import { describe, expect, it } from "vitest";
import { feature, point } from "@turf/turf";
import type { FeatureCollection, Polygon } from "geojson";
import type { DetailedLayerResult } from "@/modules/data-access-spike/execute-fast-property-details";
import {
  classifyFastPoolWarning,
  type FastPoolWarningInput,
} from "@/modules/data-access-spike/fast-pool-warning";

const recommendation =
  "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.";

function input(
  overrides: Partial<FastPoolWarningInput> = {},
): FastPoolWarningInput {
  return {
    boundaryState: "confirmed",
    pool: feature<Polygon>({
      type: "Polygon",
      coordinates: [[[174.6, -36.86], [174.601, -36.86], [174.601, -36.861], [174.6, -36.86]]],
    }),
    detailedChecks: {
      status: "complete",
      layers: [layer("contours", "verified_empty")],
      retrievedAt: "2026-07-28T00:00:00.000Z",
      durationMs: 1,
      region: "New Zealand",
      limitations: [],
    },
    ...overrides,
  };
}

function layer(
  key: DetailedLayerResult["key"],
  state: DetailedLayerResult["state"],
  geometry?: FeatureCollection,
): DetailedLayerResult {
  return {
    key,
    state,
    geometry: geometry ?? null,
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
      confidence: state === "returned" ? "limited" : "limited",
    },
    message: state,
  };
}

describe("classifyFastPoolWarning", () => {
  it("returns No Warning when loaded evidence is complete and no service intersects", () => {
    const result = classifyFastPoolWarning(input());

    expect(result).toMatchObject({
      status: "no_warning",
      label: "No Warning",
      recommendation: null,
    });
    expect(result.text).toContain("No mapped utility conflict was found");
  });

  it("returns Needs Checking for missing or unavailable evidence", () => {
    const result = classifyFastPoolWarning(
      input({
        detailedChecks: undefined,
      }),
    );

    expect(result).toMatchObject({
      status: "needs_checking",
      label: "Needs Checking",
    });
    expect(result.recommendation).toBeNull();
    expect(result.text).toContain("Detailed official checks have not been loaded");
  });

  it("fails closed when complete evidence is empty or a returned layer has no geometry", () => {
    expect(
      classifyFastPoolWarning(
        input({ detailedChecks: { ...input().detailedChecks!, layers: [] } }),
      ).status,
    ).toBe("needs_checking");
    expect(
      classifyFastPoolWarning(
        input({
          detailedChecks: {
            ...input().detailedChecks!,
            layers: [layer("watercourses", "returned")],
          },
        }),
      ).status,
    ).toBe("needs_checking");
  });

  it("returns Blocked for a reliable mapped utility intersection and keeps the recommendation", () => {
    const result = classifyFastPoolWarning(
      input({
        detailedChecks: {
          ...input().detailedChecks!,
          layers: [
            layer("wastewater_assets", "returned", {
              type: "FeatureCollection",
              features: [point([174.6005, -36.8605])],
            }),
          ],
        },
      }),
    );

    expect(result).toMatchObject({
      status: "blocked",
      label: "Blocked",
      recommendation,
    });
    expect(result.text).toContain("mapped wastewater");
  });

  it("blocks a reliable mapped stormwater watercourse intersection", () => {
    const result = classifyFastPoolWarning(
      input({
        detailedChecks: {
          ...input().detailedChecks!,
          layers: [
            layer("watercourses", "returned", {
              type: "FeatureCollection",
              features: [point([174.6005, -36.8605])],
            }),
          ],
        },
      }),
    );

    expect(result.status).toBe("blocked");
  });

  it("names every intersecting indicative utility that needs checking", () => {
    const indicativeStormwater = layer("public_stormwater_assets", "returned", {
      type: "FeatureCollection",
      features: [point([174.6005, -36.8605])],
    });
    indicativeStormwater.evidence = {
      ...indicativeStormwater.evidence,
      dataset: "Stormwater Pipes",
      evidenceUse: "spike_only",
    };
    const indicativeWastewater = layer("wastewater_assets", "returned", {
      type: "FeatureCollection",
      features: [point([174.6005, -36.8605])],
    });
    indicativeWastewater.evidence = {
      ...indicativeWastewater.evidence,
      dataset: "Wastewater Pipes",
      evidenceUse: "internal_reference",
    };

    const result = classifyFastPoolWarning(
      input({
        detailedChecks: {
          ...input().detailedChecks!,
          layers: [indicativeStormwater, indicativeWastewater],
        },
      }),
    );

    expect(result).toMatchObject({
      status: "needs_checking",
      checkingDatasets: ["Stormwater Pipes", "Wastewater Pipes"],
    });
    expect(result.text).toContain("stormwater pipes and wastewater pipes");
  });
});
