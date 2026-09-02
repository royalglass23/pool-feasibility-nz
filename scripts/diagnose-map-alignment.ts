import "dotenv/config";

import { chromium } from "@playwright/test";
import { bbox } from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  Polygon,
  Position,
} from "geojson";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import type * as MapLibre from "maplibre-gl";
import { createDataAccessGateway } from "../tests/fixtures/normalized-data-access";
import { buildTestPreliminaryReport } from "../tests/fixtures/preliminary-report";
import providerFixtures from "../tests/fixtures/providers/official-property-layers.json";
import {
  buildFastPoolGeometry,
  fastPoolConstructionEnvelopeDimensions,
  findFastPoolDefaultPosition,
} from "../src/modules/data-access-spike/fast-pool-placement";
import { runFastPropertyView } from "../src/modules/data-access-spike/fast-property-view";
import { captureLinzAerialBackground } from "../src/modules/providers/linz/capture-linz-aerial-background";
import { reportMapLayerStyle } from "../src/modules/reporting/report-map-style";
import { generatePreliminaryReportPdf } from "../src/modules/reporting/report-renderer";
import type { SavedPreliminaryReport } from "../src/modules/reporting/preliminary-report";
import {
  renderTrustedAssessmentMap,
  trustedAssessmentMapViewport,
} from "../src/modules/reporting/trusted-assessment-map";

const LIVE_WIDTH = 1166;
const LIVE_HEIGHT = 600;
const REPORT_WIDTH = 900;
const REPORT_HEIGHT = 600;
const MAX_SCALE_RATIO = 1.05;
const MAX_NORMALIZED_ANCHOR_DELTA = 0.03;
const OUTPUT_DIRECTORY = resolve("test-results", "map-alignment-diagnostic");

const DIAGNOSTIC_LAYER_KEYS = [
  "contours",
  "public_stormwater_assets",
  "manholes",
  "catchpits",
  "watercourses",
  "wastewater_assets",
  "wastewater_manholes",
  "wastewater_fittings",
  "public_water_assets",
  "water_fittings",
] as const;

const DIAGNOSTIC_LEGEND = [
  { key: "contours", status: "fixture geometry · spike only" },
  {
    key: "public_stormwater_assets",
    status: "fixture geometry · report allowed",
  },
  {
    key: "wastewater_assets",
    status: "fixture geometry · internal reference",
  },
  {
    key: "public_water_assets",
    status: "fixture geometry · internal reference",
  },
  { key: "electricity_feeder_lines", status: "no fixture geometry" },
  { key: "gas_distribution_lines", status: "no fixture geometry" },
] as const;

function diagnosticReportLayers(): SavedPreliminaryReport["layers"] {
  return [
    {
      id: "contours",
      provider: "Auckland Council",
      dataset: "Contours 2016",
      evidenceUse: "spike_only",
      state: "returned",
      confidence: "limited",
      attribution: "Auckland Council",
      sourceUrl: null,
    },
    {
      id: "public_stormwater_assets",
      provider: "Auckland Council",
      dataset: "Stormwater Pipe",
      evidenceUse: "report_allowed",
      state: "returned",
      confidence: "limited",
      attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
      sourceUrl:
        "https://www.arcgis.com/home/item.html?id=cdea334c7ba9498c89b70977569007d7",
    },
    {
      id: "wastewater_assets",
      provider: "Watercare",
      dataset: "Wastewater Pipes",
      evidenceUse: "internal_reference",
      state: "internal_reference_only",
      confidence: "limited",
      attribution: "Watercare",
      sourceUrl: null,
    },
    {
      id: "public_water_assets",
      provider: "Watercare",
      dataset: "Water Pipes",
      evidenceUse: "internal_reference",
      state: "internal_reference_only",
      confidence: "limited",
      attribution: "Watercare",
      sourceUrl: null,
    },
    {
      id: "electricity_feeder_lines",
      provider: "Vector",
      dataset: "Electricity Distribution Feeder Network",
      evidenceUse: "spike_only",
      state: "empty",
      confidence: "limited",
      attribution: "Vector",
      sourceUrl: null,
    },
    {
      id: "gas_distribution_lines",
      provider: "Vector",
      dataset: "Gas Distribution Network",
      evidenceUse: "spike_only",
      state: "unavailable",
      confidence: "unavailable",
      attribution: "Vector",
      sourceUrl: null,
    },
  ];
}

type Point = [number, number];
type Pixel = { x: number; y: number };
type Anchor = { id: string; coordinate: Point };
type CameraCapture = {
  width: number;
  height: number;
  zoom: number;
  center: Point;
  bounds: [number, number, number, number];
  derivedWorldSize: number;
  anchors: Record<string, Pixel>;
};

async function main(): Promise<void> {
  const gateway = createDataAccessGateway();
  const result = await runFastPropertyView({
    requestedAddress: "42A Bahari Drive, Ranui, Auckland",
    selectedAddressId: "2359811",
    addressSearch: {
      search: (query) => gateway.searchAddresses(query),
      getById: (addressId) => gateway.getAddressById(addressId),
      status: async () => ({ indexedAt: null, isFresh: false }),
    },
    propertyLayers: gateway,
    basemapApiKey: "diagnostic-fixture-key",
    now: () => new Date("2026-08-12T00:00:00.000Z"),
  });
  const boundary = result.boundary.geometry;
  if (!boundary) throw new Error("DIAGNOSTIC_BOUNDARY_MISSING");

  const dimensions = result.defaultPool;
  const envelopeDimensions = fastPoolConstructionEnvelopeDimensions(dimensions);
  const position = findFastPoolDefaultPosition(boundary, envelopeDimensions, 0);
  if (!position) throw new Error("DIAGNOSTIC_POOL_POSITION_MISSING");

  const shell = buildFastPoolGeometry(
    position,
    dimensions.lengthMetres,
    dimensions.widthMetres,
    0,
  );
  const constructionEnvelope = buildFastPoolGeometry(
    position,
    envelopeDimensions.lengthMetres,
    envelopeDimensions.widthMetres,
    0,
  );
  const mapInput = {
    boundary,
    shell: shell.geometry,
    constructionEnvelope: constructionEnvelope.geometry,
    warning: "needs_checking" as const,
  };
  const fixtureLayers = providerFixtures as unknown as Record<
    string,
    FeatureCollection<Geometry>
  >;
  const diagnosticLayers = DIAGNOSTIC_LAYER_KEYS.map((key) => ({
    key,
    geometry: fixtureLayers[key] ?? null,
    evidenceUse:
      key === "public_stormwater_assets" ||
      key === "manholes" ||
      key === "catchpits" ||
      key === "watercourses"
        ? "report_allowed"
        : key === "contours"
          ? "spike_only"
          : "internal_reference",
  }));
  const diagnosticMapInput = { ...mapInput, layers: diagnosticLayers };
  const anchors = diagnosticAnchors(boundary, shell);
  const reportViewport = trustedAssessmentMapViewport(mapInput);

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const livePath = resolve(OUTPUT_DIRECTORY, "live-map.png");
  const reportPath = resolve(OUTPUT_DIRECTORY, "report-map.png");
  const comparisonPath = resolve(OUTPUT_DIRECTORY, "comparison.png");
  const h1ProbePath = resolve(OUTPUT_DIRECTORY, "h1-probe-report-map.png");
  const h1ComparisonPath = resolve(OUTPUT_DIRECTORY, "h1-probe-comparison.png");
  const h2LivePath = resolve(OUTPUT_DIRECTORY, "h2-matched-live-map.png");
  const h2ComparisonPath = resolve(
    OUTPUT_DIRECTORY,
    "h2-matched-viewport-comparison.png",
  );
  const h3LiveAerialPath = resolve(OUTPUT_DIRECTORY, "h3-live-aerial.png");
  const h3LiveVectorPath = resolve(
    OUTPUT_DIRECTORY,
    "h3-live-aerial-vectors.png",
  );
  const h3ReportAerialPath = resolve(OUTPUT_DIRECTORY, "h3-report-aerial.png");
  const h3ReportVectorPath = resolve(
    OUTPUT_DIRECTORY,
    "h3-report-aerial-vectors.png",
  );
  const h3AerialComparisonPath = resolve(
    OUTPUT_DIRECTORY,
    "h3-aerial-comparison.png",
  );
  const h3VectorComparisonPath = resolve(
    OUTPUT_DIRECTORY,
    "h3-aerial-vector-comparison.png",
  );
  const h4ReportAerialPath = resolve(
    OUTPUT_DIRECTORY,
    "h4-report-aerial-materialized.png",
  );
  const h4ReportVectorPath = resolve(
    OUTPUT_DIRECTORY,
    "h4-report-aerial-vectors-materialized.png",
  );
  const h4AerialComparisonPath = resolve(
    OUTPUT_DIRECTORY,
    "h4-aerial-comparison.png",
  );
  const h4VectorComparisonPath = resolve(
    OUTPUT_DIRECTORY,
    "h4-aerial-vector-comparison-with-legend.png",
  );
  const h4ReportPreviewPdfPath = resolve(
    "output",
    "pdf",
    "map-alignment-report-preview.pdf",
  );
  const metricsPath = resolve(OUTPUT_DIRECTORY, "metrics.json");
  const h2ProbeRequested = process.argv.includes("--probe-h2");
  const h4ProbeRequested = process.argv.includes("--probe-h4");
  const h3ProbeRequested =
    process.argv.includes("--probe-h3") || h4ProbeRequested;
  const h3Viewport = reportViewport;
  const linzApiKey = h3ProbeRequested
    ? process.env.LINZ_BASEMAPS_API_KEY
    : undefined;
  if (h3ProbeRequested && !linzApiKey) {
    throw new Error("LINZ_BASEMAPS_API_KEY_REQUIRED");
  }

  const browser = await chromium.launch({ headless: true });
  let live: CameraCapture;
  let h2Live: CameraCapture | null = null;
  try {
    const page = await browser.newPage({
      viewport: { width: LIVE_WIDTH, height: LIVE_HEIGHT },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<div id="map" style="width:${LIVE_WIDTH}px;height:${LIVE_HEIGHT}px"></div>`,
    );
    await page.addStyleTag({
      path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.css"),
    });
    await page.addScriptTag({
      path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.js"),
    });
    live = await captureLiveCamera(page, {
      boundary,
      shell,
      constructionEnvelope,
      bounds: bbox(boundary) as [number, number, number, number],
      anchors,
    });
    await page.locator("#map").screenshot({ path: livePath });
    if (h2ProbeRequested) {
      const matchedPage = await browser.newPage({
        viewport: { width: REPORT_WIDTH, height: REPORT_HEIGHT },
        deviceScaleFactor: 1,
      });
      await matchedPage.setContent(
        `<div id="map" style="width:${REPORT_WIDTH}px;height:${REPORT_HEIGHT}px"></div>`,
      );
      await matchedPage.addStyleTag({
        path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.css"),
      });
      await matchedPage.addScriptTag({
        path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.js"),
      });
      h2Live = await captureLiveCamera(matchedPage, {
        boundary,
        shell,
        constructionEnvelope,
        bounds: bbox(boundary) as [number, number, number, number],
        anchors,
      });
      await matchedPage.locator("#map").screenshot({ path: h2LivePath });
    }
    if (h3ProbeRequested && linzApiKey) {
      const aerialPage = await createMapPage(
        browser,
        REPORT_WIDTH,
        REPORT_HEIGHT,
      );
      await captureLiveAerialCamera(aerialPage, {
        apiKey: linzApiKey,
        viewport: h3Viewport,
        boundary,
        shell,
        constructionEnvelope,
        includeVectors: false,
      });
      await aerialPage.locator("#map").screenshot({ path: h3LiveAerialPath });

      const vectorPage = await createMapPage(
        browser,
        REPORT_WIDTH,
        REPORT_HEIGHT,
      );
      await captureLiveAerialCamera(vectorPage, {
        apiKey: linzApiKey,
        viewport: h3Viewport,
        boundary,
        shell,
        constructionEnvelope,
        includeVectors: true,
        diagnosticLayers: h4ProbeRequested
          ? diagnosticLayers.map((layer) => ({
              key: layer.key,
              geometry: layer.geometry,
              style: reportMapLayerStyle(layer.key),
            }))
          : [],
      });
      await vectorPage.locator("#map").screenshot({ path: h3LiveVectorPath });
    }
  } finally {
    await browser.close();
  }

  const reportDataUrl = await renderTrustedAssessmentMap(mapInput, {
    viewport: reportViewport,
  });
  await writeFile(reportPath, decodePngDataUrl(reportDataUrl));
  let h3Probe: {
    status: "registered" | "misregistered";
    tilesLoaded: true;
    bestShift: { x: number; y: number };
    viewportTileOffset: { x: number; y: number };
    matchesUnappliedTileCropOffset: boolean;
    zeroShiftMeanAbsoluteError: number;
    bestMeanAbsoluteError: number;
    searchRadiusPixels: number;
  } | null = null;
  if (h3ProbeRequested) {
    const aerialPixels = await captureLinzAerialBackground(h3Viewport);
    await sharp(Buffer.from(aerialPixels), {
      raw: { width: REPORT_WIDTH, height: REPORT_HEIGHT, channels: 4 },
    })
      .png()
      .toFile(h3ReportAerialPath);
    const reportWithAerial = await renderTrustedAssessmentMap(mapInput, {
      viewport: h3Viewport,
      aerialPixels,
    });
    await writeFile(h3ReportVectorPath, decodePngDataUrl(reportWithAerial));
    const registration = await measureRasterRegistration(
      h3LiveAerialPath,
      h3ReportAerialPath,
      256,
    );
    const registered =
      Math.abs(registration.bestShift.x) <= 1 &&
      Math.abs(registration.bestShift.y) <= 1 &&
      registration.bestMeanAbsoluteError <= 20;
    const viewportTileOffset = {
      x: h3Viewport.left % 256,
      y: h3Viewport.top % 256,
    };
    h3Probe = {
      status: registered ? "registered" : "misregistered",
      tilesLoaded: true,
      ...registration,
      viewportTileOffset,
      matchesUnappliedTileCropOffset:
        registration.bestShift.x === viewportTileOffset.x &&
        registration.bestShift.y === viewportTileOffset.y,
    };
    await writeMatchedViewportComparisonImage(
      h3LiveAerialPath,
      h3ReportAerialPath,
      h3AerialComparisonPath,
      "MapLibre actual LINZ aerial",
      "Report actual LINZ aerial",
    );
    await writeMatchedViewportComparisonImage(
      h3LiveVectorPath,
      h3ReportVectorPath,
      h3VectorComparisonPath,
      "MapLibre aerial + vectors",
      "Report aerial + vectors",
    );
  }
  let h4Probe: {
    status: "supported" | "not_supported";
    changedVariable: "materialize_composite_before_extract";
    baselineShift: { x: number; y: number };
    materializedShift: { x: number; y: number };
    materializedMeanAbsoluteError: number;
    tileCropOffset: { x: number; y: number };
  } | null = null;
  if (h4ProbeRequested && linzApiKey && h3Probe) {
    const materializedAerialPixels =
      await captureLinzAerialBackground(h3Viewport);
    await sharp(Buffer.from(materializedAerialPixels), {
      raw: { width: REPORT_WIDTH, height: REPORT_HEIGHT, channels: 4 },
    })
      .png()
      .toFile(h4ReportAerialPath);
    const materializedReportWithVectors = await renderTrustedAssessmentMap(
      diagnosticMapInput,
      {
        viewport: h3Viewport,
        aerialPixels: materializedAerialPixels,
      },
    );
    await writeFile(
      h4ReportVectorPath,
      decodePngDataUrl(materializedReportWithVectors),
    );
    const materializedRegistration = await measureRasterRegistration(
      h3LiveAerialPath,
      h4ReportAerialPath,
      16,
    );
    const materializedRegistered =
      Math.abs(materializedRegistration.bestShift.x) <= 1 &&
      Math.abs(materializedRegistration.bestShift.y) <= 1 &&
      materializedRegistration.bestMeanAbsoluteError <= 1;
    h4Probe = {
      status:
        h3Probe.status === "registered" && materializedRegistered
          ? "supported"
          : "not_supported",
      changedVariable: "materialize_composite_before_extract",
      baselineShift: h3Probe.bestShift,
      materializedShift: materializedRegistration.bestShift,
      materializedMeanAbsoluteError:
        materializedRegistration.bestMeanAbsoluteError,
      tileCropOffset: h3Probe.viewportTileOffset,
    };
    await writeMatchedViewportComparisonImage(
      h3LiveAerialPath,
      h4ReportAerialPath,
      h4AerialComparisonPath,
      "MapLibre actual LINZ aerial",
      "H4 materialized report aerial",
    );
    await writeH4VectorComparisonImage(
      h3LiveVectorPath,
      h4ReportVectorPath,
      h4VectorComparisonPath,
    );
    await mkdir(resolve("output", "pdf"), { recursive: true });
    const previewPdf = await generatePreliminaryReportPdf(
      buildTestPreliminaryReport({
        reference: "GF-MAP-ALIGNMENT-PREVIEW",
        generatedAt: "2026-08-12T00:00:00.000Z",
        property: {
          address: result.resolvedAddress.fullAddress,
          boundaryStatus: result.boundary.state,
          boundaryConfidence: "high",
          boundaryAreaSquareMetres: result.boundary.areaSquareMetres,
          parcelIdentifier: result.boundary.parcelId,
        },
        pool: {
          lengthMetres: dimensions.lengthMetres,
          widthMetres: dimensions.widthMetres,
          rotationDegrees: 0,
        },
        layers: diagnosticReportLayers(),
        sources: [
          {
            provider: "LINZ",
            dataset: "Aerial imagery",
            status: "available",
            evidenceUse: "report_allowed",
            licence: "Creative Commons Attribution 4.0 International",
            attribution: "Land Information New Zealand (LINZ), CC BY 4.0",
            sourceUrl:
              "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
            retrievedAt: "2026-08-12T00:00:00.000Z",
          },
          {
            provider: "Auckland Council",
            dataset: "Stormwater Pipe",
            status: "available",
            evidenceUse: "report_allowed",
            licence: "Creative Commons Attribution 4.0 International",
            attribution: "Healthy Waters, Auckland Council, CC BY 4.0",
            sourceUrl:
              "https://www.arcgis.com/home/item.html?id=cdea334c7ba9498c89b70977569007d7",
            retrievedAt: "2026-08-12T00:00:00.000Z",
          },
        ],
        mapImageDataUrl: materializedReportWithVectors,
      }),
    );
    await writeFile(h4ReportPreviewPdfPath, previewPdf);
  }

  const reportAnchors = Object.fromEntries(
    anchors.map((anchor) => [
      anchor.id,
      reportPixel(anchor.coordinate, reportViewport),
    ]),
  );
  const reportWorldSize = 256 * 2 ** reportViewport.zoom;
  const anchorDeltas = anchors.map((anchor) => {
    const livePixel = live.anchors[anchor.id];
    const reportPixelValue = reportAnchors[anchor.id];
    const normalization = Math.min(live.height, reportViewport.height);
    const dx =
      (livePixel.x -
        live.width / 2 -
        (reportPixelValue.x - reportViewport.width / 2)) /
      normalization;
    const dy =
      (livePixel.y -
        live.height / 2 -
        (reportPixelValue.y - reportViewport.height / 2)) /
      normalization;
    return {
      id: anchor.id,
      live: livePixel,
      report: reportPixelValue,
      normalizedDelta: Number(Math.hypot(dx, dy).toFixed(6)),
    };
  });
  const scaleRatio = Math.max(
    live.derivedWorldSize / reportWorldSize,
    reportWorldSize / live.derivedWorldSize,
  );
  const maxAnchorDelta = Math.max(
    ...anchorDeltas.map((anchor) => anchor.normalizedDelta),
  );
  const mismatch =
    scaleRatio > MAX_SCALE_RATIO ||
    maxAnchorDelta > MAX_NORMALIZED_ANCHOR_DELTA;
  const h1ProbeRequested =
    process.argv.includes("--probe-h1") || h2ProbeRequested || h3ProbeRequested;
  let h1Probe: {
    status: "supported" | "not_supported";
    viewport: ReturnType<typeof trustedAssessmentMapViewport>;
    worldSize: number;
    scaleRatio: number;
    maximumNormalizedAnchorDelta: number;
    anchorDeltaReduction: number;
    anchors: typeof anchorDeltas;
  } | null = null;
  let h2Probe: {
    fractionalFitBounds: {
      status: "supported" | "not_supported";
      equivalentReportZoom: number;
      zoomDifferenceFromH1: number;
      anchorDeltaReductionFromH1: number;
      comparison: ReturnType<typeof compareLiveToViewport>;
    };
    matchedViewport: {
      status: "supported" | "not_supported";
      liveWidth: number;
      liveHeight: number;
      anchorDeltaReductionFromH1: number;
      comparison: ReturnType<typeof compareLiveToViewport>;
    };
  } | null = null;
  if (h1ProbeRequested) {
    const scaleAlreadyMatched = scaleRatio <= MAX_SCALE_RATIO;
    const probeViewport = scaleAlreadyMatched
      ? reportViewport
      : h1ProjectionScaleViewport(reportViewport);
    const probeDataUrl = await renderTrustedAssessmentMap(mapInput, {
      viewport: probeViewport,
    });
    await writeFile(h1ProbePath, decodePngDataUrl(probeDataUrl));
    const probeAnchors = Object.fromEntries(
      anchors.map((anchor) => [
        anchor.id,
        reportPixel(anchor.coordinate, probeViewport),
      ]),
    );
    const probeAnchorDeltas = anchors.map((anchor) => {
      const livePixel = live.anchors[anchor.id];
      const reportPixelValue = probeAnchors[anchor.id];
      const normalization = Math.min(live.height, probeViewport.height);
      const dx =
        (livePixel.x -
          live.width / 2 -
          (reportPixelValue.x - probeViewport.width / 2)) /
        normalization;
      const dy =
        (livePixel.y -
          live.height / 2 -
          (reportPixelValue.y - probeViewport.height / 2)) /
        normalization;
      return {
        id: anchor.id,
        live: livePixel,
        report: reportPixelValue,
        normalizedDelta: Number(Math.hypot(dx, dy).toFixed(6)),
      };
    });
    const probeWorldSize = 256 * 2 ** probeViewport.zoom;
    const probeScaleRatio = Math.max(
      live.derivedWorldSize / probeWorldSize,
      probeWorldSize / live.derivedWorldSize,
    );
    const probeMaxAnchorDelta = Math.max(
      ...probeAnchorDeltas.map((anchor) => anchor.normalizedDelta),
    );
    const anchorDeltaReduction =
      (maxAnchorDelta - probeMaxAnchorDelta) / maxAnchorDelta;
    const supportsH1 =
      probeScaleRatio <= MAX_SCALE_RATIO &&
      (scaleAlreadyMatched || anchorDeltaReduction >= 0.5);
    h1Probe = {
      status: supportsH1 ? "supported" : "not_supported",
      viewport: probeViewport,
      worldSize: probeWorldSize,
      scaleRatio: Number(probeScaleRatio.toFixed(6)),
      maximumNormalizedAnchorDelta: probeMaxAnchorDelta,
      anchorDeltaReduction: Number(anchorDeltaReduction.toFixed(6)),
      anchors: probeAnchorDeltas,
    };
    await writeComparisonImage(
      livePath,
      h1ProbePath,
      h1ComparisonPath,
      `H1 scale probe (${REPORT_WIDTH} x ${REPORT_HEIGHT})`,
    );
    if (h2ProbeRequested) {
      if (!h2Live) throw new Error("H2_MATCHED_LIVE_CAPTURE_MISSING");
      const equivalentReportZoom = Math.log2(live.derivedWorldSize / 256);
      const fractionalViewport = projectionScaleViewport(
        reportViewport,
        equivalentReportZoom,
      );
      const fractionalComparison = compareLiveToViewport(
        live,
        fractionalViewport,
        anchors,
      );
      const fractionalDeltaReduction =
        (probeMaxAnchorDelta -
          fractionalComparison.maximumNormalizedAnchorDelta) /
        probeMaxAnchorDelta;
      const fractionalSupported = fractionalDeltaReduction >= 0.1;

      const matchedViewportComparison = compareLiveToViewport(
        h2Live,
        probeViewport,
        anchors,
      );
      const matchedViewportDeltaReduction =
        (probeMaxAnchorDelta -
          matchedViewportComparison.maximumNormalizedAnchorDelta) /
        probeMaxAnchorDelta;
      const matchedViewportSupported =
        matchedViewportComparison.maximumNormalizedAnchorDelta <=
        MAX_NORMALIZED_ANCHOR_DELTA;
      h2Probe = {
        fractionalFitBounds: {
          status: fractionalSupported ? "supported" : "not_supported",
          equivalentReportZoom: Number(equivalentReportZoom.toFixed(9)),
          zoomDifferenceFromH1: Number(
            Math.abs(equivalentReportZoom - probeViewport.zoom).toFixed(9),
          ),
          anchorDeltaReductionFromH1: Number(
            fractionalDeltaReduction.toFixed(6),
          ),
          comparison: fractionalComparison,
        },
        matchedViewport: {
          status: matchedViewportSupported ? "supported" : "not_supported",
          liveWidth: h2Live.width,
          liveHeight: h2Live.height,
          anchorDeltaReductionFromH1: Number(
            matchedViewportDeltaReduction.toFixed(6),
          ),
          comparison: matchedViewportComparison,
        },
      };
      await writeMatchedViewportComparisonImage(
        h2LivePath,
        h1ProbePath,
        h2ComparisonPath,
      );
    }
  }
  const metrics = {
    status: mismatch ? "mismatch" : "aligned",
    fixture: {
      address: result.resolvedAddress.fullAddress,
      addressId: result.resolvedAddress.addressId,
      parcelId: result.boundary.parcelId,
      poolPosition: position,
    },
    thresholds: {
      maximumScaleRatio: MAX_SCALE_RATIO,
      maximumNormalizedAnchorDelta: MAX_NORMALIZED_ANCHOR_DELTA,
    },
    live,
    report: {
      ...reportViewport,
      center: inverseWorldPixel(
        reportViewport.left + reportViewport.width / 2,
        reportViewport.top + reportViewport.height / 2,
        reportViewport.zoom,
      ),
      worldSize: reportWorldSize,
      bounds: reportViewportBounds(reportViewport),
      anchors: reportAnchors,
    },
    comparison: {
      scaleRatio: Number(scaleRatio.toFixed(6)),
      maximumNormalizedAnchorDelta: maxAnchorDelta,
      anchors: anchorDeltas,
    },
    h1Probe,
    h2Probe,
    h3Probe,
    h4Probe,
    artifacts: {
      livePath,
      reportPath,
      comparisonPath,
      metricsPath,
      ...(h1ProbeRequested ? { h1ProbePath, h1ComparisonPath } : {}),
      ...(h2ProbeRequested ? { h2LivePath, h2ComparisonPath } : {}),
      ...(h3ProbeRequested
        ? {
            h3LiveAerialPath,
            h3LiveVectorPath,
            h3ReportAerialPath,
            h3ReportVectorPath,
            h3AerialComparisonPath,
            h3VectorComparisonPath,
          }
        : {}),
      ...(h4ProbeRequested
        ? {
            h4ReportAerialPath,
            h4ReportVectorPath,
            h4AerialComparisonPath,
            h4VectorComparisonPath,
            h4ReportPreviewPdfPath,
          }
        : {}),
    },
  };

  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  await writeComparisonImage(livePath, reportPath, comparisonPath);
  process.stdout.write(
    `${JSON.stringify(
      {
        status: metrics.status,
        address: metrics.fixture.address,
        liveZoom: metrics.live.zoom,
        reportZoom: metrics.report.zoom,
        scaleRatio: metrics.comparison.scaleRatio,
        maximumNormalizedAnchorDelta:
          metrics.comparison.maximumNormalizedAnchorDelta,
        ...(metrics.h1Probe
          ? {
              h1Probe: {
                status: metrics.h1Probe.status,
                reportZoom: metrics.h1Probe.viewport.zoom,
                scaleRatio: metrics.h1Probe.scaleRatio,
                maximumNormalizedAnchorDelta:
                  metrics.h1Probe.maximumNormalizedAnchorDelta,
                anchorDeltaReduction: metrics.h1Probe.anchorDeltaReduction,
              },
            }
          : {}),
        ...(metrics.h2Probe
          ? {
              h2Probe: {
                fractionalFitBounds: {
                  status: metrics.h2Probe.fractionalFitBounds.status,
                  equivalentReportZoom:
                    metrics.h2Probe.fractionalFitBounds.equivalentReportZoom,
                  zoomDifferenceFromH1:
                    metrics.h2Probe.fractionalFitBounds.zoomDifferenceFromH1,
                  maximumNormalizedAnchorDelta:
                    metrics.h2Probe.fractionalFitBounds.comparison
                      .maximumNormalizedAnchorDelta,
                  anchorDeltaReductionFromH1:
                    metrics.h2Probe.fractionalFitBounds
                      .anchorDeltaReductionFromH1,
                },
                matchedViewport: {
                  status: metrics.h2Probe.matchedViewport.status,
                  liveSize: `${metrics.h2Probe.matchedViewport.liveWidth}x${metrics.h2Probe.matchedViewport.liveHeight}`,
                  maximumNormalizedAnchorDelta:
                    metrics.h2Probe.matchedViewport.comparison
                      .maximumNormalizedAnchorDelta,
                  anchorDeltaReductionFromH1:
                    metrics.h2Probe.matchedViewport.anchorDeltaReductionFromH1,
                },
              },
            }
          : {}),
        ...(metrics.h3Probe ? { h3Probe: metrics.h3Probe } : {}),
        ...(metrics.h4Probe ? { h4Probe: metrics.h4Probe } : {}),
        thresholds: metrics.thresholds,
        artifacts: metrics.artifacts,
      },
      null,
      2,
    )}\n`,
  );

  if (process.argv.includes("--assert") && mismatch) process.exitCode = 1;
  if (h1ProbeRequested && h1Probe?.status !== "supported") {
    process.exitCode = 1;
  }
  if (
    h2ProbeRequested &&
    (h2Probe?.fractionalFitBounds.status !== "not_supported" ||
      h2Probe.matchedViewport.status !== "supported")
  ) {
    process.exitCode = 1;
  }
  if (process.argv.includes("--probe-h3") && h3Probe?.status !== "registered") {
    process.exitCode = 1;
  }
  if (
    h4ProbeRequested &&
    (h3Probe?.status !== "registered" || h4Probe?.status !== "supported")
  ) {
    process.exitCode = 1;
  }
}

async function createMapPage(
  browser: import("@playwright/test").Browser,
  width: number,
  height: number,
): Promise<import("@playwright/test").Page> {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<div id="map" style="width:${width}px;height:${height}px"></div>`,
  );
  await page.addStyleTag({
    path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.css"),
  });
  await page.addScriptTag({
    path: resolve("node_modules", "maplibre-gl", "dist", "maplibre-gl.js"),
  });
  return page;
}

async function captureLiveAerialCamera(
  page: import("@playwright/test").Page,
  input: {
    apiKey: string;
    viewport: ReturnType<typeof trustedAssessmentMapViewport>;
    boundary: Polygon;
    shell: Feature<Polygon>;
    constructionEnvelope: Feature<Polygon>;
    includeVectors: boolean;
    diagnosticLayers?: Array<{
      key: string;
      geometry: FeatureCollection<Geometry> | null;
      style: ReturnType<typeof reportMapLayerStyle>;
    }>;
  },
): Promise<void> {
  const center = inverseWorldPixel(
    input.viewport.left + input.viewport.width / 2,
    input.viewport.top + input.viewport.height / 2,
    input.viewport.zoom,
  );
  await page.evaluate(
    async ({
      apiKey,
      center,
      zoom,
      boundary,
      shell,
      constructionEnvelope,
      includeVectors,
      diagnosticLayers,
    }) => {
      const maplibregl = (
        window as typeof window & { maplibregl: typeof MapLibre }
      ).maplibregl;
      const sources: Record<string, MapLibre.SourceSpecification> = {
        aerial: {
          type: "raster",
          tiles: [
            `https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api=${apiKey}`,
          ],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 22,
        },
      };
      const layers: MapLibre.LayerSpecification[] = [
        { id: "aerial", type: "raster", source: "aerial" },
      ];
      if (includeVectors) {
        sources.boundary = {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: boundary },
        };
        sources.shell = { type: "geojson", data: shell };
        sources.construction = { type: "geojson", data: constructionEnvelope };
        layers.push(
          {
            id: "boundary-fill",
            type: "fill",
            source: "boundary",
            paint: { "fill-color": "#14b8a6", "fill-opacity": 0.16 },
          },
          {
            id: "boundary-line",
            type: "line",
            source: "boundary",
            paint: { "line-color": "#0f766e", "line-width": 4 },
          },
        );
        for (const diagnosticLayer of diagnosticLayers ?? []) {
          if (!diagnosticLayer.geometry?.features.length) continue;
          const source = `diagnostic-${diagnosticLayer.key}`;
          sources[source] = {
            type: "geojson",
            data: diagnosticLayer.geometry,
          };
          layers.push(
            {
              id: `${source}-line`,
              type: "line",
              source,
              filter: ["==", ["geometry-type"], "LineString"],
              paint: {
                "line-color": diagnosticLayer.style.colour,
                "line-width": 3,
                ...(diagnosticLayer.style.dashed
                  ? { "line-dasharray": [2, 1.5] }
                  : {}),
              },
            },
            {
              id: `${source}-circle`,
              type: "circle",
              source,
              filter: ["==", ["geometry-type"], "Point"],
              paint: {
                "circle-color": diagnosticLayer.style.colour,
                "circle-radius": 5,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
              },
            },
          );
        }
        layers.push(
          {
            id: "construction-line",
            type: "line",
            source: "construction",
            paint: {
              "line-color": "#f97316",
              "line-width": 3,
              "line-dasharray": [2, 1.5],
            },
          },
          {
            id: "pool-fill",
            type: "fill",
            source: "shell",
            paint: { "fill-color": "#2563eb", "fill-opacity": 0.72 },
          },
          {
            id: "pool-line",
            type: "line",
            source: "shell",
            paint: { "line-color": "#0f172a", "line-width": 3 },
          },
        );
      }
      const map = new maplibregl.Map({
        container: "map",
        style: { version: 8, sources, layers },
        center,
        zoom,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      await new Promise<void>((resolveRender, rejectRender) => {
        const timeout = window.setTimeout(
          () => rejectRender(new Error("LIVE_AERIAL_RENDER_TIMEOUT")),
          30_000,
        );
        map.once("idle", () => {
          window.clearTimeout(timeout);
          if (!map.areTilesLoaded()) {
            rejectRender(new Error("LIVE_AERIAL_TILES_NOT_LOADED"));
            return;
          }
          resolveRender();
        });
      });
    },
    {
      ...input,
      center,
      zoom: input.viewport.zoom - 1,
    },
  );
}

async function captureLiveCamera(
  page: import("@playwright/test").Page,
  input: {
    boundary: Polygon;
    shell: Feature<Polygon>;
    constructionEnvelope: Feature<Polygon>;
    bounds: [number, number, number, number];
    anchors: Anchor[];
  },
): Promise<CameraCapture> {
  return page.evaluate(
    async ({ boundary, shell, constructionEnvelope, bounds, anchors }) => {
      const maplibregl = (
        window as typeof window & { maplibregl: typeof MapLibre }
      ).maplibregl;
      const map = new maplibregl.Map({
        container: "map",
        style: {
          version: 8,
          sources: {
            boundary: {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: boundary },
            },
            shell: { type: "geojson", data: shell },
            construction: { type: "geojson", data: constructionEnvelope },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#f8fafc" },
            },
            {
              id: "boundary-fill",
              type: "fill",
              source: "boundary",
              paint: { "fill-color": "#14b8a6", "fill-opacity": 0.16 },
            },
            {
              id: "boundary-line",
              type: "line",
              source: "boundary",
              paint: { "line-color": "#0f766e", "line-width": 4 },
            },
            {
              id: "construction-line",
              type: "line",
              source: "construction",
              paint: {
                "line-color": "#f97316",
                "line-width": 3,
                "line-dasharray": [2, 1.5],
              },
            },
            {
              id: "pool-fill",
              type: "fill",
              source: "shell",
              paint: { "fill-color": "#2563eb", "fill-opacity": 0.72 },
            },
            {
              id: "pool-line",
              type: "line",
              source: "shell",
              paint: { "line-color": "#0f172a", "line-width": 3 },
            },
          ],
        },
        center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
        zoom: 15,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 56, duration: 0, maxZoom: 20 },
      );
      await new Promise<void>((resolveRender, rejectRender) => {
        const timeout = window.setTimeout(
          () => rejectRender(new Error("LIVE_MAP_RENDER_TIMEOUT")),
          10_000,
        );
        map.once("idle", () => {
          window.clearTimeout(timeout);
          resolveRender();
        });
      });
      const center = map.getCenter();
      const visibleBounds = map.getBounds();
      const centrePixel = map.project(center);
      const longitudeProbe = 0.00001;
      const probePixel = map.project([center.lng + longitudeProbe, center.lat]);
      const derivedWorldSize =
        (probePixel.x - centrePixel.x) / (longitudeProbe / 360);
      return {
        width: map.getCanvas().width,
        height: map.getCanvas().height,
        zoom: map.getZoom(),
        center: [center.lng, center.lat] as Point,
        bounds: [
          visibleBounds.getWest(),
          visibleBounds.getSouth(),
          visibleBounds.getEast(),
          visibleBounds.getNorth(),
        ] as [number, number, number, number],
        derivedWorldSize,
        anchors: Object.fromEntries(
          anchors.map((anchor) => {
            const pixel = map.project(anchor.coordinate);
            return [anchor.id, { x: pixel.x, y: pixel.y }];
          }),
        ),
      };
    },
    input,
  );
}

function diagnosticAnchors(
  boundary: Polygon,
  shell: Feature<Polygon>,
): Anchor[] {
  const boundaryRing = boundary.coordinates[0] as Point[];
  const poolRing = shell.geometry.coordinates[0] as Point[];
  return [
    ...boundaryRing.slice(0, -1).map((coordinate, index) => ({
      id: `boundary-${index + 1}`,
      coordinate,
    })),
    ...poolRing.slice(0, -1).map((coordinate, index) => ({
      id: `pool-${index + 1}`,
      coordinate,
    })),
  ];
}

function reportPixel(
  coordinate: Position,
  viewport: ReturnType<typeof trustedAssessmentMapViewport>,
): Pixel {
  const [x, y] = worldPixel(coordinate as Point, viewport.zoom);
  return {
    x: Math.round(x - viewport.left),
    y: Math.round(y - viewport.top),
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

function inverseWorldPixel(x: number, y: number, zoom: number): Point {
  const worldSize = 256 * 2 ** zoom;
  const longitude = (x / worldSize) * 360 - 180;
  const mercator = Math.PI * (1 - (2 * y) / worldSize);
  const latitude = (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
  return [longitude, latitude];
}

function reportViewportBounds(
  viewport: ReturnType<typeof trustedAssessmentMapViewport>,
): [number, number, number, number] {
  const northWest = inverseWorldPixel(
    viewport.left,
    viewport.top,
    viewport.zoom,
  );
  const southEast = inverseWorldPixel(
    viewport.left + viewport.width,
    viewport.top + viewport.height,
    viewport.zoom,
  );
  return [northWest[0], southEast[1], southEast[0], northWest[1]];
}

function h1ProjectionScaleViewport(
  baseline: ReturnType<typeof trustedAssessmentMapViewport>,
): ReturnType<typeof trustedAssessmentMapViewport> {
  return projectionScaleViewport(baseline, baseline.zoom + 1);
}

function projectionScaleViewport(
  baseline: ReturnType<typeof trustedAssessmentMapViewport>,
  zoom: number,
): ReturnType<typeof trustedAssessmentMapViewport> {
  const center = inverseWorldPixel(
    baseline.left + baseline.width / 2,
    baseline.top + baseline.height / 2,
    baseline.zoom,
  );
  const [centerX, centerY] = worldPixel(center, zoom);
  return {
    zoom,
    left: Math.floor(centerX - baseline.width / 2),
    top: Math.floor(centerY - baseline.height / 2),
    width: baseline.width,
    height: baseline.height,
  };
}

function compareLiveToViewport(
  live: CameraCapture,
  viewport: ReturnType<typeof trustedAssessmentMapViewport>,
  anchors: Anchor[],
) {
  const reportAnchors = Object.fromEntries(
    anchors.map((anchor) => [
      anchor.id,
      reportPixel(anchor.coordinate, viewport),
    ]),
  );
  const anchorDeltas = anchors.map((anchor) => {
    const livePixel = live.anchors[anchor.id];
    const reportPixelValue = reportAnchors[anchor.id];
    const normalization = Math.min(live.height, viewport.height);
    const dx =
      (livePixel.x -
        live.width / 2 -
        (reportPixelValue.x - viewport.width / 2)) /
      normalization;
    const dy =
      (livePixel.y -
        live.height / 2 -
        (reportPixelValue.y - viewport.height / 2)) /
      normalization;
    return {
      id: anchor.id,
      live: livePixel,
      report: reportPixelValue,
      normalizedDelta: Number(Math.hypot(dx, dy).toFixed(6)),
    };
  });
  const worldSize = 256 * 2 ** viewport.zoom;
  const scaleRatio = Math.max(
    live.derivedWorldSize / worldSize,
    worldSize / live.derivedWorldSize,
  );
  return {
    scaleRatio: Number(scaleRatio.toFixed(6)),
    maximumNormalizedAnchorDelta: Math.max(
      ...anchorDeltas.map((anchor) => anchor.normalizedDelta),
    ),
    anchors: anchorDeltas,
  };
}

async function measureRasterRegistration(
  livePath: string,
  reportPath: string,
  searchRadiusPixels: number,
) {
  const live = await sharp(livePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const report = await sharp(reportPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    live.info.width !== report.info.width ||
    live.info.height !== report.info.height ||
    live.info.channels !== report.info.channels
  ) {
    throw new Error("H3_AERIAL_DIMENSIONS_DIFFER");
  }
  const width = live.info.width;
  const height = live.info.height;
  const channels = live.info.channels;
  const downsampleFactor = 8;
  const downsampleWidth = Math.round(width / downsampleFactor);
  const downsampleHeight = Math.round(height / downsampleFactor);
  const [liveSmall, reportSmall] = await Promise.all(
    [livePath, reportPath].map((path) =>
      sharp(path)
        .removeAlpha()
        .resize(downsampleWidth, downsampleHeight, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const coarseRadius = Math.ceil(searchRadiusPixels / downsampleFactor);
  const coarse = findBestRasterShift({
    live: liveSmall.data,
    report: reportSmall.data,
    width: downsampleWidth,
    height: downsampleHeight,
    channels: liveSmall.info.channels,
    minimumX: -coarseRadius,
    maximumX: coarseRadius,
    minimumY: -coarseRadius,
    maximumY: coarseRadius,
    sampleStep: 1,
  });
  const coarseX = coarse.x * downsampleFactor;
  const coarseY = coarse.y * downsampleFactor;
  const refinementRadius = downsampleFactor + 2;
  const best = findBestRasterShift({
    live: live.data,
    report: report.data,
    width,
    height,
    channels,
    minimumX: Math.max(-searchRadiusPixels, coarseX - refinementRadius),
    maximumX: Math.min(searchRadiusPixels, coarseX + refinementRadius),
    minimumY: Math.max(-searchRadiusPixels, coarseY - refinementRadius),
    maximumY: Math.min(searchRadiusPixels, coarseY + refinementRadius),
    sampleStep: 4,
  });
  const zeroShiftMeanAbsoluteError = rasterShiftError({
    live: live.data,
    report: report.data,
    width,
    height,
    channels,
    shiftX: 0,
    shiftY: 0,
    sampleStep: 4,
  });
  return {
    bestShift: { x: best.x, y: best.y },
    zeroShiftMeanAbsoluteError: Number(zeroShiftMeanAbsoluteError.toFixed(6)),
    bestMeanAbsoluteError: Number(best.meanAbsoluteError.toFixed(6)),
    searchRadiusPixels,
  };
}

function findBestRasterShift(input: {
  live: Buffer;
  report: Buffer;
  width: number;
  height: number;
  channels: number;
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
  sampleStep: number;
}) {
  let best = { x: 0, y: 0, meanAbsoluteError: Number.POSITIVE_INFINITY };
  for (let shiftY = input.minimumY; shiftY <= input.maximumY; shiftY += 1) {
    for (let shiftX = input.minimumX; shiftX <= input.maximumX; shiftX += 1) {
      const meanAbsoluteError = rasterShiftError({
        ...input,
        shiftX,
        shiftY,
      });
      if (meanAbsoluteError < best.meanAbsoluteError) {
        best = { x: shiftX, y: shiftY, meanAbsoluteError };
      }
    }
  }
  return best;
}

function rasterShiftError(input: {
  live: Buffer;
  report: Buffer;
  width: number;
  height: number;
  channels: number;
  shiftX: number;
  shiftY: number;
  sampleStep: number;
}) {
  let absoluteError = 0;
  let samples = 0;
  const startX = Math.max(0, -input.shiftX);
  const endX = Math.min(input.width, input.width - input.shiftX);
  const startY = Math.max(0, -input.shiftY);
  const endY = Math.min(input.height, input.height - input.shiftY);
  for (let y = startY; y < endY; y += input.sampleStep) {
    for (let x = startX; x < endX; x += input.sampleStep) {
      const liveIndex = (y * input.width + x) * input.channels;
      const reportIndex =
        ((y + input.shiftY) * input.width + x + input.shiftX) * input.channels;
      for (
        let channel = 0;
        channel < Math.min(input.channels, 3);
        channel += 1
      ) {
        absoluteError += Math.abs(
          input.live[liveIndex + channel] - input.report[reportIndex + channel],
        );
        samples += 1;
      }
    }
  }
  return absoluteError / samples;
}

function decodePngDataUrl(dataUrl: string): Buffer {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) {
    throw new Error("DIAGNOSTIC_REPORT_PNG_INVALID");
  }
  return Buffer.from(dataUrl.slice(prefix.length), "base64");
}

async function writeComparisonImage(
  livePath: string,
  reportPath: string,
  comparisonPath: string,
  reportLabel = `Report camera (${REPORT_WIDTH} x ${REPORT_HEIGHT})`,
): Promise<void> {
  const headingHeight = 46;
  const gap = 20;
  const width = LIVE_WIDTH + REPORT_WIDTH + gap;
  const label = Buffer.from(`<svg width="${width}" height="${headingHeight}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="12" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">Live MapLibre camera (${LIVE_WIDTH} x ${LIVE_HEIGHT})</text>
    <text x="${LIVE_WIDTH + gap + 12}" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">${reportLabel}</text>
  </svg>`);
  await sharp({
    create: {
      width,
      height: headingHeight + Math.max(LIVE_HEIGHT, REPORT_HEIGHT),
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      { input: label, left: 0, top: 0 },
      { input: livePath, left: 0, top: headingHeight },
      { input: reportPath, left: LIVE_WIDTH + gap, top: headingHeight },
    ])
    .png()
    .toFile(comparisonPath);
}

async function writeMatchedViewportComparisonImage(
  livePath: string,
  reportPath: string,
  comparisonPath: string,
  liveLabel = `MapLibre matched viewport (${REPORT_WIDTH} x ${REPORT_HEIGHT})`,
  reportLabel = `H1 report probe (${REPORT_WIDTH} x ${REPORT_HEIGHT})`,
): Promise<void> {
  const headingHeight = 46;
  const gap = 20;
  const width = REPORT_WIDTH * 2 + gap;
  const label = Buffer.from(`<svg width="${width}" height="${headingHeight}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="12" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">${liveLabel}</text>
    <text x="${REPORT_WIDTH + gap + 12}" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">${reportLabel}</text>
  </svg>`);
  await sharp({
    create: {
      width,
      height: headingHeight + REPORT_HEIGHT,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      { input: label, left: 0, top: 0 },
      { input: livePath, left: 0, top: headingHeight },
      { input: reportPath, left: REPORT_WIDTH + gap, top: headingHeight },
    ])
    .png()
    .toFile(comparisonPath);
}

async function writeH4VectorComparisonImage(
  livePath: string,
  reportPath: string,
  comparisonPath: string,
): Promise<void> {
  const headingHeight = 46;
  const gap = 20;
  const legendHeight = 142;
  const width = REPORT_WIDTH * 2 + gap;
  const heading = Buffer.from(`<svg width="${width}" height="${headingHeight}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="12" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">MapLibre actual aerial + diagnostic layers</text>
    <text x="${REPORT_WIDTH + gap + 12}" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">H4 materialized report aerial + diagnostic layers</text>
  </svg>`);
  const legendItems = DIAGNOSTIC_LEGEND.map((item, index) => {
    const style = reportMapLayerStyle(item.key);
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 22 + column * 600;
    const y = 62 + row * 42;
    return `<line x1="${x}" y1="${y - 6}" x2="${x + 42}" y2="${y - 6}" stroke="${style.colour}" stroke-width="4"${style.dashed ? ' stroke-dasharray="8 6"' : ""}/>
      <text x="${x + 54}" y="${y - 10}" font-family="Arial" font-size="16" font-weight="700" fill="#0f172a">${style.label}</text>
      <text x="${x + 54}" y="${y + 10}" font-family="Arial" font-size="13" fill="#475569">${item.status}</text>`;
  }).join("");
  const legend = Buffer.from(`<svg width="${width}" height="${legendHeight}">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    <text x="20" y="27" font-family="Arial" font-size="17" font-weight="700" fill="#0f172a">Diagnostic map-layer legend</text>
    <text x="260" y="27" font-family="Arial" font-size="13" fill="#475569">Fixture visualization only; production report-use policy is unchanged.</text>
    ${legendItems}
  </svg>`);
  await sharp({
    create: {
      width,
      height: headingHeight + REPORT_HEIGHT + legendHeight,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      { input: heading, left: 0, top: 0 },
      { input: livePath, left: 0, top: headingHeight },
      { input: reportPath, left: REPORT_WIDTH + gap, top: headingHeight },
      { input: legend, left: 0, top: headingHeight + REPORT_HEIGHT },
    ])
    .png()
    .toFile(comparisonPath);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
