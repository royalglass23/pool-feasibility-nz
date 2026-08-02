import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FastPropertyView } from "@/components/fast-property-view";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const { mapCreated } = vi.hoisted(() => ({ mapCreated: vi.fn() }));

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
  mapCreated.mockClear();
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

  const stormwater = screen.getByRole("checkbox", { name: "Stormwater" });
  expect(stormwater).toBeDisabled();
  expect(stormwater).not.toBeChecked();

  const wastewater = screen.getByRole("checkbox", { name: "Wastewater" });
  await user.click(wastewater);
  expect(wastewater).not.toBeChecked();
  expect(mapCreated).toHaveBeenCalledTimes(1);
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
