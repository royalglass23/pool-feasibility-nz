import "server-only";
import { deflateSync } from "node:zlib";
import type { FeatureCollection, Geometry } from "geojson";
import sharp from "sharp";
import { reportMapLayerStyle } from "@/modules/reporting/report-map-style";

const WIDTH = 900;
const HEIGHT = 600;
const RENDER_SCALE = 2;
const RENDER_WIDTH = WIDTH * RENDER_SCALE;
const RENDER_HEIGHT = HEIGHT * RENDER_SCALE;
const PADDING = 56;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type Point = [number, number];
type Colour = readonly [number, number, number, number];
type TrustedMapLayer = {
  key: string;
  evidenceUse: string;
  geometry: FeatureCollection<Geometry> | null;
};
export type TrustedAssessmentMapInput = {
  boundary: Geometry | null;
  shell: Geometry;
  constructionEnvelope: Geometry;
  warning: "no_warning" | "needs_checking" | "blocked";
  layers?: TrustedMapLayer[];
};

export type TrustedAssessmentMapViewport = {
  zoom: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function trustedAssessmentMapViewport(
  input: Pick<
    TrustedAssessmentMapInput,
    "boundary" | "shell" | "constructionEnvelope"
  >,
): TrustedAssessmentMapViewport {
  const sourcePoints = [input.boundary, input.shell, input.constructionEnvelope]
    .filter((geometry): geometry is Geometry => geometry !== null)
    .flatMap(coordinates);
  if (sourcePoints.length === 0)
    throw new Error("TRUSTED_MAP_GEOMETRY_MISSING");
  return mapViewport(sourcePoints);
}

export async function renderTrustedAssessmentMap(
  input: TrustedAssessmentMapInput,
  options?: {
    aerialPixels?: Uint8Array | null;
    viewport?: TrustedAssessmentMapViewport;
  },
): Promise<string> {
  const viewport = options?.viewport ?? trustedAssessmentMapViewport(input);
  const project = (coordinate: Point): Point => {
    const [x, y] = worldPixel(coordinate, viewport.zoom);
    return [
      Math.round((x - viewport.left) * RENDER_SCALE),
      Math.round((y - viewport.top) * RENDER_SCALE),
    ];
  };
  const aerialPixels = options?.aerialPixels ?? null;
  if (aerialPixels && aerialPixels.length !== WIDTH * HEIGHT * 4) {
    throw new Error("TRUSTED_MAP_AERIAL_INVALID");
  }
  const pixels = aerialPixels
    ? new Uint8Array(
        await sharp(aerialPixels, {
          raw: { width: WIDTH, height: HEIGHT, channels: 4 },
        })
          .resize(RENDER_WIDTH, RENDER_HEIGHT, { kernel: "cubic" })
          .raw()
          .toBuffer(),
      )
    : new Uint8Array(RENDER_WIDTH * RENDER_HEIGHT * 4);
  if (!aerialPixels) {
    fillCanvas(pixels, [248, 250, 252, 255]);
    drawGrid(pixels);
  }
  if (input.boundary) {
    const boundaryRings = rings(input.boundary).map((ring) =>
      ring.map(project),
    );
    fillGeometry(
      pixels,
      boundaryRings,
      aerialPixels ? [204, 251, 241, 40] : [204, 251, 241, 180],
    );
    strokeGeometry(
      pixels,
      boundaryRings,
      [15, 118, 110, 255],
      3 * RENDER_SCALE,
    );
  }
  for (const layer of input.layers ?? []) {
    if (
      layer.evidenceUse !== "report_allowed" ||
      !layer.geometry ||
      layer.geometry.features.length === 0
    ) {
      continue;
    }
    drawReportLayer(pixels, layer, project);
  }
  strokeGeometry(
    pixels,
    rings(input.constructionEnvelope).map((ring) => ring.map(project)),
    [249, 115, 22, 255],
    3 * RENDER_SCALE,
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
  strokeGeometry(pixels, shellRings, [15, 23, 42, 255], 3 * RENDER_SCALE);
  const downsampledPixels = new Uint8Array(
    await sharp(pixels, {
      raw: { width: RENDER_WIDTH, height: RENDER_HEIGHT, channels: 4 },
    })
      .resize(WIDTH, HEIGHT, { kernel: "lanczos3" })
      .raw()
      .toBuffer(),
  );
  const png = encodePng(downsampledPixels);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function mapViewport(sourcePoints: Point[]) {
  let zoom = 21;
  for (; zoom > 0; zoom -= 1) {
    const projected = sourcePoints.map((coordinate) =>
      worldPixel(coordinate, zoom),
    );
    const width =
      Math.max(...projected.map(([x]) => x)) -
      Math.min(...projected.map(([x]) => x));
    const height =
      Math.max(...projected.map(([, y]) => y)) -
      Math.min(...projected.map(([, y]) => y));
    if (width <= WIDTH - PADDING * 2 && height <= HEIGHT - PADDING * 2) break;
  }
  const projected = sourcePoints.map((coordinate) =>
    worldPixel(coordinate, zoom),
  );
  const minX = Math.min(...projected.map(([x]) => x));
  const maxX = Math.max(...projected.map(([x]) => x));
  const minY = Math.min(...projected.map(([, y]) => y));
  const maxY = Math.max(...projected.map(([, y]) => y));
  return {
    zoom,
    left: Math.floor((minX + maxX) / 2 - WIDTH / 2),
    top: Math.floor((minY + maxY) / 2 - HEIGHT / 2),
    width: WIDTH,
    height: HEIGHT,
  };
}

function worldPixel([longitude, latitude]: Point, zoom: number): Point {
  const worldSize = 256 * 2 ** zoom;
  const boundedLatitude = Math.max(
    -85.05112878,
    Math.min(85.05112878, latitude),
  );
  const sin = Math.sin((boundedLatitude * Math.PI) / 180);
  return [
    ((longitude + 180) / 360) * worldSize,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  ];
}

function drawReportLayer(
  pixels: Uint8Array,
  layer: TrustedMapLayer,
  project: (point: Point) => Point,
) {
  const style = reportMapLayerStyle(layer.key);
  const colour = style.rgba;
  for (const feature of layer.geometry?.features ?? []) {
    const geometry = feature.geometry;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const projected = rings(geometry).map((ring) => ring.map(project));
      fillGeometry(pixels, projected, [colour[0], colour[1], colour[2], 60]);
      strokeGeometry(pixels, projected, colour, 2 * RENDER_SCALE);
      continue;
    }
    for (const line of geometryLines(geometry)) {
      const projected = line.map(project);
      for (let index = 0; index + 1 < projected.length; index += 1) {
        drawLine(
          pixels,
          projected[index],
          projected[index + 1],
          colour,
          3 * RENDER_SCALE,
          style.dashed,
        );
      }
    }
    for (const coordinate of geometryPoints(geometry)) {
      drawCircle(pixels, project(coordinate), colour, 5 * RENDER_SCALE);
    }
  }
}

function geometryLines(geometry: Geometry): Point[][] {
  if (geometry.type === "LineString") return [geometry.coordinates as Point[]];
  if (geometry.type === "MultiLineString")
    return geometry.coordinates as Point[][];
  return [];
}

function geometryPoints(geometry: Geometry): Point[] {
  if (geometry.type === "Point") return [geometry.coordinates as Point];
  if (geometry.type === "MultiPoint") return geometry.coordinates as Point[];
  return [];
}

function drawCircle(
  pixels: Uint8Array,
  [centreX, centreY]: Point,
  colour: Colour,
  radius: number,
) {
  for (let y = centreY - radius; y <= centreY + radius; y += 1) {
    for (let x = centreX - radius; x <= centreX + radius; x += 1) {
      if ((x - centreX) ** 2 + (y - centreY) ** 2 <= radius ** 2) {
        blendPixel(pixels, x, y, colour);
      }
    }
  }
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
  for (
    let x = PADDING * RENDER_SCALE;
    x <= RENDER_WIDTH - PADDING * RENDER_SCALE;
    x += 80 * RENDER_SCALE
  ) {
    drawLine(
      pixels,
      [x, PADDING * RENDER_SCALE],
      [x, RENDER_HEIGHT - PADDING * RENDER_SCALE],
      [226, 232, 240, 255],
      RENDER_SCALE,
    );
  }
  for (
    let y = PADDING * RENDER_SCALE;
    y <= RENDER_HEIGHT - PADDING * RENDER_SCALE;
    y += 80 * RENDER_SCALE
  ) {
    drawLine(
      pixels,
      [PADDING * RENDER_SCALE, y],
      [RENDER_WIDTH - PADDING * RENDER_SCALE, y],
      [226, 232, 240, 255],
      RENDER_SCALE,
    );
  }
}

function fillGeometry(
  pixels: Uint8Array,
  geometryRings: Point[][],
  colour: Colour,
) {
  for (let y = 0; y < RENDER_HEIGHT; y += 1) {
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
    if (!dashed || Math.floor(step / (10 * RENDER_SCALE)) % 2 === 0) {
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
  if (x < 0 || x >= RENDER_WIDTH || y < 0 || y >= RENDER_HEIGHT) return;
  const offset = (y * RENDER_WIDTH + x) * 4;
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
