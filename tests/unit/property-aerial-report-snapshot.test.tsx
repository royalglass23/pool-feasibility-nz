import { afterEach, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { PropertyAerialMap } from "@/components/map/property-aerial-map";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";

const mapInstances = vi.hoisted(
  () =>
    [] as Array<{
      minZooms: number[];
      dragPan: {
        isEnabled: () => boolean;
      };
      keyboard: {
        isEnabled: () => boolean;
      };
      triggerLayerMouseDown: (
        layer: "placement-shell-fill" | "placement-rotation-handle",
        point: [number, number],
      ) => void;
      triggerMouseMove: (point: [number, number]) => void;
      triggerMouseUp: () => void;
    }>,
);
const mapConstructorOptions = vi.hoisted(
  () =>
    [] as Array<{
      maxBounds: { toArray: () => [[number, number], [number, number]] };
    }>,
);

vi.mock("maplibre-gl", () => {
  class Map {
    private readonly layerVisibility = new globalThis.Map<string, string>();
    private readonly pendingVisibility = new globalThis.Map<string, string>();
    private readonly layerMouseDownHandlers = new globalThis.Map<
      string,
      (event: {
        point: [number, number];
        originalEvent: { stopPropagation: () => void };
      }) => void
    >();
    private mouseMoveHandler:
      ((event: { point: [number, number] }) => void) | undefined;
    private mouseUpHandler: (() => void) | undefined;
    readonly minZooms: number[] = [];
    readonly dragPan = {
      enabled: true,
      disable: () => {
        this.dragPan.enabled = false;
      },
      enable: () => {
        this.dragPan.enabled = true;
      },
      isEnabled: () => this.dragPan.enabled,
    };
    readonly keyboard = {
      enabled: true,
      disable: () => {
        this.keyboard.enabled = false;
      },
      isEnabled: () => this.keyboard.enabled,
    };

    constructor(options: {
      style: { layers: Array<{ id: string }> };
      maxBounds: { toArray: () => [[number, number], [number, number]] };
    }) {
      mapInstances.push(this);
      mapConstructorOptions.push(options);
      for (const layer of options.style.layers) {
        this.layerVisibility.set(layer.id, "visible");
      }
    }

    addControl() {}
    fitBounds() {}
    getZoom() {
      return 17;
    }
    on(event: string, ...handlers: Array<unknown>) {
      if (event === "mousedown") {
        this.layerMouseDownHandlers.set(
          handlers[0] as string,
          handlers[1] as (event: {
            point: [number, number];
            originalEvent: { stopPropagation: () => void };
          }) => void,
        );
      }
      if (event === "mousemove") {
        this.mouseMoveHandler = handlers[0] as (event: {
          point: [number, number];
        }) => void;
      }
      if (event === "mouseup") {
        this.mouseUpHandler = handlers.at(-1) as () => void;
      }
    }
    remove() {}
    setMinZoom(zoom: number) {
      this.minZooms.push(zoom);
    }

    triggerMouseUp() {
      this.mouseUpHandler?.();
    }

    triggerLayerMouseDown(
      layer: "placement-shell-fill" | "placement-rotation-handle",
      point: [number, number],
    ) {
      this.layerMouseDownHandlers.get(layer)?.({
        point,
        originalEvent: { stopPropagation: () => {} },
      });
    }

    triggerMouseMove(point: [number, number]) {
      this.mouseMoveHandler?.({ point });
    }

    unproject(point: [number, number]) {
      return { toArray: () => point };
    }

    getSource() {
      return { setData: () => {} };
    }

    setPaintProperty() {}

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
        style: { cursor: "" },
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
    private west = Infinity;
    private south = Infinity;
    private east = -Infinity;
    private north = -Infinity;

    extend(coordinate: [number, number]) {
      this.west = Math.min(this.west, coordinate[0]);
      this.south = Math.min(this.south, coordinate[1]);
      this.east = Math.max(this.east, coordinate[0]);
      this.north = Math.max(this.north, coordinate[1]);
      return this;
    }

    toArray(): [[number, number], [number, number]] {
      return [
        [this.west, this.south],
        [this.east, this.north],
      ];
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
  mapInstances.length = 0;
  mapConstructorOptions.length = 0;
});

it("keeps the property map camera locked while capturing report evidence", async () => {
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
  const onPlacementChange = vi.fn();

  render(
    <PropertyAerialMap
      result={result}
      onRetry={() => {}}
      onSnapshotReady={onSnapshotReady}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() => expect(onSnapshotReady).toHaveBeenCalledOnce());
  const dataUrl = onSnapshotReady.mock.calls[0][0] as string;
  const layerIds = Buffer.from(dataUrl.split(",")[1], "base64")
    .toString()
    .split(",");

  expect(layerIds).toEqual([
    "aerial",
    "official-wastewater_assets",
    "placement-access-line",
    "placement-construction-line",
    "placement-shell-fill",
    "placement-shell-outline",
    "placement-rotation-guide",
    "placement-rotation-handle",
    "parcel-fill",
    "parcel-outline",
    "address-point",
  ]);
  const parcelCoordinates = result.parcel.geometry.coordinates.flat();
  expect(mapConstructorOptions[0].maxBounds.toArray()).toEqual([
    [
      Math.min(...parcelCoordinates.map(([longitude]) => longitude)),
      Math.min(...parcelCoordinates.map(([, latitude]) => latitude)),
    ],
    [
      Math.max(...parcelCoordinates.map(([longitude]) => longitude)),
      Math.max(...parcelCoordinates.map(([, latitude]) => latitude)),
    ],
  ]);
  expect(mapInstances[0].minZooms).toEqual([17]);
  expect(mapInstances[0].dragPan.isEnabled()).toBe(false);
  expect(mapInstances[0].keyboard.isEnabled()).toBe(false);

  mapInstances[0].triggerLayerMouseDown(
    "placement-shell-fill",
    [174.60785, -36.86025],
  );
  mapInstances[0].triggerMouseMove([174.60786, -36.86024]);
  await waitFor(() =>
    expect(onPlacementChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: [174.60786, -36.86024] }),
    ),
  );

  mapInstances[0].triggerLayerMouseDown(
    "placement-rotation-handle",
    [174.60786, -36.86024],
  );
  mapInstances[0].triggerMouseMove([174.60796, -36.86024]);
  await waitFor(() =>
    expect(onPlacementChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ rotationDegrees: 90 }),
    ),
  );

  mapInstances[0].triggerMouseUp();
  expect(mapInstances[0].dragPan.isEnabled()).toBe(false);
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
