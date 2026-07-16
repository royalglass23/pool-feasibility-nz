import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { bbox } from "@turf/turf";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type * as MapLibre from "maplibre-gl";
import { assessAddressParcelAlignment } from "../src/modules/data-access-spike/aerial-alignment";
import { OfficialGisGateway } from "../src/modules/data-access-spike/official-gis-gateway";
import { runDataAccessSpike } from "../src/modules/data-access-spike/run-data-access-spike";
import { resolveAerialVerificationPath } from "../src/modules/data-access-spike/verification-artifact";

async function main(): Promise<void> {
  const verificationAddress = process.argv.slice(2).join(" ").trim();
  if (!verificationAddress) {
    throw new Error("ADDRESS_REQUIRED");
  }
  const basemapApiKey = process.env.LINZ_BASEMAPS_API_KEY;
  if (!basemapApiKey) {
    throw new Error("LINZ_BASEMAPS_API_KEY_REQUIRED");
  }

  const result = await runDataAccessSpike({
    requestedAddress: verificationAddress,
    gateway: new OfficialGisGateway({
      timeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS ?? 10_000),
    }),
    basemapApiKey,
  });
  const alignment = assessAddressParcelAlignment(result);
  const screenshotPath = resolveAerialVerificationPath(
    result.resolvedAddress.addressId,
  );

  if (!alignment.selectedAddressInsideParcel) {
    throw new Error("SELECTED_ADDRESS_OUTSIDE_PARCEL");
  }
  if (!alignment.selectedParcelSeparatedFromAlternatives) {
    throw new Error("ALTERNATIVE_ADDRESS_INSIDE_SELECTED_PARCEL");
  }
  if (result.datasets.aerial_imagery.status !== "success") {
    throw new Error("AERIAL_IMAGERY_UNAVAILABLE");
  }

  const parcelFeature: Feature<Polygon> = {
    type: "Feature",
    properties: {
      parcelId: result.parcel.parcelId,
      appellation: result.parcel.appellation,
    },
    geometry: result.parcel.geometry,
  };
  const selectedAddressFeature: Feature<Point> = {
    type: "Feature",
    properties: {
      addressId: result.resolvedAddress.addressId,
      address: result.resolvedAddress.fullAddress,
    },
    geometry: {
      type: "Point",
      coordinates: result.resolvedAddress.coordinates,
    },
  };
  const alternativeAddressFeatures: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: result.addressAlternatives.map((address) => ({
      type: "Feature",
      properties: {
        addressId: address.addressId,
        address: address.fullAddress,
      },
      geometry: { type: "Point", coordinates: address.coordinates },
    })),
  };
  const parcelBounds = bbox(parcelFeature) as [number, number, number, number];

  await mkdir(dirname(screenshotPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
    });
    await page.setContent(mapVerificationDocument(result));
    await page.addStyleTag({
      path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.css"),
    });
    await page.addScriptTag({
      path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.js"),
    });
    const renderResult = await page.evaluate(
      async ({ apiKey, parcel, selectedAddress, alternatives, bounds }) => {
        const maplibregl = (
          window as typeof window & { maplibregl: typeof MapLibre }
        ).maplibregl;
        if (!maplibregl) {
          throw new Error("MAPLIBRE_NOT_LOADED");
        }

        const map = new maplibregl.Map({
          container: "map",
          style: {
            version: 8,
            sources: {
              aerial: {
                type: "raster",
                tiles: [
                  `https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/{z}/{x}/{y}.webp?api=${apiKey}`,
                ],
                tileSize: 256,
                attribution:
                  '© <a href="https://www.linz.govt.nz/linz-copyright">LINZ CC BY 4.0</a> © <a href="https://www.linz.govt.nz/products-services/data/linz-basemaps/data-attribution">Imagery Basemap contributors</a>',
              },
            },
            layers: [{ id: "aerial", type: "raster", source: "aerial" }],
          },
          center: selectedAddress.geometry.coordinates as [number, number],
          zoom: 19,
          maxZoom: 21,
          attributionControl: false,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        map.addControl(
          new maplibregl.AttributionControl({ compact: false }),
          "bottom-right",
        );
        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: true,
            showZoom: false,
          }),
          "top-right",
        );
        map.addControl(
          new maplibregl.ScaleControl({ maxWidth: 140, unit: "metric" }),
          "bottom-left",
        );

        await new Promise<void>((resolveRender, rejectRender) => {
          const timeout = window.setTimeout(
            () => rejectRender(new Error("MAP_RENDER_TIMEOUT")),
            30_000,
          );
          map.once("load", () => {
            map.addSource("selected-parcel", { type: "geojson", data: parcel });
            map.addLayer({
              id: "selected-parcel-fill",
              type: "fill",
              source: "selected-parcel",
              paint: { "fill-color": "#00d4ff", "fill-opacity": 0.18 },
            });
            map.addLayer({
              id: "selected-parcel-line",
              type: "line",
              source: "selected-parcel",
              paint: { "line-color": "#00e5ff", "line-width": 5 },
            });
            map.addSource("selected-address", {
              type: "geojson",
              data: selectedAddress,
            });
            map.addLayer({
              id: "selected-address-point",
              type: "circle",
              source: "selected-address",
              paint: {
                "circle-color": "#00e5ff",
                "circle-radius": 8,
                "circle-stroke-color": "#062033",
                "circle-stroke-width": 3,
              },
            });
            map.addSource("alternative-addresses", {
              type: "geojson",
              data: alternatives,
            });
            map.addLayer({
              id: "alternative-address-points",
              type: "circle",
              source: "alternative-addresses",
              paint: {
                "circle-color": "#ff4d4f",
                "circle-radius": 7,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            });
            map.fitBounds(
              [
                [bounds[0], bounds[1]],
                [bounds[2], bounds[3]],
              ],
              { padding: 150, maxZoom: 20, duration: 0 },
            );
            map.once("idle", () => {
              window.clearTimeout(timeout);
              resolveRender();
            });
          });
        });

        return {
          tilesLoaded: map.areTilesLoaded(),
          zoom: Number(map.getZoom().toFixed(2)),
          center: [
            Number(map.getCenter().lng.toFixed(7)),
            Number(map.getCenter().lat.toFixed(7)),
          ],
        };
      },
      {
        apiKey: basemapApiKey,
        parcel: parcelFeature,
        selectedAddress: selectedAddressFeature,
        alternatives: alternativeAddressFeatures,
        bounds: parcelBounds,
      },
    );

    if (!renderResult.tilesLoaded) {
      throw new Error("AERIAL_TILES_NOT_LOADED");
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "verified",
          address: result.resolvedAddress.fullAddress,
          addressId: result.resolvedAddress.addressId,
          parcelId: result.parcel.parcelId,
          appellation: result.parcel.appellation,
          alignment,
          aerialTilesLoaded: renderResult.tilesLoaded,
          mapZoom: renderResult.zoom,
          mapCenter: renderResult.center,
          screenshotPath,
          attributionVisible: true,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await browser.close();
  }
}

function mapVerificationDocument(
  result: Awaited<ReturnType<typeof runDataAccessSpike>>,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Aerial parcel alignment verification</title>
    <style>
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; font-family: Arial, sans-serif; background: #07131d; color: #eef8ff; }
      body { display: grid; grid-template-rows: auto 1fr; }
      header { display: flex; justify-content: space-between; gap: 24px; padding: 18px 24px; background: #07131d; border-bottom: 1px solid #24465c; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      p { margin: 0; color: #b9d3e3; }
      .meta { text-align: right; font-size: 14px; line-height: 1.5; }
      .map-shell { position: relative; min-height: 0; }
      #map { position: absolute; inset: 0; }
      .legend { position: absolute; z-index: 2; top: 20px; left: 20px; width: 300px; padding: 16px; border-radius: 10px; background: rgba(7, 19, 29, .9); box-shadow: 0 8px 28px rgba(0,0,0,.35); }
      .legend h2 { margin: 0 0 12px; font-size: 16px; }
      .legend-row { display: flex; align-items: center; gap: 10px; margin-top: 9px; font-size: 14px; }
      .line { width: 28px; border-top: 4px solid #00e5ff; }
      .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #062033; background: #00e5ff; }
      .dot.alt { background: #ff4d4f; border-color: #fff; }
      .notice { margin-top: 14px; padding-top: 12px; border-top: 1px solid #315369; color: #b9d3e3; font-size: 12px; line-height: 1.45; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>Real aerial and legal-parcel alignment verification</h1>
        <p>${escapeHtml(result.resolvedAddress.fullAddress)}</p>
      </div>
      <div class="meta">
        LINZ address ${escapeHtml(result.resolvedAddress.addressId)}<br />
        Parcel ${escapeHtml(result.parcel.parcelId)} · ${escapeHtml(result.parcel.appellation)}<br />
        Title ${escapeHtml(result.parcel.titles.join(", "))}
      </div>
    </header>
    <div class="map-shell">
      <div id="map" aria-label="LINZ aerial map with parcel and address points"></div>
      <aside class="legend">
        <h2>Verification overlay</h2>
        <div class="legend-row"><span class="line"></span> Selected legal parcel</div>
        <div class="legend-row"><span class="dot"></span> Selected address: ${escapeHtml(result.resolvedAddress.fullAddressNumber)}</div>
        <div class="legend-row"><span class="dot alt"></span> Comparison address${result.addressAlternatives.length === 1 ? "" : "es"}: ${escapeHtml(result.addressAlternatives.map((address) => address.fullAddressNumber).join(", ") || "none")}</div>
        <div class="notice">Verification artifact only. Parcel geometry and address points are from official LINZ datasets. Aerial imagery is served by LINZ Basemaps. No pool candidate or feasibility finding is shown.</div>
      </aside>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

main().catch((error: unknown) => {
  const code =
    error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "AERIAL_ALIGNMENT_VERIFICATION_FAILED";
  process.stderr.write(`${JSON.stringify({ error: code })}\n`);
  process.exitCode = 1;
});
