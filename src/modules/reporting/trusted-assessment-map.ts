import "server-only";
import sharp from "sharp";
import type { Geometry } from "geojson";

const WIDTH = 900;
const HEIGHT = 600;
const PADDING = 56;

export async function renderTrustedAssessmentMap(input: {
  address: string;
  boundary: Geometry | null;
  shell: Geometry;
  constructionEnvelope: Geometry;
  warning: "no_warning" | "needs_checking" | "blocked";
}): Promise<string> {
  const geometries = [input.boundary, input.shell, input.constructionEnvelope]
    .filter((geometry): geometry is Geometry => geometry !== null)
    .flatMap(coordinates);
  if (geometries.length === 0) throw new Error("TRUSTED_MAP_GEOMETRY_MISSING");
  const xs = geometries.map(([x]) => x);
  const ys = geometries.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / Math.max(maxX - minX, 0.00001),
    (HEIGHT - PADDING * 2) / Math.max(maxY - minY, 0.00001),
  );
  const point = ([x, y]: [number, number]) =>
    `${PADDING + (x - minX) * scale},${HEIGHT - PADDING - (y - minY) * scale}`;
  const path = (geometry: Geometry | null) =>
    geometry ? coordinates(geometry).map(point).join(" ") : "";
  const colour = input.warning === "blocked" ? "#dc2626" : input.warning === "needs_checking" ? "#d97706" : "#16a34a";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="#f8fafc"/><text x="${PADDING}" y="30" font-family="Arial" font-size="18" fill="#0f172a">${escapeXml(input.address)}</text>${input.boundary ? `<polyline points="${path(input.boundary)}" fill="#ccfbf1" stroke="#0f766e" stroke-width="3"/>` : ""}<polyline points="${path(input.constructionEnvelope)}" fill="none" stroke="#f97316" stroke-width="4" stroke-dasharray="10 7"/><polyline points="${path(input.shell)}" fill="${colour}" fill-opacity="0.55" stroke="#0f172a" stroke-width="3"/><text x="${PADDING}" y="${HEIGHT - 18}" font-family="Arial" font-size="14" fill="#334155">Server-generated preliminary assessment map</text></svg>`;
  const png = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function coordinates(geometry: Geometry): [number, number][] {
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return [];
  return geometry.coordinates.flat(geometry.type === "Polygon" ? 1 : 2) as [number, number][];
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);
}
