import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FastPropertyView } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const { mapCreated, mapStyles, fitBounds, mapEventHandlers } = vi.hoisted(
  () => ({
    mapCreated: vi.fn(),
    mapStyles: vi.fn(),
    fitBounds: vi.fn(),
    mapEventHandlers: new globalThis.Map<string, (event: MapEvent) => void>(),
  }),
);

type MapEvent = {
  point: { coordinates: [number, number] };
  originalEvent: { stopPropagation: () => void };
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

  return {
    Map,
    NavigationControl: class NavigationControl {},
    default: {
      Map,
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
