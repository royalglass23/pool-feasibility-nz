import { bboxClip } from "@turf/turf";
import type {
  FeatureCollection,
  Feature,
  LineString,
  MultiLineString,
} from "geojson";
import { z } from "zod";

// These bound the whole operation, not just each individual HTTP response.
const MAX_FEATURES = 2_000;
const BATCH_SIZE = 64;
const MAX_REQUESTS = 64;
const MAX_TRANSFER_BYTES = 16_000_000;
const MAX_PAGE_BYTES = 2_000_000;
const MAX_OUTPUT_BYTES = 500_000;
const MAX_OUTPUT_VERTICES = 20_000;

const idsSchema = z.object({
  objectIdFieldName: z
    .string()
    .refine((value) => value.toUpperCase() === "OBJECTID"),
  objectIds: z
    .array(z.number().int().nonnegative())
    .max(MAX_FEATURES)
    .nullable(),
  exceededTransferLimit: z.boolean().optional(),
});
const position = z
  .union([
    z.tuple([z.number().min(160).max(180), z.number().min(-48).max(-33)]),
    z.tuple([
      z.number().min(160).max(180),
      z.number().min(-48).max(-33),
      z.number(),
    ]),
    z.tuple([
      z.number().min(160).max(180),
      z.number().min(-48).max(-33),
      z.number(),
      z.number(),
    ]),
  ])
  .transform(([x, y]) => [x, y]);
// Full provider lines can be much longer than the small clipped map segment.
// Their download is byte-bounded before this parser runs.
const coordinates = z.array(position).min(2).max(50_000);
const pageSchema = z.object({
  type: z.literal("FeatureCollection"),
  exceededTransferLimit: z.boolean().optional(),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        id: z.union([z.string(), z.number()]).optional(),
        geometry: z.discriminatedUnion("type", [
          z.object({ type: z.literal("LineString"), coordinates }),
          z.object({
            type: z.literal("MultiLineString"),
            coordinates: z.array(coordinates).min(1).max(2_000),
          }),
        ]),
        properties: z.record(z.string(), z.unknown()),
      }),
    )
    .max(BATCH_SIZE),
});

type ContourFeature = Feature<LineString | MultiLineString>;
type ReadJson = (
  url: URL,
  limits: {
    maxBytes: number;
    timeoutMs: number;
    signal: AbortSignal;
    retryCount: number;
  },
) => Promise<{ data: unknown; bytes: number }>;

export async function readBoundedContours(input: {
  url: URL;
  envelope: [number, number, number, number];
  timeoutMs: number;
  maxResponseBytes: number;
  readJson: ReadJson;
}): Promise<FeatureCollection<LineString | MultiLineString>> {
  const controller = new AbortController();
  const deadline = performance.now() + input.timeoutMs;
  let timeoutReject: () => void = () => {};
  const timedOut = new Promise<never>((_, reject) => {
    timeoutReject = () => {
      controller.abort();
      reject(new Error("PROVIDER_TIMEOUT"));
    };
  });
  const timer = setTimeout(timeoutReject, input.timeoutMs);
  let remainingBytes = MAX_TRANSFER_BYTES;
  let requests = 0;

  async function read(url: URL, maximumBytes: number): Promise<unknown> {
    if (controller.signal.aborted || performance.now() >= deadline)
      throw new Error("PROVIDER_TIMEOUT");
    if (++requests > MAX_REQUESTS || remainingBytes <= 0) throw budgetError();
    const reserved = Math.min(maximumBytes, remainingBytes);
    remainingBytes -= reserved;
    try {
      const result = await input.readJson(url, {
        maxBytes: reserved,
        timeoutMs: Math.max(1, Math.ceil(deadline - performance.now())),
        signal: controller.signal,
        // Retries/splits are owned here so the whole-operation limits hold.
        retryCount: 0,
      });
      remainingBytes += reserved - result.bytes;
      return result.data;
    } catch (error) {
      // Charge failed/aborted reads as a full allocation, including when
      // the headers rejected the body before reading it.
      if (reserved < maximumBytes) throw budgetError();
      throw error;
    }
  }

  async function run(): Promise<
    FeatureCollection<LineString | MultiLineString>
  > {
    const idsUrl = new URL(input.url);
    idsUrl.searchParams.set("returnIdsOnly", "true");
    idsUrl.searchParams.set("returnGeometry", "false");
    idsUrl.searchParams.set("f", "json");
    const manifest = parse(
      idsSchema,
      await read(idsUrl, Math.min(100_000, input.maxResponseBytes)),
    );
    if (manifest.exceededTransferLimit) throw incompleteError();
    const ids = manifest.objectIds ?? [];
    if (new Set(ids).size !== ids.length) throw incompleteError();
    ids.sort((a, b) => a - b);
    const seen = new Set<number>();
    const features: ContourFeature[] = [];
    let outputBytes = Buffer.byteLength(
      '{"type":"FeatureCollection","features":[]}',
    );
    let outputVertices = 0;

    async function batch(batchIds: number[]): Promise<void> {
      const url = new URL(input.url);
      url.searchParams.set("objectIds", batchIds.join(","));
      let page: z.infer<typeof pageSchema>;
      try {
        page = parse(
          pageSchema,
          await read(url, Math.min(MAX_PAGE_BYTES, input.maxResponseBytes)),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "PROVIDER_RESPONSE_TOO_LARGE" &&
          batchIds.length > 1
        ) {
          await split(batchIds);
          return;
        }
        throw error;
      }
      if (page.exceededTransferLimit) {
        if (batchIds.length === 1) throw incompleteError();
        await split(batchIds);
        return;
      }
      const expected = new Set(batchIds);
      const pageIds = page.features.map((feature) => {
        const id = featureId(feature.id ?? feature.properties.OBJECTID);
        if (
          feature.properties.OBJECTID !== undefined &&
          featureId(feature.properties.OBJECTID) !== id
        )
          throw incompleteError();
        return id;
      });
      if (
        pageIds.length !== expected.size ||
        new Set(pageIds).size !== expected.size ||
        pageIds.some((id) => !expected.has(id))
      )
        throw incompleteError();
      for (let index = 0; index < page.features.length; index++) {
        const feature = page.features[index];
        const id = pageIds[index];
        if (seen.has(id)) throw incompleteError();
        seen.add(id);
        const geometry = bboxClip(feature.geometry, input.envelope).geometry;
        if (
          geometry.type !== "LineString" &&
          geometry.type !== "MultiLineString"
        )
          throw incompleteError();
        if (!geometry.coordinates.length) continue;
        outputVertices +=
          geometry.type === "LineString"
            ? geometry.coordinates.length
            : geometry.coordinates.reduce((sum, part) => sum + part.length, 0);
        const clipped: ContourFeature = {
          type: "Feature",
          id: String(id),
          geometry,
          properties: feature.properties,
        };
        outputBytes +=
          Buffer.byteLength(JSON.stringify(clipped)) +
          (features.length ? 1 : 0);
        if (
          outputBytes > MAX_OUTPUT_BYTES ||
          outputVertices > MAX_OUTPUT_VERTICES
        )
          throw budgetError();
        features.push(clipped);
      }
    }

    async function split(batchIds: number[]): Promise<void> {
      const midpoint = Math.ceil(batchIds.length / 2);
      // Sequential recursion keeps splitting inside the same two-worker bound.
      await batch(batchIds.slice(0, midpoint));
      await batch(batchIds.slice(midpoint));
    }

    let next = 0;
    async function worker() {
      while (next < ids.length) {
        if (controller.signal.aborted) throw new Error("PROVIDER_TIMEOUT");
        const start = next;
        next += BATCH_SIZE;
        await batch(ids.slice(start, start + BATCH_SIZE));
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(2, Math.ceil(ids.length / BATCH_SIZE)) },
        worker,
      ),
    );
    if (controller.signal.aborted || performance.now() >= deadline)
      throw new Error("PROVIDER_TIMEOUT");
    if (seen.size !== ids.length) throw incompleteError();
    features.sort((a, b) => Number(a.id) - Number(b.id));
    return { type: "FeatureCollection", features };
  }

  try {
    return await Promise.race([run(), timedOut]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw result.error.issues.some((issue) => issue.code === "too_big")
    ? new Error("PROVIDER_RESPONSE_TOO_LARGE")
    : incompleteError();
}
function budgetError(): Error {
  return new Error(
    "PROVIDER_RESPONSE_TOO_LARGE: contour operation budget exceeded",
  );
}
function incompleteError(): Error {
  return new Error("PROVIDER_RESPONSE_INVALID: incomplete contour response");
}
function featureId(value: unknown): number {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+$/.test(value))
  )
    throw incompleteError();
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 0) throw incompleteError();
  return id;
}
