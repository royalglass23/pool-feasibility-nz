import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FastPropertyView } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const { mapCreated, mapStyles, fitBounds, mapEventHandlers, markerOffsets } = vi.hoisted(
  () => ({
    mapCreated: vi.fn(),
    mapStyles: vi.fn(),
    fitBounds: vi.fn(),
    mapEventHandlers: new globalThis.Map<string, (event: MapEvent) => void>(),
    markerOffsets: [] as [number, number][],
  }),
);

type MapEvent = {
  point: { coordinates: [number, number] };
  originalEvent: { stopPropagation: () => void };
  error?: { message: string };
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
        toDataURL: () => "data:image/png;base64,",
        style: { setProperty() {} },
      };
    }
    getSource() {
      return { setData() {} };
    }
    project([longitude, latitude]: [number, number]) {
      return { x: longitude * 1_000_000, y: latitude * -1_000_000 };
    }
    getLayer() {
      return {};
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
        listener({} as MapEvent);
        return;
      }
      mapEventHandlers.set(
        `${event}:${typeof layerOrHandler === "string" ? layerOrHandler : "map"}`,
        listener,
      );
    }
    dragPan = { disable() {}, enable() {} };
    unproject(point: { coordinates: [number, number] }) {
      return { toArray: () => point.coordinates };
    }
    remove() {}
    setLayoutProperty() {}
    fitBounds(...args: unknown[]) {
      fitBounds(...args);
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
  mapEventHandlers.clear();
  markerOffsets.length = 0;
  vi.unstubAllGlobals();
});

it("keeps unavailable utilities unchecked and preserves the map when a utility is hidden", async () => {
  const user = userEvent.setup();
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

  const detailedChecks = screen
    .getByText("Detailed official checks")
    .closest("details");
  expect(detailedChecks).not.toHaveAttribute("open");
  await user.click(screen.getByText("Detailed official checks"));
  expect(detailedChecks).toHaveAttribute("open");

  const stormwater = screen.getByRole("checkbox", { name: "Stormwater" });
  expect(stormwater).toBeDisabled();
  expect(stormwater).not.toBeChecked();

  const wastewater = screen.getByRole("checkbox", { name: "Wastewater" });
  await user.click(wastewater);
  expect(wastewater).not.toBeChecked();
  expect(mapCreated).toHaveBeenCalledTimes(1);
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
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
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
  render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  mapEventHandlers.get("error:map")?.({
    error: { message: "Failed to fetch aerial tile." },
    sourceId: "aerial",
  } as MapEvent);

  expect(
    await screen.findByText(
      "Aerial imagery could not be loaded. Check the LINZ imagery configuration and retry the fast view.",
    ),
  ).toBeVisible();
});

it("captures the completed Fast Property View canvas for report reuse", async () => {
  const onSnapshotReady = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
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

it("draws the indicative investigation buffer around the selected pool", async () => {
  render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

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
  render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

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
    ({ geometry: { coordinates: [start, end] } }, index) => {
      const [offsetX, offsetY] = markerOffsets[index]!;
      const outwardX = end[0] - start[0];
      const outwardY = start[1] - end[1];

      expect(offsetX * outwardX + offsetY * outwardY).toBeGreaterThan(0);
    },
  );

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
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
      onPlacementChange={onPlacementChange}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
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

it("keeps hidden pool-shell clearances hidden when a system update recreates the map", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  await user.click(
    screen.getByRole("checkbox", { name: "Show pool-shell clearances" }),
  );
  rerender(
    <FastPropertyView
      result={{ ...fastResult, fastPathDurationMs: 121 }}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
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
  render(
    <FastPropertyView
      result={result}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  const style = mapStyles.mock.calls[0]?.[0] as {
    sources: Record<string, unknown>;
    layers: Array<{ id: string }>;
  };
  expect(style.sources).toHaveProperty("contours");
  expect(style.layers).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "contours" })]),
  );

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
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
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
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
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

it("lets touch users move and rotate the pool layout", async () => {
  const onPlacementChange = vi.fn();
  render(
    <FastPropertyView
      result={fastResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
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

  mapEventHandlers.get("touchstart:pool-rotation-handle")!(
    event([174.6083, -36.8602]),
  );
  mapEventHandlers.get("touchmove:map")!(event([174.60835, -36.8602]));
  mapEventHandlers.get("touchend:map")!(event([174.60835, -36.8602]));

  await waitFor(() =>
    expect(onPlacementChange.mock.lastCall?.[0]?.rotationDegrees).not.toBe(0),
  );
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
