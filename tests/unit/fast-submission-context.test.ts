import { describe, expect, it } from "vitest";
import { buildFastSubmissionContext } from "@/components/homeowner-submission-form";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { FastPoolPlacementSnapshot } from "@/modules/data-access-spike/fast-pool-warning";

describe("fast submission terrain provenance", () => {
  it("moves slope-map attribution into the saved source metadata", () => {
    const result = {
      resolvedAddress: {
        addressId: "address-1",
        fullAddress: "Test property",
        coordinates: [174.6, -36.8],
      },
      boundary: {
        state: "confirmed",
        geometry: polygon,
        areaSquareMetres: 400,
        parcelId: "parcel-1",
      },
      detailedChecks: {
        status: "complete",
        limitations: [],
        layers: [],
        terrain: {
          status: "measured",
          averageSlopeDegrees: 4,
          upperSlopeDegrees: 8,
          estimatedFallMetres: 0.4,
          downhillBearingDegrees: 90,
          downhillDirection: "E",
          confidence: "indicative",
          slopeSamples: [
            {
              position: [174.6, -36.8],
              slopeDegrees: 4,
              eastGradient: 0.05,
              northGradient: 0,
            },
          ],
          source: {
            provider: "Land Information New Zealand",
            dataset: "Auckland LiDAR DEM",
            datasetIdentifier: "https://example.test/dem",
            status: "success",
            licenceStatus: "permitted",
            evidenceUse: "spike_only",
            retrievedAt: "2026-09-15T00:00:00.000Z",
            datasetDate: "2024",
            licence: "CC BY 4.0",
            attribution: {
              text: "LINZ elevation attribution",
              url: "https://example.test/attribution",
            },
            geometryUsed: "Derived slope samples",
            attributesUsed: ["slope_degrees"],
            evidenceType: "terrain_elevation_grid",
            confidence: "limited",
          },
        },
      },
    } as unknown as FastPropertyViewResult;
    const placement = {
      dimensions: { lengthMetres: 6.5, widthMetres: 3 },
      poolGeometry: { type: "Feature", properties: {}, geometry: polygon },
      constructionEnvelopeGeometry: {
        type: "Feature",
        properties: {},
        geometry: polygon,
      },
      constructionEnvelopeWithinMappedArea: true,
      clearancesVisible: true,
      position: [174.6, -36.8],
      rotationDegrees: 0,
      warning: {
        status: "no_warning",
        label: "No Warning",
        text: "No mapped conflict was found.",
        recommendation: null,
        conflictingDatasets: [],
        checkingDatasets: [],
      },
    } as FastPoolPlacementSnapshot;

    const context = buildFastSubmissionContext(result, placement);

    expect(context?.layerStates).toContainEqual(
      expect.objectContaining({
        provider: "Land Information New Zealand",
        dataset: "Auckland LiDAR DEM",
        attribution: "LINZ elevation attribution",
        sourceUrl: "https://example.test/attribution",
        featureCount: 1,
      }),
    );
  });
});

const polygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [174.5999, -36.8001],
      [174.6001, -36.8001],
      [174.6001, -36.7999],
      [174.5999, -36.7999],
      [174.5999, -36.8001],
    ],
  ],
};
