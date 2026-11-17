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

type MapRecord = {
  initialVisibility: Record<string, string>;
  visibility: Record<string, string>;
};

const { importGate, maps } = vi.hoisted(() => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    importGate: { promise, release: () => release() },
    maps: [] as MapRecord[],
  };
});

async function createMapModule() {
  await importGate.promise;
  class Map {
    readonly record: MapRecord;
    constructor({
      style,
    }: {
      style: {
        layers: Array<{ id: string; layout?: { visibility?: string } }>;
      };
    }) {
      const visibility = Object.fromEntries(
        style.layers.map((layer) => [
          layer.id,
          layer.layout?.visibility ?? "visible",
        ]),
      );
      this.record = { initialVisibility: { ...visibility }, visibility };
      maps.push(this.record);
    }
    addControl() {}
    on() {}
    once() {
      return Promise.resolve();
    }
    remove() {}
    fitBounds() {}
    resize() {}
    getCanvas() {
      return {
        style: { setProperty() {} },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      };
    }
    getSource() {
      return { setData() {} };
    }
    getLayer(id: string) {
      return id in this.record.visibility ? {} : undefined;
    }
    getLayoutProperty(id: string) {
      return this.record.visibility[id];
    }
    setLayoutProperty(id: string, property: string, value: string) {
      if (property === "visibility") this.record.visibility[id] = value;
    }
    project([x, y]: [number, number]) {
      return { x: x * 1_000_000, y: y * -1_000_000 };
    }
    unproject([x, y]: [number, number]) {
      return { toArray: () => [x / 1_000_000, y / -1_000_000] };
    }
  }
  class Marker {
    constructor(private readonly options: { element: HTMLElement }) {}
    addTo() {
      return this;
    }
    remove() {}
    setLngLat() {
      return this;
    }
    setOffset() {
      return this;
    }
    getElement() {
      return this.options.element;
    }
  }
  return { Map, Marker, NavigationControl: class {}, setWorkerUrl() {} };
}
vi.mock("maplibre-gl", () => createMapModule());

afterEach(() => {
  cleanup();
});

it("keeps contours and labels hidden when switched off during import, then restores and preserves their visibility", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <FastPropertyView result={result} onRetry={() => {}} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Map layers/ }));
  const contours = screen.getByRole("checkbox", {
    name: "Contours",
  });
  await user.click(contours);
  expect(contours).not.toBeChecked();
  expect(maps).toHaveLength(0);
  importGate.release();
  await waitFor(() => expect(maps).toHaveLength(1));

  for (const id of ["contours", "contour-elevation-labels"]) {
    expect
      .soft(maps[0].initialVisibility[id], `${id} initial visibility`)
      .toBe("none");
    expect.soft(maps[0].visibility[id], `${id} final visibility`).toBe("none");
  }

  await user.click(contours);
  for (const id of ["contours", "contour-elevation-labels"])
    expect(maps[0].visibility[id]).toBe("visible");
  await user.click(contours);
  rerender(
    <FastPropertyView
      result={{ ...result, aerial: { ...result.aerial, state: "error" } }}
      onRetry={() => {}}
    />,
  );
  await waitFor(() => expect(maps).toHaveLength(2));
  for (const id of ["contours", "contour-elevation-labels"]) {
    expect(maps[1].initialVisibility[id]).toBe("none");
    expect(maps[1].visibility[id]).toBe("none");
  }
  await user.click(contours);
  for (const id of ["contours", "contour-elevation-labels"])
    expect(maps[1].visibility[id]).toBe("visible");

  // Start another uncached import to test restoring visibility during loading.
  cleanup();
  let releaseRestoredImport!: () => void;
  const restoredImport = new Promise<void>((resolve) => {
    releaseRestoredImport = resolve;
  });
  vi.doMock("maplibre-gl", async () => {
    await restoredImport;
    return createMapModule();
  });
  render(<FastPropertyView result={result} onRetry={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Map layers/ }));
  const restoredContours = screen.getByRole("checkbox", {
    name: "Contours",
  });
  await user.click(restoredContours);
  await user.click(restoredContours);
  expect(restoredContours).toBeChecked();
  expect(maps).toHaveLength(2);
  releaseRestoredImport();
  await waitFor(() => expect(maps).toHaveLength(3));
  for (const id of ["contours", "contour-elevation-labels"]) {
    expect(maps[2].initialVisibility[id]).toBe("visible");
    expect(maps[2].visibility[id]).toBe("visible");
  }
});

const result = {
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
    parcelId: "synthetic",
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
  firstUsableViewStartedAt: "2026-11-18T00:00:00.000Z",
  fastPathDurationMs: 1,
  detailedChecks: {
    status: "complete",
    retrievedAt: "2026-11-18T00:00:00.000Z",
    durationMs: 1,
    region: "Auckland",
    limitations: [],
    layers: [
      {
        key: "contours",
        state: "returned",
        evidence: { dataset: "Contours", provider: "Auckland Council" },
        message: "Returned 1 feature.",
        geometry: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { Elevation: 50.25 },
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
      },
    ],
  },
} as unknown as FastPropertyViewResult;
