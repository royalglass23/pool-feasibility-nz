"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  REPORT_MAP_BASE_STYLES,
  reportMapLayerKey,
  reportMapLayerStyle,
  reportMapPoolStyle,
  shouldReproduceReportMapLayer,
} from "@/modules/reporting/report-map-style";

type InteractiveLayer = {
  id: string;
  label: string;
  colour: string;
  dashed?: boolean;
  kind: "fill" | "line" | "circle";
  geometries: Geometry[];
};

export function SavedReportInteractiveMap({
  report,
  attribution,
}: {
  report: SavedPreliminaryReport;
  attribution: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const layers = useMemo(() => interactiveLayers(report), [report]);
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(layers.map((layer) => [layer.id, true])),
  );
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined" || !supportsWebGl()) {
      return;
    }

    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;

    async function loadMap() {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container) return;
      const sources = Object.fromEntries(
        layers.map((layer) => [
          layer.id,
          {
            type: "geojson" as const,
            data: featureCollection(layer.geometries),
          },
        ]),
      );
      const styleLayers = layers.map(mapLayerSpecification);
      const style: StyleSpecification = {
        version: 8,
        sources,
        layers: [
          {
            id: "saved-report-background",
            type: "background",
            paint: { "background-color": "#e2e8f0" },
          },
          ...styleLayers,
        ],
      };
      map = new maplibregl.Map({
        container,
        style,
        center: report.pool.position,
        zoom: 18,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.once("load", () => {
        if (cancelled || !map) return;
        const bounds = new maplibregl.LngLatBounds();
        for (const layer of layers) {
          for (const geometry of layer.geometries) {
            for (const coordinate of geometryCoordinates(geometry)) {
              bounds.extend(coordinate);
            }
          }
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 52, maxZoom: 19, duration: 0 });
        }
        setMapReady(true);
      });
    }

    void loadMap().catch(() => setMapReady(false));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [layers, report.pool.position]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    for (const layer of layers) {
      if (!map.getLayer(layer.id)) continue;
      map.setLayoutProperty(
        layer.id,
        "visibility",
        visible[layer.id] === false ? "none" : "visible",
      );
    }
  }, [layers, mapReady, visible]);

  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"
      role="region"
      aria-label="Interactive assessment map"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative min-h-80 bg-slate-100 sm:min-h-[30rem]">
          <Image
            src={report.mapImageDataUrl}
            alt="Saved aerial assessment map showing the mapped property and proposed pool"
            width={1400}
            height={900}
            unoptimized
            className={`absolute inset-0 h-full w-full object-contain transition-opacity ${mapReady ? "pointer-events-none opacity-0" : "opacity-100"}`}
          />
          <div
            ref={containerRef}
            className={`absolute inset-0 transition-opacity ${mapReady ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden="true"
          />
        </div>
        <div className="border-t border-slate-200 p-4 lg:border-t-0 lg:border-l">
          <p className="text-sm font-semibold text-slate-950">Map layers</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Toggle evidence saved with this assessment. No live data is loaded.
          </p>
          <div className="mt-4 space-y-3">
            {layers.map((layer) => {
              const isVisible = visible[layer.id] !== false;
              return (
                <label
                  key={layer.id}
                  className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(event) =>
                      setVisible((current) => ({
                        ...current,
                        [layer.id]: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 accent-teal-700"
                  />
                  <span className="min-w-0 text-sm font-medium text-slate-800">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-7 shrink-0"
                        style={{
                          backgroundColor:
                            layer.kind === "fill"
                              ? `${layer.colour}38`
                              : "transparent",
                          borderTop:
                            layer.kind === "fill"
                              ? undefined
                              : `3px ${layer.dashed ? "dashed" : "solid"} ${layer.colour}`,
                          boxShadow:
                            layer.kind === "fill"
                              ? `inset 0 0 0 2px ${layer.colour}`
                              : undefined,
                        }}
                      />
                      {layer.label}
                    </span>
                    {!isVisible && (
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {layer.label} hidden
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600 sm:px-5">
        {attribution}
      </p>
    </div>
  );
}

function interactiveLayers(report: SavedPreliminaryReport): InteractiveLayer[] {
  const poolStyle = reportMapPoolStyle(report.warningState);
  const layers: InteractiveLayer[] = [
    ...(report.property.boundaryGeometry
      ? [
          {
            id: "saved-property-boundary",
            label: REPORT_MAP_BASE_STYLES.boundary.label,
            colour: REPORT_MAP_BASE_STYLES.boundary.colour,
            kind: "fill" as const,
            geometries: [report.property.boundaryGeometry as Geometry],
          },
        ]
      : []),
    {
      id: "saved-construction-envelope",
      label: REPORT_MAP_BASE_STYLES.constructionEnvelope.label,
      colour: REPORT_MAP_BASE_STYLES.constructionEnvelope.colour,
      dashed: true,
      kind: "line" as const,
      geometries: [report.pool.constructionEnvelopeGeometry as Geometry],
    },
    {
      id: "saved-selected-pool",
      label: poolStyle.label,
      colour: poolStyle.colour,
      kind: "fill" as const,
      geometries: [report.pool.shellGeometry as Geometry],
    },
  ];
  const evidenceLayers: InteractiveLayer[] = [];
  const labelCounts = new Map<string, number>();
  for (const [index, layer] of report.layers.entries()) {
    const key = reportMapLayerKey(layer.id, layer.dataset);
    if (
      !layer.geometry ||
      layer.state !== "returned" ||
      !shouldReproduceReportMapLayer(key) ||
      layer.evidenceUse !== "report_allowed"
    ) {
      continue;
    }
    const style = reportMapLayerStyle(key);
    const labelCount = labelCounts.get(style.label) ?? 0;
    labelCounts.set(style.label, labelCount + 1);
    evidenceLayers.push({
      id: `saved-evidence-${slug(style.label)}-${index}`,
      label:
        labelCount === 0 ? style.label : `${style.label} - ${layer.dataset}`,
      colour: style.colour,
      dashed: style.dashed,
      kind: geometryKind(layer.geometry as Geometry),
      geometries: [layer.geometry as Geometry],
    });
  }
  return [...layers, ...evidenceLayers];
}

function mapLayerSpecification(layer: InteractiveLayer): LayerSpecification {
  if (layer.kind === "fill") {
    return {
      id: layer.id,
      source: layer.id,
      type: "fill",
      paint: {
        "fill-color": layer.colour,
        "fill-opacity": 0.2,
        "fill-outline-color": layer.colour,
      },
    };
  }
  if (layer.kind === "circle") {
    return {
      id: layer.id,
      source: layer.id,
      type: "circle",
      paint: {
        "circle-color": layer.colour,
        "circle-radius": 5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    };
  }
  return {
    id: layer.id,
    source: layer.id,
    type: "line",
    paint: {
      "line-color": layer.colour,
      "line-width": 3,
      ...(layer.dashed ? { "line-dasharray": [2, 2] } : {}),
    },
  };
}

function featureCollection(geometries: Geometry[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    })),
  };
}

function geometryKind(geometry: Geometry): InteractiveLayer["kind"] {
  if (geometry.type === "GeometryCollection") {
    const kinds = geometry.geometries.map(geometryKind);
    if (kinds.includes("line")) return "line";
    if (kinds.includes("fill")) return "fill";
    return "circle";
  }
  if (geometry.type === "Point" || geometry.type === "MultiPoint") {
    return "circle";
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return "fill";
  }
  return "line";
}

function geometryCoordinates(geometry: Geometry): Array<[number, number]> {
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap(geometryCoordinates);
  }
  const coordinates: Array<[number, number]> = [];
  collectCoordinates(geometry.coordinates, coordinates);
  return coordinates;
}

function collectCoordinates(
  value: unknown,
  output: Array<[number, number]>,
): void {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    output.push([value[0], value[1]]);
    return;
  }
  for (const child of value) collectCoordinates(child, output);
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function supportsWebGl(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl"));
  } catch {
    return false;
  }
}
