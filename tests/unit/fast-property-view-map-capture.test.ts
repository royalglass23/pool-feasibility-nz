import { afterEach, expect, it, vi } from "vitest";
import { captureFastPropertyViewMap } from "@/modules/reporting/fast-property-view-map-capture";
import type { PoolShellClearance } from "@/modules/spatial/pool-shell-clearances";

const clearances: PoolShellClearance[] = [
  { id: "pool-shell-side-1", label: "1.2 m", metres: 1.2, start: [1, 1], end: [1, 0] },
  { id: "pool-shell-side-2", label: "2.3 m", metres: 2.3, start: [1, 1], end: [2, 1] },
  { id: "pool-shell-side-3", label: "3.4 m", metres: 3.4, start: [1, 1], end: [1, 2] },
  { id: "pool-shell-side-4", label: "4.5 m", metres: 4.5, start: [1, 1], end: [0, 1] },
];

afterEach(() => {
  vi.restoreAllMocks();
});

it("draws all four pool-shell clearance labels into the saved map image", () => {
  const drawImage = vi.fn();
  const fillText = vi.fn();
  const context = {
    drawImage,
    fillText,
    measureText: () => ({ width: 80 }),
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    rect() {},
    clip() {},
    set fillStyle(_value: string) {},
    set strokeStyle(_value: string) {},
    set lineWidth(_value: number) {},
    set font(_value: string) {},
    set textBaseline(_value: CanvasTextBaseline) {},
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,clearance-labels",
  );

  const source = document.createElement("canvas");
  Object.defineProperties(source, {
    width: { value: 600 },
    height: { value: 400 },
    clientWidth: { value: 600 },
    clientHeight: { value: 400 },
  });

  const imageDataUrl = captureFastPropertyViewMap({
    map: {
      getCanvas: () => source,
      project: ([longitude, latitude]) => ({
        x: longitude * 100,
        y: latitude * 100,
      }),
    },
    clearances,
    visible: true,
  });

  expect(imageDataUrl).toBe("data:image/png;base64,clearance-labels");
  expect(drawImage).toHaveBeenCalledWith(source, 0, 0);
  expect(fillText).toHaveBeenCalledWith("Side 1 · 1.2 m", expect.any(Number), expect.any(Number));
  expect(fillText).toHaveBeenCalledWith("Side 2 · 2.3 m", expect.any(Number), expect.any(Number));
  expect(fillText).toHaveBeenCalledWith("Side 3 · 3.4 m", expect.any(Number), expect.any(Number));
  expect(fillText).toHaveBeenCalledWith("Side 4 · 4.5 m", expect.any(Number), expect.any(Number));
});
