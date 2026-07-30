import "server-only";
import { deflateSync } from "node:zlib";
import type { Geometry } from "geojson";

const WIDTH = 900;
const HEIGHT = 600;
const PADDING = 56;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type Point = [number, number];
type Colour = readonly [number, number, number, number];

export async function renderTrustedAssessmentMap(input: {
  boundary: Geometry | null;
  shell: Geometry;
  constructionEnvelope: Geometry;
  warning: "no_warning" | "needs_checking" | "blocked";
}): Promise<string> {
  const sourcePoints = [input.boundary, input.shell, input.constructionEnvelope]
    .filter((geometry): geometry is Geometry => geometry !== null)
    .flatMap(coordinates);
  if (sourcePoints.length === 0)
    throw new Error("TRUSTED_MAP_GEOMETRY_MISSING");
  const xs = sourcePoints.map(([x]) => x);
  const ys = sourcePoints.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / Math.max(maxX - minX, 0.00001),
    (HEIGHT - PADDING * 2) / Math.max(maxY - minY, 0.00001),
  );
  const project = ([x, y]: Point): Point => [
    Math.round(PADDING + (x - minX) * scale),
    Math.round(HEIGHT - PADDING - (y - minY) * scale),
  ];
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  fillCanvas(pixels, [248, 250, 252, 255]);
  drawGrid(pixels);
  if (input.boundary) {
    const boundaryRings = rings(input.boundary).map((ring) =>
      ring.map(project),
    );
    fillGeometry(pixels, boundaryRings, [204, 251, 241, 180]);
    strokeGeometry(pixels, boundaryRings, [15, 118, 110, 255], 3);
  }
  strokeGeometry(
    pixels,
    rings(input.constructionEnvelope).map((ring) => ring.map(project)),
    [249, 115, 22, 255],
    3,
    true,
  );
  const poolColour: Colour =
    input.warning === "blocked"
      ? [220, 38, 38, 180]
      : input.warning === "needs_checking"
        ? [217, 119, 6, 180]
        : [22, 163, 74, 180];
  const shellRings = rings(input.shell).map((ring) => ring.map(project));
  fillGeometry(pixels, shellRings, poolColour);
  strokeGeometry(pixels, shellRings, [15, 23, 42, 255], 3);
  const png = encodePng(pixels);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function coordinates(geometry: Geometry): Point[] {
  return rings(geometry).flat();
}

function rings(geometry: Geometry): Point[][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates
      .map(toPoints)
      .filter((ring) => ring.length >= 3);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) =>
      polygon.map(toPoints).filter((ring) => ring.length >= 3),
    );
  }
  return [];
}

function toPoints(coordinates: number[][]): Point[] {
  return coordinates.flatMap(([x, y]) =>
    Number.isFinite(x) && Number.isFinite(y) ? [[x, y] as Point] : [],
  );
}

function fillCanvas(pixels: Uint8Array, colour: Colour) {
  for (let offset = 0; offset < pixels.length; offset += 4)
    pixels.set(colour, offset);
}

function drawGrid(pixels: Uint8Array) {
  for (let x = PADDING; x <= WIDTH - PADDING; x += 80) {
    drawLine(
      pixels,
      [x, PADDING],
      [x, HEIGHT - PADDING],
      [226, 232, 240, 255],
      1,
    );
  }
  for (let y = PADDING; y <= HEIGHT - PADDING; y += 80) {
    drawLine(
      pixels,
      [PADDING, y],
      [WIDTH - PADDING, y],
      [226, 232, 240, 255],
      1,
    );
  }
}

function fillGeometry(
  pixels: Uint8Array,
  geometryRings: Point[][],
  colour: Colour,
) {
  for (let y = 0; y < HEIGHT; y += 1) {
    const intersections: number[] = [];
    for (const ring of geometryRings) {
      for (let index = 0; index < ring.length; index += 1) {
        const start = ring[index];
        const end = ring[(index + 1) % ring.length];
        if (start[1] > y === end[1] > y) continue;
        intersections.push(
          start[0] +
            ((y - start[1]) * (end[0] - start[0])) / (end[1] - start[1]),
        );
      }
    }
    intersections.sort((left, right) => left - right);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      for (
        let x = Math.ceil(intersections[index]);
        x <= Math.floor(intersections[index + 1]);
        x += 1
      ) {
        blendPixel(pixels, x, y, colour);
      }
    }
  }
}

function strokeGeometry(
  pixels: Uint8Array,
  geometryRings: Point[][],
  colour: Colour,
  width: number,
  dashed = false,
) {
  for (const ring of geometryRings) {
    for (let index = 0; index < ring.length; index += 1) {
      drawLine(
        pixels,
        ring[index],
        ring[(index + 1) % ring.length],
        colour,
        width,
        dashed,
      );
    }
  }
}

function drawLine(
  pixels: Uint8Array,
  start: Point,
  end: Point,
  colour: Colour,
  width: number,
  dashed = false,
) {
  let [x, y] = start;
  const [endX, endY] = end;
  const deltaX = Math.abs(endX - x);
  const deltaY = Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = deltaX - deltaY;
  let step = 0;
  const radius = Math.floor(width / 2);
  while (true) {
    if (!dashed || Math.floor(step / 10) % 2 === 0) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1)
          blendPixel(pixels, x + offsetX, y + offsetY, colour);
      }
    }
    if (x === endX && y === endY) break;
    const doubledError = error * 2;
    if (doubledError > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubledError < deltaX) {
      error += deltaX;
      y += stepY;
    }
    step += 1;
  }
}

function blendPixel(pixels: Uint8Array, x: number, y: number, colour: Colour) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 4;
  const alpha = colour[3] / 255;
  pixels[offset] = Math.round(pixels[offset] * (1 - alpha) + colour[0] * alpha);
  pixels[offset + 1] = Math.round(
    pixels[offset + 1] * (1 - alpha) + colour[1] * alpha,
  );
  pixels[offset + 2] = Math.round(
    pixels[offset + 2] * (1 - alpha) + colour[2] * alpha,
  );
  pixels[offset + 3] = 255;
}

function encodePng(pixels: Uint8Array): Buffer {
  const scanlines = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const sourceStart = y * WIDTH * 4;
    const targetStart = y * (WIDTH * 4 + 1);
    scanlines[targetStart] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + sourceStart, WIDTH * 4).copy(
      scanlines,
      targetStart + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
