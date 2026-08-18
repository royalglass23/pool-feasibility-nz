import {
  formatPoolShellClearanceLabel,
  type PoolShellClearance,
} from "@/modules/spatial/pool-shell-clearances";

type FastPropertyViewMap = {
  getCanvas(): HTMLCanvasElement;
  project(coordinates: [number, number]): { x: number; y: number };
};

export function captureFastPropertyViewMap({
  map,
  clearances,
  visible,
}: {
  map: FastPropertyViewMap;
  clearances: PoolShellClearance[];
  visible: boolean;
}): string {
  const source = map.getCanvas();
  const capture = document.createElement("canvas");
  capture.width = source.width;
  capture.height = source.height;
  const context = capture.getContext("2d");
  if (!context) return source.toDataURL("image/png");

  context.drawImage(source, 0, 0);
  if (visible && clearances.length === 4) {
    drawPoolShellClearanceLabels({
      context,
      map,
      clearances,
      canvasWidth: capture.width,
      canvasHeight: capture.height,
      cssWidth: source.clientWidth || capture.width,
      cssHeight: source.clientHeight || capture.height,
    });
  }
  return capture.toDataURL("image/png");
}

function drawPoolShellClearanceLabels({
  context,
  map,
  clearances,
  canvasWidth,
  canvasHeight,
  cssWidth,
  cssHeight,
}: {
  context: CanvasRenderingContext2D;
  map: FastPropertyViewMap;
  clearances: PoolShellClearance[];
  canvasWidth: number;
  canvasHeight: number;
  cssWidth: number;
  cssHeight: number;
}) {
  const scaleX = canvasWidth / cssWidth;
  const scaleY = canvasHeight / cssHeight;
  const scale = Math.min(scaleX, scaleY);
  const padding = 6 * scale;
  const height = 24 * scale;
  const edgePadding = 4 * scale;
  const inset = 12 * scale;

  context.save();
  context.font = `600 ${14 * scale}px Arial, Helvetica, sans-serif`;
  context.textBaseline = "middle";

  clearances.forEach((clearance, index) => {
    const boundary = map.project(clearance.end);
    const pool = map.project(clearance.start);
    const outwardX = boundary.x - pool.x;
    const outwardY = boundary.y - pool.y;
    const distance = Math.hypot(outwardX, outwardY);
    if (distance === 0) return;

    const label = formatPoolShellClearanceLabel(clearance, index);
    const width = context.measureText(label).width + padding * 2;
    const centreX = boundary.x * scaleX + (outwardX / distance) * inset;
    const centreY = boundary.y * scaleY + (outwardY / distance) * inset;
    const left = clamp(
      centreX - width / 2,
      edgePadding,
      canvasWidth - width - edgePadding,
    );
    const top = clamp(
      centreY - height / 2,
      edgePadding,
      canvasHeight - height - edgePadding,
    );

    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.fillRect(left, top, width, height);
    context.strokeStyle = "rgba(15, 23, 42, 0.28)";
    context.lineWidth = scale;
    context.strokeRect(left, top, width, height);
    context.fillStyle = "#13212a";
    context.fillText(label, left + padding, top + height / 2);
  });

  context.restore();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
