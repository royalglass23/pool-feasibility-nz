import { describe, expect, it, vi } from "vitest";
import addressesFixture from "../fixtures/linz/42-bahari-addresses.json";
import parcelsFixture from "../fixtures/linz/42-bahari-parcels.json";
import providerFixtures from "../fixtures/providers/official-property-layers.json";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import { datasetCatalog } from "@/modules/providers/official-dataset-catalog";

describe("official property layer integration", () => {
  it("normalizes fixture-backed LINZ, Council, and Watercare geometry into one evidence result", async () => {
    const gateway = new OfficialGisGateway({
      fetch: vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.includes("LINZ_NZ_Addresses")) {
          return Response.json(addressesFixture);
        }
        if (url.pathname.includes("LINZ_NZ_Primary_Parcels")) {
          const longitude = Number(
            url.searchParams.get("geometry")?.split(",")[0],
          );
          return Response.json(
            longitude < 174.608 ? parcelsFixture["42A"] : parcelsFixture["42"],
          );
        }
        if (url.pathname.includes("/tiles/aerial/")) {
          return Response.json({
            sources: {
              aerial: {
                type: "raster",
                attribution: "Land Information New Zealand (LINZ)",
              },
            },
          });
        }

        const dataset = Object.entries(datasetCatalog).find(([, entry]) =>
          String(input).startsWith(entry.queryUrl),
        )?.[0] as keyof typeof providerFixtures | undefined;
        if (!dataset) return new Response(null, { status: 404 });
        return Response.json(providerFixtures[dataset]);
      }),
    });

    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      basemapApiKey: "fixture-key",
      gateway,
      now: () => new Date("2026-07-17T00:00:00.000Z"),
    });

    expect(result.datasets.building_footprints).toMatchObject({
      status: "success",
      featureCount: 1,
      geometry: { features: [{ id: "building-901" }] },
    });
    expect(result.datasets.contours.geometry?.features[0]?.geometry.type).toBe(
      "MultiLineString",
    );
    expect(result.datasets.flood_plains).toMatchObject({
      status: "success",
      featureCount: 0,
      geometry: { features: [] },
    });
    expect(result.datasets.wastewater_assets).toMatchObject({
      status: "success",
      evidenceUse: "internal_reference",
      geometry: { features: [{ id: "ww-pipe-41" }] },
    });
    expect(result.datasets.wastewater_manholes.geometry?.features).toHaveLength(
      1,
    );
    expect(result.datasets.water_fittings.geometry?.features).toHaveLength(1);
    expect(result.datasets.wastewater_fittings.geometry?.features).toHaveLength(
      1,
    );
    expect(result.datasets.culverts).toMatchObject({
      status: "unavailable",
      geometryUsed: null,
    });
    const compactAnalysis = result.scenarioComparison.scenarios.find(
      (analysis) => analysis.scenario.id === "compact",
    );
    expect(compactAnalysis).toMatchObject({
      scenario: {
        id: "compact",
        shellLengthMetres: 5,
        shellWidthMetres: 3,
        constructionAllowanceMetres: 1,
      },
      status: "no_clear_candidate",
      testedRotationsDegrees: [0, 45, 90, 135],
      candidates: [],
      resultWording:
        "No clear candidate area was identified using the tested screening scenarios.",
    });
    expect(result.feasibilityAssessment).toMatchObject({
      analysisVersion: "feasibility-scoring-v1",
      score: 0,
      band: "low_preliminary_feasibility",
      qualification: "normal",
      finalRecommendation:
        "Low preliminary feasibility based on known mapped evidence.",
      confidence: {
        level: expect.stringMatching(/^(high|medium|low)$/),
      },
    });
    expect(
      result.feasibilityAssessment.categories.find(
        (category) => category.id === "available_space",
      ),
    ).toMatchObject({ status: "scored", awardedPoints: 0 });
    expect(
      result.feasibilityAssessment.confidence.factors.find(
        (factor) => factor.id === "easements",
      ),
    ).toMatchObject({ status: "unavailable", awardedPoints: 0 });
    expect(result.blockers).toContain(
      "Watercare geometry is internal reference data only and must be independently verified before action",
    );
  });
});
