import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FastPropertyView } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const { mapCreated, mapStyles, fitBounds } = vi.hoisted(() => ({
  mapCreated: vi.fn(),
  mapStyles: vi.fn(),
  fitBounds: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  class Map {
    constructor(options: { style?: unknown }) {
      mapCreated();
      mapStyles(options.style);
    }

    addControl() {}
    getCanvas() {
      return { toDataURL: () => "data:image/png;base64," };
    }
    getSource() {
      return { setData() {} };
    }
    getLayer() {
      return {};
    }
    on(event: string, handler: () => void) {
      if (event === "idle") handler();
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
