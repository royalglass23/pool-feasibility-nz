import type * as MapLibre from "maplibre-gl";

const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

export function configureMapLibreWorker(maplibregl: typeof MapLibre): void {
  maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
}
