import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FastPropertyView } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const {
  mapCreated,
  mapStyles,
  fitBounds,
  resizeMap,
  mapEventHandlers,
  markerOffsets,
  getLayer,
  queryRenderedFeatures,
  setLayoutProperty,
  waitForIdle,
  canvasSnapshot,
  setWorkerUrl,
} = vi.hoisted(() => ({
  waitForIdle: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  canvasSnapshot: vi.fn(() => "data:image/png;base64,"),
  getLayer: vi.fn<(id: string) => object | undefined>(() => ({})),
  queryRenderedFeatures: vi.fn<(...args: unknown[]) => unknown[]>(() => []),
  setLayoutProperty: vi.fn(),
  mapCreated: vi.fn(),
  mapStyles: vi.fn(),
  fitBounds: vi.fn(),
  resizeMap: vi.fn(),
  mapEventHandlers: new globalThis.Map<string, (event: MapEvent) => void>(),
  markerOffsets: [] as [number, number][],
  setWorkerUrl: vi.fn<(url: string) => void>(),
}));

type MapEvent = {
  type?: string;
  point: { coordinates: [number, number] };
  originalEvent: { stopPropagation: () => void };
  error?: { message: string; status?: number; body?: Blob };
  sourceId?: string;
};

vi.mock("maplibre-gl", () => {
  class Map {
    constructor(options: { style?: unknown }) {
      mapCreated();
      mapStyles(options.style);
    }

    addControl() {}
    getCanvas() {
      return {
        toDataURL: canvasSnapshot,
        style: { setProperty() {} },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      };
    }
    getSource() {
      return { setData() {} };
    }
    project([longitude, latitude]: [number, number]) {
      return { x: longitude * 1_000_000, y: latitude * -1_000_000 };
    }
    getLayer(id: string) {
      return getLayer(id);
    }
    queryRenderedFeatures(...args: unknown[]) {
      return queryRenderedFeatures(...args);
    }
    on(
      event: string,
      layerOrHandler: string | ((event: MapEvent) => void),
      handler?: (event: MapEvent) => void,
    ) {
      const listener =
        typeof layerOrHandler === "function" ? layerOrHandler : handler;
      if (!listener) return;
      if (event === "idle") {
        mapEventHandlers.set("idle:map", listener);
        listener({} as MapEvent);
        return;
      }
      mapEventHandlers.set(
        `${event}:${typeof layerOrHandler === "string" ? layerOrHandler : "map"}`,
        listener,
      );
    }
    dragPan = { disable() {}, enable() {} };
    unproject(point: { coordinates: [number, number] } | [number, number]) {
      return {
        toArray: () =>
          Array.isArray(point)
            ? [point[0] / 1_000_000, point[1] / -1_000_000]
            : point.coordinates,
      };
    }
    remove() {}
    setLayoutProperty(...args: unknown[]) {
      setLayoutProperty(...args);
    }
    getLayoutProperty() {
      return "visible";
    }
    once() {
      return waitForIdle();
    }
    fitBounds(...args: unknown[]) {
      fitBounds(...args);
    }
    resize() {
      resizeMap();
      return this;
    }
  }

  class Marker {
    private lngLat: [number, number] | undefined;

    constructor(private readonly options: { element: HTMLElement }) {}

    addTo() {
      if (!this.lngLat) {
        throw new Error("A marker must have a position before it is added.");
      }
      document.body.append(this.options.element);
      return this;
    }
    getElement() {
      return this.options.element;
    }
    remove() {
      this.options.element.remove();
      return this;
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat;
      return this;
    }
    setOffset(offset: [number, number]) {
      markerOffsets.push(offset);
      return this;
    }
  }

  return {
    Map,
    Marker,
    NavigationControl: class NavigationControl {},
    setWorkerUrl,
    default: {
      Map,
      Marker,
      NavigationControl: class NavigationControl {},
    },
  };
});

afterEach(() => {
  cleanup();
  mapCreated.mockClear();
  mapStyles.mockClear();
  fitBounds.mockClear();
  resizeMap.mockClear();
  mapEventHandlers.clear();
  markerOffsets.length = 0;
  vi.unstubAllGlobals();
  waitForIdle.mockReset().mockImplementation(() => Promise.resolve());
  canvasSnapshot.mockReset().mockReturnValue("data:image/png;base64,");
  setWorkerUrl.mockClear();
  setLayoutProperty.mockClear();
});

function openMapLayers() {
  const toggle = screen.getByRole("button", { name: /Map layers/ });
  if (toggle.getAttribute("aria-expanded") === "false") {
    fireEvent.click(toggle);
  }
}

it("draws a preliminary suggested route on the property map", async () => {
  const suggestedRoute = {
    type: "LineString" as const,
    coordinates: [
      [174.76, -36.85],
      [174.7601, -36.8499],
    ],
  };
  render(
    <FastPropertyView
      result={fastResult}
      suggestedRoute={suggestedRoute}
      onRetry={() => {}}
    />,
  );
  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: Record<string, { data: { geometry?: unknown } }>;
    layers: { id: string }[];
  };
  expect(style.sources["suggested-access-route"].data.geometry).toEqual(
    suggestedRoute,
  );
  expect(style.layers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "suggested-access-route" }),
    ]),
  );
});

it("keeps the route map source empty when no credible route exists", async () => {
  render(
    <FastPropertyView
      result={fastResult}
      suggestedRoute={null}
      onRetry={() => {}}
    />,
  );
  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: Record<string, { data: { features?: unknown[] } }>;
  };
  expect(style.sources["suggested-access-route"].data.features).toEqual([]);
});

it("keeps map layers collapsed until the user asks to see them", async () => {
  render(<FastPropertyView result={fastResult} onRetry={() => {}} />);

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const toggle = screen.getByRole("button", { name: /Map layers/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("checkbox", { name: "Show pool-shell clearances" }),
  ).not.toBeInTheDocument();

  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("checkbox", { name: "Show pool-shell clearances" }),
  ).toBeVisible();
});

it("keeps live notices above the workspace and next actions with the pool layout", async () => {
  render(
    <FastPropertyView
      result={{
        ...fastResult,
        progress: { ...fastResult.progress, detailedChecks: "not_loaded" },
        detailedChecks: undefined,
      }}
      onRetry={() => {}}
      onLoadDetailed={() => {}}
      onStartAgain={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const aerialMapFrame = screen.getByTestId("aerial-map-frame");
  const notices = screen.getByLabelText("Property check notices");
  const poolLayout = screen.getByLabelText(
    "Pool catalogue and placement controls",
  );

  expect(notices).toContainElement(
    screen.getByRole("heading", { name: "Needs Checking" }),
  );
  expect(notices).toHaveTextContent(
    "Some mapped evidence still needs checking for this pool position.",
  );
  expect(notices).toHaveTextContent("View details");
  expect(notices).toHaveTextContent(
    "An aerial photo isn't available for this property.",
  );
  expect(aerialMapFrame).not.toContainElement(
    screen.getByRole("heading", { name: "Needs Checking" }),
  );
  expect(poolLayout).toContainElement(
    screen.getByRole("button", { name: "Check for constraints" }),
  );
  expect(poolLayout).toContainElement(
    screen.getByRole("button", { name: "Start again" }),
  );
});

it("keeps the rotate control visible and interactive while taking a snapshot", async () => {
  const onSnapshotReady = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      onRetry={() => {}}
      onSnapshotReady={onSnapshotReady}
    />,
  );
  await waitFor(() => expect(onSnapshotReady).toHaveBeenCalled());
  expect(setWorkerUrl).toHaveBeenCalledWith("/maplibre/maplibre-gl-worker.mjs");
  expect(waitForIdle).not.toHaveBeenCalled();
  expect(screen.getByTestId("pool-rotate-control")).toBeVisible();
  mapEventHandlers.get("idle:map")?.({} as MapEvent);
  expect(screen.getByTestId("pool-rotate-control")).toBeVisible();
});

it.each(["layer", "camera", "clearances"])(
  "refreshes the snapshot after a %s change without hiding rotation",
  async (change) => {
    const onSnapshotReady = vi.fn();
    render(
      <FastPropertyView
        result={fastResult}
        onRetry={() => {}}
        onSnapshotReady={onSnapshotReady}
      />,
    );
    await waitFor(() => expect(canvasSnapshot).toHaveBeenCalled());
    if (change === "camera")
      mapEventHandlers.get("movestart:map")?.({} as MapEvent);
    else {
      openMapLayers();
      await userEvent.setup().click(
        screen.getByRole("checkbox", {
          name:
            change === "layer" ? "Wastewater" : "Show pool-shell clearances",
        }),
      );
    }
    expect(onSnapshotReady).toHaveBeenLastCalledWith(null);
    canvasSnapshot.mockReturnValue("data:image/png;base64,new");
    mapEventHandlers.get("idle:map")?.({} as MapEvent);
    expect(onSnapshotReady).toHaveBeenLastCalledWith({
      imageDataUrl: "data:image/png;base64,new",
      visibleLayerKeys: change === "layer" ? [] : ["wastewater_assets"],
    });
    expect(screen.getByTestId("pool-rotate-control")).toBeVisible();
  },
);

it("shows detailed map controls without restoring the detailed checks panel", async () => {
  render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  expect(fitBounds).toHaveBeenCalledWith(
    [
      [174.608, -36.8604],
      [174.6084, -36.8601],
    ],
    expect.objectContaining({ padding: 56, duration: 0, maxZoom: 20 }),
  );

  expect(
    screen.queryByText("Detailed official checks"),
  ).not.toBeInTheDocument();
  openMapLayers();
  expect(screen.getByRole("checkbox", { name: "Contours" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Stormwater" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Wastewater" })).toBeChecked();
  expect(mapCreated).toHaveBeenCalledTimes(1);
});

it("shows location-based slope shading and selected-pool terrain details", async () => {
  const user = userEvent.setup();
  render(
    <FastPropertyView
      result={{
        ...fastResult,
        detailedChecks: {
          ...fastResult.detailedChecks!,
          terrain: {
            status: "measured",
            averageSlopeDegrees: 2.4,
            upperSlopeDegrees: 3.8,
            estimatedFallMetres: 0.36,
            downhillBearingDegrees: 135,
            downhillDirection: "SE",
            confidence: "indicative",
            slopeSamples: [
              [174.60818, -36.86026],
              [174.60819, -36.86026],
              [174.6082, -36.86026],
              [174.60818, -36.86025],
              [174.60819, -36.86025],
              [174.6082, -36.86025],
              [174.608244, -36.86025],
            ].map((position, index) => ({
              position: position as [number, number],
              slopeDegrees: 2 + index * 3,
              eastGradient: 0.04,
              northGradient: 0.03,
            })),
            source: {
              provider: "Land Information New Zealand",
              dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
              datasetIdentifier:
                "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
              status: "success",
              licenceStatus: "permitted",
              evidenceUse: "spike_only",
              retrievedAt: "2026-09-14T00:00:00.000Z",
              datasetDate: "2024-04-30/2024-06-27",
              licence: "Creative Commons Attribution 4.0 International",
              attribution: {
                text: "Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited, for re-use under the Creative Commons Attribution 4.0 International licence.",
                url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data",
              },
              geometryUsed: "Bounded 1 m bare-earth elevation grid in NZTM2000",
              attributesUsed: ["elevation_metres"],
              evidenceType: "terrain_elevation_grid",
              confidence: "limited",
            },
          },
        },
      }}
      onRetry={() => {}}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Indicative property slope" }),
  ).toBeVisible();
  expect(
    screen.getByLabelText(
      "Indicative property slope: average 2.4 degrees, downhill SE",
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Across the mapped property parcel, not the selected pool position",
    ),
  ).toBeVisible();
  expect(screen.getByText("Average slope")).toBeVisible();
  expect(screen.getByText("Steeper areas")).toBeVisible();
  expect(
    screen.getByText("90% of sampled areas are at or below this angle."),
  ).toBeVisible();
  expect(screen.getByText("Estimated height change")).toBeVisible();
  expect(screen.getByText("Overall downhill direction")).toBeVisible();
  expect(screen.getByText("2.4°")).toBeVisible();
  expect(screen.getByText("3.8°")).toBeVisible();
  expect(screen.getByText("0.36 m")).toBeVisible();
  expect(screen.getByText("SE")).toBeVisible();
  expect(
    screen.queryByRole("link", {
      name: /Sourced from the LINZ Data Service and licensed by Regional Software Holdings Limited/i,
    }),
  ).not.toBeInTheDocument();
  openMapLayers();
  expect(screen.getByRole("checkbox", { name: "Slope shading" })).toBeChecked();
  expect(screen.getByText("Lower slope on this property")).toBeVisible();
  expect(screen.getByText("Medium slope on this property")).toBeVisible();
  expect(screen.getByText("Higher slope on this property")).toBeVisible();
  expect(
    screen.getByText(
      "Relative visual guide only—not a suitability or engineering classification.",
    ),
  ).toBeVisible();
  expect(screen.queryByText(/0–5°|5–15°|15°\+/)).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: "Selected pool position",
    }),
  ).toBeVisible();
  expect(screen.getByText("Average slope here")).toBeVisible();
  expect(screen.getByText("Estimated height change here")).toBeVisible();
  expect(screen.getByText("11.0°")).toBeVisible();
  expect(screen.getByText(/Based on 7 nearby terrain samples/i)).toBeVisible();

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: Record<string, unknown>;
    layers: Array<{ id: string; paint?: Record<string, unknown> }>;
  };
  expect(style.sources).toHaveProperty("terrain-slope");
  expect(style.layers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "terrain-slope",
        paint: expect.objectContaining({
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "relativeSlope"],
            0,
            "#16a34a",
            0.5,
            "#f59e0b",
            1,
            "#dc2626",
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            3,
            18,
            12,
            20,
            22,
          ],
          "circle-opacity": 0.1,
          "circle-blur": 0.72,
        }),
      }),
    ]),
  );

  await user.click(screen.getByRole("checkbox", { name: "Slope shading" }));
  expect(
    screen.getByRole("checkbox", { name: "Slope shading" }),
  ).not.toBeChecked();
  expect(setLayoutProperty).toHaveBeenCalledWith(
    "terrain-slope",
    "visibility",
    "none",
  );
});

it("does not expose or emit pool placement while the boundary is loading", async () => {
  const onPlacementChange = vi.fn();
  render(
    <FastPropertyView
      result={{
        ...fastResult,
        boundary: {
          state: "loading",
          geometry: null,
          areaSquareMetres: null,
          parcelId: null,
        },
        progress: { ...fastResult.progress, boundary: "loading" },
      }}
      onRetry={() => {}}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  expect(onPlacementChange).not.toHaveBeenCalled();
  expect(
    screen.queryByLabelText("Pool catalogue and placement controls"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Choose a pool layout" }),
  ).not.toBeInTheDocument();
});

it("explains an aerial tile failure instead of swallowing the MapLibre error", async () => {
  render(<FastPropertyView result={fastResult} onRetry={() => {}} />);

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  mapEventHandlers.get("error:map")?.({
    error: { message: "Failed to fetch aerial tile." },
    sourceId: "aerial",
  } as MapEvent);

  expect(
    await screen.findByText(
      "We couldn't load the aerial photo. You can still review the property boundary; try the property check again in a minute.",
    ),
  ).toBeVisible();
});

it.each([
  [
    429,
    "RATE_LIMITED",
    "aerial-rate-reference",
    "Aerial photo requests have reached their temporary limit. You can still review the property boundary; please wait before trying again.",
  ],
  [
    503,
    "RATE_LIMIT_UNAVAILABLE",
    "aerial-limiter-reference",
    "Aerial photo requests are paused because the request limit service is unavailable. You can still review the property boundary; please try again shortly.",
  ],
])(
  "identifies an aerial tile limiter response (%s) without blaming the imagery provider",
  async (status, code, correlationId, expectedMessage) => {
    render(<FastPropertyView result={fastResult} onRetry={() => {}} />);

    await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
    mapEventHandlers.get("error:map")?.({
      error: {
        message: `AJAXError (${status})`,
        status,
        body: new Blob([
          JSON.stringify({
            error: {
              code,
              message: "Please try again shortly.",
              correlationId,
            },
          }),
        ]),
      },
      sourceId: "aerial",
    } as MapEvent);

    expect(await screen.findByText(expectedMessage)).toBeVisible();
    expect(screen.queryByText(/LINZ key/i)).not.toBeInTheDocument();
  },
);

it("captures the completed Fast Property View canvas for report reuse", async () => {
  const onSnapshotReady = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      onRetry={() => {}}
      onSnapshotReady={onSnapshotReady}
    />,
  );

  await waitFor(() =>
    expect(onSnapshotReady).toHaveBeenCalledWith({
      imageDataUrl: "data:image/png;base64,",
      visibleLayerKeys: ["wastewater_assets"],
    }),
  );
});

it("resizes and refits the parcel before recapturing after the map frame changes size", async () => {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const onSnapshotReady = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      onRetry={() => {}}
      onSnapshotReady={onSnapshotReady}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(resizeCallbacks).toHaveLength(1));
  fitBounds.mockClear();
  onSnapshotReady.mockClear();

  resizeCallbacks[0]!([], {} as ResizeObserver);

  expect(resizeMap).toHaveBeenCalledTimes(1);
  expect(fitBounds).toHaveBeenCalledWith(expect.anything(), {
    padding: 56,
    duration: 0,
    maxZoom: 20,
  });
  expect(onSnapshotReady).toHaveBeenLastCalledWith(null);
});

it("draws the indicative investigation buffer around the selected pool", async () => {
  render(<FastPropertyView result={fastResult} onRetry={() => {}} />);

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: Record<string, unknown>;
    layers: Array<{ id: string }>;
  };

  expect(style.sources).toHaveProperty("construction-envelope");
  expect(style.layers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "pool-shell-clearance-lines",
        source: "pool-shell-clearances",
        paint: {
          "line-color": "#fff",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      }),
      expect.objectContaining({
        id: "construction-envelope-line",
        source: "construction-envelope",
        paint: {
          "line-color": "#f97316",
          "line-width": 3,
          "line-dasharray": [3, 2],
        },
      }),
    ]),
  );
});

it("positions each visible clearance label outside the mapped boundary", async () => {
  const user = userEvent.setup();
  render(<FastPropertyView result={fastResult} onRetry={() => {}} />);

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  expect(screen.getAllByText(/^Side [1-4] · \d+\.\d m$/)).toHaveLength(4);
  expect(markerOffsets).toHaveLength(4);

  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: {
      "pool-shell-clearances": {
        data: {
          features: Array<{
            geometry: { coordinates: [[number, number], [number, number]] };
          }>;
        };
      };
    };
  };
  style.sources["pool-shell-clearances"].data.features.forEach(
    (
      {
        geometry: {
          coordinates: [start, end],
        },
      },
      index,
    ) => {
      const [offsetX, offsetY] = markerOffsets[index]!;
      const outwardX = end[0] - start[0];
      const outwardY = start[1] - end[1];

      expect(offsetX * outwardX + offsetY * outwardY).toBeGreaterThan(0);
    },
  );

  openMapLayers();
  await user.click(
    screen.getByRole("checkbox", { name: "Show pool-shell clearances" }),
  );
  expect(screen.queryByText(/^Side 1 · \d+\.\d m$/)).not.toBeInTheDocument();
});

it("shows live pool-shell clearances by default and preserves the selected visibility while the pool moves", async () => {
  const user = userEvent.setup();
  const onPlacementChange = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      onRetry={() => {}}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  openMapLayers();
  expect(
    screen.getByRole("checkbox", { name: "Show pool-shell clearances" }),
  ).toBeChecked();
  expect(onPlacementChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ clearancesVisible: true }),
  );

  await user.click(
    screen.getByRole("checkbox", { name: "Show pool-shell clearances" }),
  );
  expect(onPlacementChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ clearancesVisible: false }),
  );

  const event: MapEvent = {
    point: { coordinates: [174.6083, -36.8602] },
    originalEvent: { stopPropagation() {} },
  };
  mapEventHandlers.get("mousedown:pool-fill")!(event);
  mapEventHandlers.get("mousemove:map")!(event);
  mapEventHandlers.get("mouseup:map")!(event);

  await waitFor(() =>
    expect(onPlacementChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: [174.6083, -36.8602],
        clearancesVisible: false,
      }),
    ),
  );
});

it.each(["drag", "rotate"] as const)(
  "keeps parcel slope visible and the existing map instance after pool %s",
  async (interaction) => {
    render(
      <FastPropertyView
        result={{
          ...fastResult,
          detailedChecks: {
            ...fastResult.detailedChecks!,
            terrain: {
              status: "measured" as const,
              averageSlopeDegrees: 2.4,
              upperSlopeDegrees: 3.8,
              estimatedFallMetres: 0.36,
              downhillBearingDegrees: 135,
              downhillDirection: "SE" as const,
              confidence: "indicative" as const,
              source: {
                provider: "Land Information New Zealand",
                dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
                datasetIdentifier: "linz-dem",
                status: "success" as const,
                licenceStatus: "permitted" as const,
                evidenceUse: "spike_only" as const,
                retrievedAt: "2026-09-14T00:00:00.000Z",
                datasetDate: "2024",
                licence: "CC BY 4.0",
                attribution: null,
                geometryUsed: "mapped property parcel",
                attributesUsed: ["elevation_metres"],
                evidenceType: "terrain_elevation_grid",
                confidence: "limited" as const,
              },
            },
          },
        }}
        onRetry={() => {}}
        onPlacementChange={() => {}}
      />,
    );
    await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));

    if (interaction === "drag") {
      const event: MapEvent = {
        point: { coordinates: [174.6083, -36.8602] },
        originalEvent: { stopPropagation() {} },
      };
      mapEventHandlers.get("mousedown:pool-fill")!(event);
      mapEventHandlers.get("mousemove:map")!(event);
      mapEventHandlers.get("mouseup:map")!(event);
    } else {
      const rotateControl = screen.getByTestId("pool-rotate-control");
      Object.assign(rotateControl, {
        setPointerCapture: vi.fn(),
        hasPointerCapture: vi.fn(() => true),
        releasePointerCapture: vi.fn(),
      });
      fireEvent.pointerDown(rotateControl, { pointerId: 1 });
      fireEvent.pointerMove(rotateControl, {
        pointerId: 1,
        clientX: 174_608_350,
        clientY: 36_860_200,
      });
      fireEvent.pointerUp(rotateControl, { pointerId: 1 });
    }

    expect(
      screen.getByRole("heading", { name: "Indicative property slope" }),
    ).toBeVisible();
    expect(
      screen.getByLabelText(
        "Indicative property slope: average 2.4 degrees, downhill SE",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/The pool position changed\./i),
    ).not.toBeInTheDocument();
    expect(mapCreated).toHaveBeenCalledTimes(1);
  },
);

it("keeps hidden pool-shell clearances hidden when a map input update recreates the map", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <FastPropertyView result={fastResult} onRetry={() => {}} />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  openMapLayers();
  await user.click(
    screen.getByRole("checkbox", { name: "Show pool-shell clearances" }),
  );
  rerender(
    <FastPropertyView
      result={{
        ...fastResult,
        aerial: { ...fastResult.aerial, state: "error" },
      }}
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(2));
  const recreatedStyle = mapStyles.mock.calls[1]?.[0] as {
    sources: Record<string, { data: { features: unknown[] } }>;
  };
  expect(recreatedStyle.sources["pool-shell-clearances"].data.features).toEqual(
    [],
  );
});

it("draws returned contours and lets the user hide them", async () => {
  const user = userEvent.setup();
  const detailedChecks = fastResult.detailedChecks!;
  const result = {
    ...fastResult,
    detailedChecks: {
      ...detailedChecks,
      layers: [
        ...detailedChecks.layers,
        {
          key: "contours",
          state: "returned",
          evidence: {
            dataset: "Contours 2016 - 0.25 metre contours",
            provider: "Auckland Council",
          },
          geometry: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { elevation: 20 },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [174.608, -36.8603],
                    [174.6084, -36.8602],
                  ],
                },
              },
            ],
          },
          message: "Returned 1 mapped feature.",
        },
      ],
    },
  } as unknown as FastPropertyViewResult;
  render(<FastPropertyView result={result} onRetry={() => {}} />);

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: Record<string, unknown>;
    layers: Array<{ id: string }>;
  };
  expect(style.sources).toHaveProperty("contours");
  expect(style.layers).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "contours" })]),
  );
  openMapLayers();
  const contours = screen.getByRole("checkbox", { name: "Contours" });
  expect(contours).toBeChecked();
  await user.click(contours);
  expect(contours).not.toBeChecked();
});

it("does not run an aerial existing-pool check when the map becomes ready", async () => {
  const fetchStub = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      source: "provider",
      findings: [
        {
          type: "possible_existing_pool",
          confidence: "medium",
          explanation: "A rectangular water-like feature is visible.",
          evidenceStatus: "possible",
          inspectionRequirement: "required",
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetchStub);
  render(
    <FastPropertyView
      result={
        {
          ...fastResult,
          aerial: { state: "ready", durationMs: 20, attribution: null },
          datasets: { aerial_imagery: { datasetIdentifier: "aerial-imagery" } },
        } as unknown as FastPropertyViewResult
      }
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  expect(fetchStub).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("heading", { name: /existing pool/i }),
  ).not.toBeInTheDocument();
});

it("keeps shell geometry separate when its construction envelope does not fit", async () => {
  const onPlacementChange = vi.fn();
  const narrowResult = {
    ...fastResult,
    resolvedAddress: {
      ...fastResult.resolvedAddress,
      coordinates: [174.6082, -36.8603],
    },
    boundary: {
      ...fastResult.boundary,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.60816, -36.86032],
            [174.60824, -36.86032],
            [174.60824, -36.86028],
            [174.60816, -36.86028],
            [174.60816, -36.86032],
          ],
        ],
      },
    },
  } as unknown as FastPropertyViewResult;

  render(
    <FastPropertyView
      result={narrowResult}
      onRetry={() => {}}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() => expect(onPlacementChange).toHaveBeenCalled());
  expect(onPlacementChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      poolGeometry: expect.objectContaining({
        geometry: expect.objectContaining({ type: "Polygon" }),
      }),
      constructionEnvelopeGeometry: expect.objectContaining({
        geometry: expect.objectContaining({ type: "Polygon" }),
      }),
      constructionEnvelopeWithinMappedArea: false,
    }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "This size does not fit inside the available mapped area.",
  );
});

it("lets touch users move the pool layout", async () => {
  const onPlacementChange = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      onRetry={() => {}}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() =>
    expect(mapEventHandlers.get("touchstart:pool-fill")).toBeTypeOf("function"),
  );
  const event = (coordinates: [number, number]): MapEvent => ({
    point: { coordinates },
    originalEvent: { stopPropagation() {} },
  });

  mapEventHandlers.get("touchstart:pool-fill")!(event([174.60825, -36.86025]));
  mapEventHandlers.get("touchmove:map")!(event([174.6083, -36.8602]));
  mapEventHandlers.get("touchend:map")!(event([174.6083, -36.8602]));

  await waitFor(() =>
    expect(onPlacementChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: [174.6083, -36.8602] }),
    ),
  );
});

it("silently keeps the pool at its last valid position at the mapped boundary", async () => {
  const onPlacementChange = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      onRetry={() => {}}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() =>
    expect(mapEventHandlers.get("touchstart:pool-fill")).toBeTypeOf("function"),
  );
  const event = (coordinates: [number, number]): MapEvent => ({
    point: { coordinates },
    originalEvent: { stopPropagation() {} },
  });
  const validPosition = onPlacementChange.mock.lastCall?.[0].position;

  mapEventHandlers.get("touchstart:pool-fill")!(event(validPosition));
  mapEventHandlers.get("touchmove:map")!(event([174.609, -36.86]));
  mapEventHandlers.get("touchend:map")!(event([174.609, -36.86]));

  expect(onPlacementChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ position: validPosition }),
  );
  expect(
    screen.queryByText(
      "The construction envelope must remain inside the mapped property area.",
    ),
  ).not.toBeInTheDocument();
});

const fastResult = {
  requestedAddress: "42A Bahari Drive, Ranui, Auckland",
  resolvedAddress: {
    addressId: "2359811",
    fullAddress: "42A Bahari Drive, Ranui, Auckland",
    fullAddressNumber: "42A",
    unit: null,
    territorialAuthority: "Auckland",
    coordinates: [174.6082, -36.8603],
  },
  boundary: {
    state: "confirmed",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [174.608, -36.8604],
          [174.6084, -36.8604],
          [174.6084, -36.8601],
          [174.608, -36.8601],
          [174.608, -36.8604],
        ],
      ],
    },
    areaSquareMetres: 246,
    parcelId: "parcel-1",
  },
  aerial: { state: "unavailable", durationMs: null, attribution: null },
  defaultPool: {
    id: "compact",
    label: "Compact",
    lengthMetres: 6.5,
    widthMetres: 3,
  },
  progress: {
    address: "found",
    boundary: "found",
    aerial: "unavailable",
    detailedChecks: "complete",
  },
  firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
  fastPathDurationMs: 120,
  detailedChecks: {
    status: "complete",
    retrievedAt: "2026-07-28T00:00:01.000Z",
    durationMs: 30,
    region: "Auckland",
    limitations: [],
    layers: [
      {
        key: "wastewater_assets",
        state: "returned",
        evidence: { dataset: "Wastewater Pipes", provider: "Watercare" },
        geometry: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [174.608, -36.8604],
                  [174.6084, -36.8601],
                ],
              },
            },
          ],
        },
        message: "Returned 1 mapped feature.",
      },
    ],
  },
} as unknown as FastPropertyViewResult;

it("waits for pool interaction layers before querying a hovering pointer", async () => {
  render(<FastPropertyView result={fastResult} onRetry={() => {}} />);
  await waitFor(() =>
    expect(mapEventHandlers.get("mousemove:map")).toBeTypeOf("function"),
  );
  const event = {
    type: "mousemove",
    point: { coordinates: [174.6082, -36.8603] },
    originalEvent: { stopPropagation() {} },
  } as MapEvent;
  try {
    getLayer.mockImplementation((id) => (id === "pool-fill" ? undefined : {}));
    mapEventHandlers.get("mousemove:map")!(event);
    expect(queryRenderedFeatures).not.toHaveBeenCalled();
    getLayer.mockImplementation(() => ({}));
    mapEventHandlers.get("mousemove:map")!(event);
    expect(queryRenderedFeatures).toHaveBeenCalledWith(event.point, {
      layers: ["pool-fill"],
    });
  } finally {
    getLayer.mockImplementation(() => ({}));
  }
});
