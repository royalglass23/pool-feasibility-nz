import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FastPropertyView } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const { mapCreated, fitBounds } = vi.hoisted(() => ({
  mapCreated: vi.fn(),
  fitBounds: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  class Map {
    constructor() {
      mapCreated();
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
    on() {}
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
    expect.objectContaining({ padding: 56, duration: 0, maxZoom: 18 }),
  );

  const stormwater = screen.getByRole("checkbox", { name: "Stormwater" });
  expect(stormwater).toBeDisabled();
  expect(stormwater).not.toBeChecked();

  const wastewater = screen.getByRole("checkbox", { name: "Wastewater" });
  await user.click(wastewater);
  expect(wastewater).not.toBeChecked();
  expect(mapCreated).toHaveBeenCalledTimes(1);
});

it("shows an imagery-based possible existing-pool finding for the selected area", async () => {
  const user = userEvent.setup();
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
  const view = render(
    <FastPropertyView
      result={{
        ...fastResult,
        aerial: { state: "ready", durationMs: 20, attribution: null },
        datasets: { aerial_imagery: { datasetIdentifier: "aerial-imagery" } },
      } as unknown as FastPropertyViewResult}
      isLoadingDetailed={false}
      onLoadDetailed={() => {}}
      onRetry={() => {}}
    />,
  );

  await waitFor(() => expect(mapCreated).toHaveBeenCalledTimes(1));
  await user.click(
    view.getByRole("button", { name: "Check for existing pool" }),
  );

  expect(fetchStub).toHaveBeenCalledWith(
    "/api/internal/aerial-conflicts",
    expect.objectContaining({ method: "POST" }),
  );
  expect(
    await view.findByRole("heading", { name: "Possible existing pool" }),
  ).toBeVisible();
  expect(
    view.getByText(/A rectangular water-like feature is visible/),
  ).toBeVisible();
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
  defaultPool: { id: "compact", label: "Compact", lengthMetres: 6.5, widthMetres: 3 },
  progress: { address: "found", boundary: "found", aerial: "unavailable", detailedChecks: "complete" },
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
