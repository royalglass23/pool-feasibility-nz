import { afterEach, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { PropertyAerialMap } from "@/components/map/property-aerial-map";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";

vi.mock("maplibre-gl", () => {
  class Map {
    private readonly layerVisibility = new globalThis.Map<string, string>();
    private readonly pendingVisibility = new globalThis.Map<string, string>();

    constructor(options: { style: { layers: Array<{ id: string }> } }) {
      for (const layer of options.style.layers) {
        this.layerVisibility.set(layer.id, "visible");
      }
    }

    addControl() {}
    fitBounds() {}
    on() {}
    remove() {}

    once(event: string, callback: () => void) {
      if (event === "idle") {
        queueMicrotask(() => {
          for (const [id, visibility] of this.pendingVisibility) {
            this.layerVisibility.set(id, visibility);
          }
          this.pendingVisibility.clear();
          callback();
        });
      }
    }

    setLayoutProperty(id: string, _name: string, value: string) {
      this.pendingVisibility.set(id, value);
    }

    getCanvas() {
      return {
        toDataURL: () => {
          const visible = [...this.layerVisibility]
            .filter(([, visibility]) => visibility !== "none")
            .map(([id]) => id)
            .join(",");
          return `data:image/png;base64,${Buffer.from(visible).toString("base64")}`;
        },
      };
    }
  }

  class LngLatBounds {
    extend() {
      return this;
    }
  }

  return {
    default: {
      Map,
      LngLatBounds,
      NavigationControl: class NavigationControl {},
    },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("returns report-allowed evidence with derived candidate geometry", async () => {
  vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
  const result = await runDataAccessSpike({
    requestedAddress: "42A Bahari Drive, Ranui, Auckland",
    gateway: createDataAccessGateway(),
    now: () => new Date("2026-07-20T01:02:03.000Z"),
  });
  result.datasets.aerial_imagery = {
    ...result.datasets.aerial_imagery,
    status: "available",
    evidenceUse: "report_allowed",
  };
  result.datasets.building_footprints = {
    ...result.datasets.building_footprints,
    status: "success",
    evidenceUse: "report_allowed",
    geometry: polygonFeatures("building"),
  };
  result.datasets.contours = {
    ...result.datasets.contours,
    status: "success",
    evidenceUse: "spike_only",
    geometry: lineFeatures("contour"),
  };
  result.datasets.wastewater_assets = {
    ...result.datasets.wastewater_assets,
    status: "success",
    evidenceUse: "internal_reference",
    geometry: lineFeatures("wastewater"),
  };
  const compact = result.scenarioComparison.scenarios.find(
    ({ scenario }) => scenario.id === "compact",
  );
  if (!compact) throw new Error("Missing compact scenario fixture");
  compact.candidates = [
    {
      id: "compact-1",
      rank: 1,
      centre: [174.60785, -36.86025],
      rotationDegrees: 0,
      shell: polygonFeatures("shell").features[0],
      envelope: polygonFeatures("envelope").features[0],
      placementEvidence: compact.analysisEvidence,
      constraintIntersections: [],
      mappedServiceDistances: [],
      rankingEvidence: ["Controlled report candidate fixture"],
    },
  ];
  result.scenarioComparison.recommendedShell = {
    scenarioId: "compact",
    label: "Compact",
    lengthMetres: 5,
    widthMetres: 3,
    candidateId: "compact-1",
    status: "likely",
    rationale:
      "Largest successfully placed shell within the best-supported feasibility status.",
  };
  const onSnapshotReady = vi.fn();

  render(
    <PropertyAerialMap
      result={result}
      onRetry={() => {}}
      onSnapshotReady={onSnapshotReady}
    />,
  );

  await waitFor(() => expect(onSnapshotReady).toHaveBeenCalledOnce());
  const dataUrl = onSnapshotReady.mock.calls[0][0] as string;
  const layerIds = Buffer.from(dataUrl.split(",")[1], "base64")
    .toString()
    .split(",");

  expect(layerIds).toEqual([
    "aerial",
    "official-building_footprints",
    "recommended-envelope-fill",
    "recommended-envelope-outline",
    "recommended-shell-fill",
    "recommended-shell-outline",
    "parcel-fill",
    "parcel-outline",
    "address-point",
  ]);
});

function polygonFeatures(id: string) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { id },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [174.6078, -36.8603],
              [174.6079, -36.8603],
              [174.6079, -36.8602],
              [174.6078, -36.8603],
            ],
          ],
        },
      },
    ],
  };
}

function lineFeatures(id: string) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { id },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [174.6078, -36.8603],
            [174.6079, -36.8602],
          ],
        },
      },
    ],
  };
}
