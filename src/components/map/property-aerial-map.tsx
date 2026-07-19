"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { escapeHtml } from "@/shared/html/escape-html";

type DatasetKey = keyof DataAccessSpikeResult["datasets"];
type MapLayerDefinition = {
  key: DatasetKey;
  color: string;
  kind: "fill" | "line" | "circle";
};

const mapLayerDefinitions: MapLayerDefinition[] = [
  { key: "building_footprints", color: "#f97316", kind: "fill" },
  { key: "contours", color: "#a16207", kind: "line" },
  { key: "planning_zone", color: "#8b5cf6", kind: "fill" },
  { key: "planning_overlays", color: "#ec4899", kind: "fill" },
  { key: "flood_plains", color: "#2563eb", kind: "fill" },
  { key: "flood_prone_areas", color: "#60a5fa", kind: "fill" },
  { key: "overland_flow_paths", color: "#0ea5e9", kind: "line" },
  { key: "public_stormwater_assets", color: "#64748b", kind: "line" },
  { key: "manholes", color: "#334155", kind: "circle" },
  { key: "catchpits", color: "#475569", kind: "circle" },
  { key: "watercourses", color: "#0891b2", kind: "line" },
  { key: "public_water_assets", color: "#0d9488", kind: "line" },
  { key: "water_fittings", color: "#14b8a6", kind: "circle" },
  { key: "wastewater_assets", color: "#7c3aed", kind: "line" },
  { key: "wastewater_manholes", color: "#6d28d9", kind: "circle" },
  { key: "wastewater_fittings", color: "#8b5cf6", kind: "circle" },
];

export function PropertyAerialMap({
  result,
  onRetry,
}: {
  result: DataAccessSpikeResult;
  onRetry: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const aerialConfigured =
    result.datasets.aerial_imagery.status === "available";
  const aerialFailed =
    result.datasets.aerial_imagery.status === "error" || mapError;
  const aerialVerified = aerialConfigured && tilesLoaded && !mapError;
  const aerialAttribution = result.datasets.aerial_imagery.attribution;
  const mappedLayers = useMemo(
    () =>
      mapLayerDefinitions.flatMap((definition) => {
        const evidence = result.datasets[definition.key];
        return evidence ? [{ definition, evidence }] : [];
      }),
    [result.datasets],
  );
  const visibleMappedLayers = useMemo(
    () =>
      mappedLayers.filter(
        ({ definition, evidence }) =>
          evidence.status === "success" &&
          Boolean(evidence.geometry) &&
          (layerVisibility[definition.key] ?? true),
      ),
    [layerVisibility, mappedLayers],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      typeof window === "undefined" ||
      !("WebGLRenderingContext" in window)
    ) {
      return;
    }

    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;

    async function loadMap() {
      setMapError(false);
      setTilesLoaded(false);
      const { default: maplibregl } = await import("maplibre-gl");
      if (cancelled || !container) return;

      const parcelFeature: Feature = {
        type: "Feature",
        properties: { parcelId: result.parcel.parcelId },
        geometry: result.parcel.geometry,
      };
      const addressFeature: Feature<Point> = {
        type: "Feature",
        properties: { addressId: result.resolvedAddress.addressId },
        geometry: {
          type: "Point",
          coordinates: result.resolvedAddress.coordinates,
        },
      };
      const sources: StyleSpecification["sources"] = {
        parcel: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [parcelFeature],
          } satisfies FeatureCollection,
        },
        address: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [addressFeature],
          } satisfies FeatureCollection,
        },
      };
      const layers: LayerSpecification[] = [];
      if (aerialConfigured) {
        sources.aerial = {
          type: "raster",
          tiles: ["/api/internal/aerial/tiles/{z}/{x}/{y}"],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 22,
          ...(aerialAttribution
            ? {
                attribution: `<a href="${escapeHtml(aerialAttribution.url)}">${escapeHtml(aerialAttribution.text)}</a>`,
              }
            : {}),
        };
        layers.push({ id: "aerial", type: "raster", source: "aerial" });
      }
      for (const { definition, evidence } of visibleMappedLayers) {
        const source = `official-${definition.key}`;
        sources[source] = { type: "geojson", data: evidence.geometry! };
        if (definition.kind === "fill") {
          layers.push({
            id: source,
            type: "fill",
            source,
            paint: {
              "fill-color": definition.color,
              "fill-opacity": 0.28,
              "fill-outline-color": definition.color,
            },
          });
        } else if (definition.kind === "line") {
          layers.push({
            id: source,
            type: "line",
            source,
            paint: { "line-color": definition.color, "line-width": 3 },
          });
        } else {
          layers.push({
            id: source,
            type: "circle",
            source,
            paint: {
              "circle-color": definition.color,
              "circle-radius": 5,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
            },
          });
        }
      }
      if (result.compactAnalysis.candidates.length > 0) {
        sources["compact-envelopes"] = {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: result.compactAnalysis.candidates.map((candidate) => ({
              ...candidate.envelope,
              properties: { candidateRank: candidate.rank },
            })),
          },
        };
        sources["compact-shells"] = {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: result.compactAnalysis.candidates.map((candidate) => ({
              ...candidate.shell,
              properties: { candidateRank: candidate.rank },
            })),
          },
        };
        layers.push(
          {
            id: "compact-envelope-fill",
            type: "fill",
            source: "compact-envelopes",
            paint: { "fill-color": "#facc15", "fill-opacity": 0.16 },
          },
          {
            id: "compact-envelope-outline",
            type: "line",
            source: "compact-envelopes",
            paint: {
              "line-color": "#ca8a04",
              "line-width": 2,
              "line-dasharray": [2, 2],
            },
          },
          {
            id: "compact-shell-fill",
            type: "fill",
            source: "compact-shells",
            paint: { "fill-color": "#14b8a6", "fill-opacity": 0.5 },
          },
          {
            id: "compact-shell-outline",
            type: "line",
            source: "compact-shells",
            paint: { "line-color": "#0f766e", "line-width": 3 },
          },
        );
      }
      layers.push(
        {
          id: "parcel-fill",
          type: "fill",
          source: "parcel",
          paint: { "fill-color": "#14b8a6", "fill-opacity": 0.18 },
        },
        {
          id: "parcel-outline",
          type: "line",
          source: "parcel",
          paint: { "line-color": "#0f766e", "line-width": 4 },
        },
        {
          id: "address-point",
          type: "circle",
          source: "address",
          paint: {
            "circle-color": "#f97316",
            "circle-radius": 7,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        },
      );
      const style: StyleSpecification = {
        version: 8,
        sources,
        layers,
      };

      map = new maplibregl.Map({
        container,
        style,
        attributionControl: { compact: true },
        center: result.resolvedAddress.coordinates,
        zoom: 18,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      const bounds = new maplibregl.LngLatBounds();
      for (const ring of result.parcel.geometry.coordinates) {
        for (const coordinate of ring) {
          bounds.extend([coordinate[0], coordinate[1]]);
        }
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 20, duration: 0 });
      map.on("error", () => setMapError(true));
      map.once("idle", () => {
        if (!cancelled) setTilesLoaded(true);
      });
    }

    void loadMap().catch(() => setMapError(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [aerialAttribution, aerialConfigured, result, visibleMappedLayers]);

  return (
    <section
      aria-label={`Aerial map for ${result.resolvedAddress.fullAddress}`}
      className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-white/10 bg-slate-950 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">
            Confirmed parcel on LINZ aerial imagery
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Teal shows parcel {result.parcel.parcelId}; orange marks the
            resolved address point.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wide text-teal-200 uppercase">
            {aerialFailed
              ? "Imagery unavailable"
              : aerialVerified
                ? "Imagery verified"
                : "Imagery loading"}
          </span>
          {aerialFailed && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-teal-300/40 px-3 py-2 text-xs font-semibold text-white transition hover:border-teal-200 hover:bg-white/10"
            >
              Try imagery again
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-5 border-b border-slate-200 bg-white p-5 lg:grid-cols-[1.5fr_0.8fr]">
        <div>
          <h4 className="font-semibold text-slate-950">Official map layers</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Only returned official geometry is drawn. Missing infrastructure is
            never inferred.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {mappedLayers.map(({ definition, evidence }) => {
              const hasGeometry =
                evidence.status === "success" && Boolean(evidence.geometry);
              return (
                <label
                  key={definition.key}
                  className="flex gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    aria-label={evidence.dataset}
                    checked={
                      hasGeometry && (layerVisibility[definition.key] ?? true)
                    }
                    disabled={!hasGeometry}
                    onChange={(event) =>
                      setLayerVisibility((current) => ({
                        ...current,
                        [definition.key]: event.target.checked,
                      }))
                    }
                    className="mt-1 size-4 accent-teal-700"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium text-slate-900">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: definition.color }}
                      />
                      {evidence.dataset}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {mapEvidenceSummary(evidence)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Dataset vintage: {evidence.datasetDate ?? "not published"}
                    </span>
                    {evidence.evidenceUse === "internal_reference" && (
                      <span className="mt-1 block font-semibold text-amber-700">
                        Internal reference only
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-slate-950">Legend</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {result.compactAnalysis.candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm bg-teal-500 ring-2 ring-yellow-400"
                />
                Compact candidate {candidate.rank}
              </li>
            ))}
            {visibleMappedLayers.map(({ definition, evidence }) => (
              <li key={definition.key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ backgroundColor: definition.color }}
                />
                {evidence.dataset} ({evidence.featureCount ?? 0})
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2 text-xs leading-5 text-slate-500">
            {uniqueMappedAttributions(mappedLayers).map((attribution) => (
              <a
                key={attribution.url}
                className="block underline"
                href={attribution.url}
              >
                {attribution.text}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div ref={containerRef} className="h-96 w-full bg-slate-800" />
      <div className="flex flex-col gap-2 bg-white px-5 py-3 text-xs leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {mapError
            ? "The interactive imagery could not be loaded. Retry the property request or check the LINZ key."
            : "Parcel geometry is drawn from the confirmed normalized LINZ result."}
        </p>
        <p className="shrink-0">
          {aerialAttribution ? (
            <a className="underline" href={aerialAttribution.url}>
              {aerialAttribution.text}
            </a>
          ) : (
            "LINZ aerial attribution unavailable"
          )}
        </p>
      </div>
    </section>
  );
}

function mapEvidenceSummary(
  evidence: DataAccessSpikeResult["datasets"][DatasetKey],
): string {
  if (evidence.status === "success" && evidence.geometry) {
    return `${evidence.featureCount ?? evidence.geometry.features.length} mapped features from ${evidence.provider}`;
  }
  if (evidence.errorCode === "PROVIDER_TIMEOUT") {
    return `${evidence.dataset}: provider timed out`;
  }
  if (evidence.errorCode === "PROVIDER_RESPONSE_INVALID") {
    return `${evidence.dataset}: provider response was invalid`;
  }
  if (evidence.errorCode === "PROVIDER_RESPONSE_TOO_LARGE") {
    return `${evidence.dataset}: provider response exceeded the safe limit`;
  }
  if (evidence.status === "error") {
    return `${evidence.dataset}: provider unavailable`;
  }
  return evidence.reason ?? `${evidence.dataset}: geometry unavailable`;
}

function uniqueMappedAttributions(
  layers: Array<{
    evidence: DataAccessSpikeResult["datasets"][DatasetKey];
  }>,
) {
  const byUrl = new Map<string, { text: string; url: string }>();
  for (const { evidence } of layers) {
    if (evidence.attribution) {
      byUrl.set(evidence.attribution.url, evidence.attribution);
    }
  }
  return [...byUrl.values()];
}
