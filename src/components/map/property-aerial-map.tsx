"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { escapeHtml } from "@/shared/html/escape-html";
import {
  assessCustomPoolPlacement,
  type CustomPoolPlacementAssessment,
} from "@/modules/spatial/assess-custom-pool-placement";
import {
  legalParcelEvidenceForMap,
  spatialEvidenceForMap,
  useAssistedPlacementSearch,
} from "./assisted-placement-search";
import { AssistedPlacementResults } from "./assisted-placement-results";
import type { AssistedPlacementCandidate } from "@/modules/spatial/find-assisted-pool-placements";

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
  { key: "electricity_feeder_lines", color: "#eab308", kind: "line" },
  { key: "gas_distribution_lines", color: "#dc2626", kind: "line" },
];

export function PropertyAerialMap({
  result,
  onRetry,
  onSnapshotReady,
}: {
  result: DataAccessSpikeResult;
  onRetry: () => void;
  onSnapshotReady?: (dataUrl: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [mapError, setMapError] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const [placementPreset, setPlacementPreset] = useState("compact");
  const [customLength, setCustomLength] = useState("6");
  const [customWidth, setCustomWidth] = useState("3");
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [position, setPosition] = useState<readonly [number, number]>(
    result.resolvedAddress.coordinates,
  );
  const recommendedAnalysis = result.scenarioComparison.scenarios.find(
    (analysis) =>
      analysis.scenario.id ===
      result.scenarioComparison.recommendedShell?.scenarioId,
  );
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
  const placementScenarios = useMemo(
    () => result.scenarioComparison.scenarios,
    [result.scenarioComparison.scenarios],
  );
  const selectedPresetDimensions = useMemo(() => {
    const scenario = placementScenarios.find(
      (item) => item.scenario.id === placementPreset,
    );
    return scenario
      ? {
          lengthMetres: scenario.scenario.shellLengthMetres,
          widthMetres: scenario.scenario.shellWidthMetres,
        }
      : null;
  }, [placementPreset, placementScenarios]);
  const placementDimensions = useMemo(
    () =>
      placementPreset === "custom"
        ? {
            lengthMetres: Number(customLength),
            widthMetres: Number(customWidth),
          }
        : selectedPresetDimensions,
    [customLength, customWidth, placementPreset, selectedPresetDimensions],
  );
  const placementAssessment =
    useMemo<CustomPoolPlacementAssessment | null>(() => {
      if (!placementDimensions) return null;
      try {
        return assessCustomPoolPlacement({
          parcel: result.parcel.geometry,
          parcelStatus:
            result.parcelMatch.status === "mapped_primary_parcel"
              ? "confirmed"
              : "unconfirmed",
          position,
          rotationDegrees,
          lengthMetres: placementDimensions.lengthMetres,
          widthMetres: placementDimensions.widthMetres,
          parcelEvidence: legalParcelEvidenceForMap(result),
          buildings: spatialEvidenceForMap("building_footprints", result),
          constraints: [
            "planning_zone",
            "planning_overlays",
            "flood_plains",
            "flood_prone_areas",
            "overland_flow_paths",
          ].map((key) => spatialEvidenceForMap(key, result)),
        });
      } catch {
        return null;
      }
    }, [placementDimensions, position, result, rotationDegrees]);
  const placementValidationMessage =
    placementPreset === "custom" && !placementAssessment
      ? "Enter length and width between 0.1 m and 30 m before assessing the placement."
      : null;
  const {
    assistedSearch,
    assistedSearchLoading,
    runAssistedSearch,
  } = useAssistedPlacementSearch({
    result,
    dimensions: placementDimensions,
    mapRef,
    aerialVerified,
  });

  function selectAssistedCandidate(candidate: AssistedPlacementCandidate) {
    setPosition(candidate.position);
    setRotationDegrees(candidate.rotationDegrees);
  }

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
        "placement-shell": geoJsonSource(placementAssessment?.shell),
        "placement-construction": geoJsonSource(
          placementAssessment?.envelopes.constructionAllowance,
        ),
        "placement-barrier": geoJsonSource(
          placementAssessment?.envelopes.barrier,
        ),
        "placement-access": geoJsonSource(
          placementAssessment?.envelopes.access,
        ),
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
      if (recommendedAnalysis && recommendedAnalysis.candidates.length > 0) {
        sources["recommended-envelopes"] = {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: recommendedAnalysis.candidates.map((candidate) => ({
              ...candidate.envelope,
              properties: { candidateRank: candidate.rank },
            })),
          },
        };
        sources["recommended-shells"] = {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: recommendedAnalysis.candidates.map((candidate) => ({
              ...candidate.shell,
              properties: { candidateRank: candidate.rank },
            })),
          },
        };
        layers.push(
          {
            id: "recommended-envelope-fill",
            type: "fill",
            source: "recommended-envelopes",
            paint: { "fill-color": "#facc15", "fill-opacity": 0.16 },
          },
          {
            id: "recommended-envelope-outline",
            type: "line",
            source: "recommended-envelopes",
            paint: {
              "line-color": "#ca8a04",
              "line-width": 2,
              "line-dasharray": [2, 2],
            },
          },
          {
            id: "recommended-shell-fill",
            type: "fill",
            source: "recommended-shells",
            paint: { "fill-color": "#14b8a6", "fill-opacity": 0.5 },
          },
          {
            id: "recommended-shell-outline",
            type: "line",
            source: "recommended-shells",
            paint: { "line-color": "#0f766e", "line-width": 3 },
          },
        );
      }
      const reportHiddenLayerIds = [
        ...(result.datasets.aerial_imagery.evidenceUse !== "report_allowed"
          ? ["aerial"]
          : []),
        ...visibleMappedLayers
          .filter(({ evidence }) => evidence.evidenceUse !== "report_allowed")
          .map(({ definition }) => `official-${definition.key}`),
      ];
      if (placementAssessment) {
        layers.push(
          {
            id: "placement-access-line",
            type: "line",
            source: "placement-access",
            paint: {
              "line-color": "#2563eb",
              "line-width": 3,
              "line-dasharray": [1, 2],
            },
          },
          {
            id: "placement-barrier-line",
            type: "line",
            source: "placement-barrier",
            paint: {
              "line-color": "#7c3aed",
              "line-width": 3,
              "line-dasharray": [2, 1],
            },
          },
          {
            id: "placement-construction-line",
            type: "line",
            source: "placement-construction",
            paint: {
              "line-color": "#d97706",
              "line-width": 3,
              "line-dasharray": [3, 2],
            },
          },
          {
            id: "placement-shell-fill",
            type: "fill",
            source: "placement-shell",
            paint: {
              "fill-color":
                placementAssessment?.classification === "hard_conflict"
                  ? "#dc2626"
                  : placementAssessment?.classification === "unknown"
                    ? "#d97706"
                    : "#0f766e",
              "fill-opacity": 0.72,
            },
          },
          {
            id: "placement-shell-outline",
            type: "line",
            source: "placement-shell",
            paint: { "line-color": "#0f172a", "line-width": 3 },
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
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      const activeMap = map;
      mapRef.current = activeMap;
      activeMap.addControl(new maplibregl.NavigationControl(), "top-right");

      let dragging = false;
      activeMap.on("mousedown", "placement-shell-fill", (event) => {
        dragging = true;
        activeMap.getCanvas().style.cursor = "grabbing";
        activeMap.dragPan.disable();
        setPosition(activeMap.unproject(event.point).toArray());
      });
      activeMap.on("mousemove", (event) => {
        if (dragging) setPosition(activeMap.unproject(event.point).toArray());
      });
      activeMap.on("mouseup", () => {
        dragging = false;
        activeMap.getCanvas().style.cursor = "";
        activeMap.dragPan.enable();
      });

      const bounds = new maplibregl.LngLatBounds();
      for (const ring of result.parcel.geometry.coordinates) {
        for (const coordinate of ring) {
          bounds.extend([coordinate[0], coordinate[1]]);
        }
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 20, duration: 0 });
      map.on("error", () => setMapError(true));
      map.once("idle", () => {
        if (!cancelled) {
          setTilesLoaded(true);
          const restoreInteractiveLayers = () => {
            for (const layerId of reportHiddenLayerIds) {
              map?.setLayoutProperty(layerId, "visibility", "visible");
            }
          };
          const captureReportSnapshot = () => {
            if (cancelled) return;
            try {
              onSnapshotReady?.(
                map?.getCanvas().toDataURL("image/png") ?? null,
              );
            } catch {
              onSnapshotReady?.(null);
            } finally {
              restoreInteractiveLayers();
            }
          };
          try {
            for (const layerId of reportHiddenLayerIds) {
              map?.setLayoutProperty(layerId, "visibility", "none");
            }
            if (reportHiddenLayerIds.length > 0) {
              map?.once("idle", captureReportSnapshot);
            } else {
              captureReportSnapshot();
            }
          } catch {
            onSnapshotReady?.(null);
            restoreInteractiveLayers();
          }
        }
      });
    }

    void loadMap().catch(() => setMapError(true));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Placement geometry is updated through the source-sync effect below; rebuilding the map on every drag would interrupt pointer interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aerialAttribution,
    aerialConfigured,
    recommendedAnalysis,
    result,
    visibleMappedLayers,
    onSnapshotReady,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const emptyGeometry = {
      type: "FeatureCollection" as const,
      features: [],
    };
    for (const [sourceId, geometry] of [
      ["placement-shell", placementAssessment?.shell ?? emptyGeometry],
      [
        "placement-construction",
        placementAssessment?.envelopes.constructionAllowance ?? emptyGeometry,
      ],
      [
        "placement-barrier",
        placementAssessment?.envelopes.barrier ?? emptyGeometry,
      ],
      [
        "placement-access",
        placementAssessment?.envelopes.access ?? emptyGeometry,
      ],
    ] as const) {
      const source = map.getSource(sourceId) as
        import("maplibre-gl").GeoJSONSource | undefined;
      source?.setData(geometry);
    }
    if (!placementAssessment) return;
    map.setPaintProperty(
      "placement-shell-fill",
      "fill-color",
      placementAssessment.classification === "hard_conflict"
        ? "#dc2626"
        : placementAssessment.classification === "unknown"
          ? "#d97706"
          : "#0f766e",
    );
  }, [
    placementAssessment,
    placementAssessment?.classification,
    placementAssessment?.envelopes.access,
    placementAssessment?.envelopes.barrier,
    placementAssessment?.envelopes.constructionAllowance,
    placementAssessment?.shell,
  ]);

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
            {recommendedAnalysis?.candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm bg-teal-500 ring-2 ring-yellow-400"
                />
                Recommended-size candidate {candidate.rank}
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
      {result.parcelMatch.status === "mapped_primary_parcel" ? (
        <PlacementControls
          assessment={placementAssessment}
          customLength={customLength}
          customWidth={customWidth}
          dimensions={placementDimensions}
          onCustomLength={setCustomLength}
          onCustomWidth={setCustomWidth}
          onPreset={(value) => {
            setPlacementPreset(value);
            if (value !== "custom") setRotationDegrees(0);
          }}
          onRotate={() => setRotationDegrees((value) => (value + 15) % 360)}
          placementPreset={placementPreset}
          validationMessage={placementValidationMessage}
          onFindBest={runAssistedSearch}
          searchDisabled={
            assistedSearchLoading ||
            !placementDimensions ||
            Boolean(placementValidationMessage)
          }
        />
      ) : (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Placement controls are unavailable until the legal parcel is
          confirmed. No placement recommendation is exposed.
        </div>
      )}
      {result.parcelMatch.status === "mapped_primary_parcel" && (
        <AssistedPlacementResults
          result={assistedSearch}
          onSelectCandidate={selectAssistedCandidate}
        />
      )}
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

function PlacementControls({
  assessment,
  customLength,
  customWidth,
  dimensions,
  onCustomLength,
  onCustomWidth,
  onPreset,
  onRotate,
  placementPreset,
  validationMessage,
  onFindBest,
  searchDisabled,
}: {
  assessment: CustomPoolPlacementAssessment | null;
  customLength: string;
  customWidth: string;
  dimensions: { lengthMetres: number; widthMetres: number } | null;
  onCustomLength: (value: string) => void;
  onCustomWidth: (value: string) => void;
  onPreset: (value: string) => void;
  onRotate: () => void;
  placementPreset: string;
  validationMessage: string | null;
  onFindBest: () => void;
  searchDisabled: boolean;
}) {
  return (
    <div
      className="border-t border-slate-200 bg-white px-5 py-5"
      aria-label="Manual pool placement workspace"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="font-semibold text-slate-950">
            Manual pool placement
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            Drag the selected pool on the map. Rotate it in 15° steps.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Pool size controls"
        >
          {(["compact", "compact-plus", "standard"] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={placementPreset === id}
              onClick={() => onPreset(id)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:border-teal-700 aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
            >
              {id.replaceAll("-", " ")}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={placementPreset === "custom"}
            onClick={() => onPreset("custom")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:border-teal-700 aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
          >
            Custom size
          </button>
          <button
            type="button"
            onClick={onRotate}
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Rotate 15°
          </button>
        </div>
      </div>
      {placementPreset === "custom" && (
        <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-800">
            Length (m)
            <input
              inputMode="decimal"
              type="number"
              min="0.1"
              max="30"
              step="0.1"
              value={customLength}
              onChange={(event) => onCustomLength(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Width (m)
            <input
              inputMode="decimal"
              type="number"
              min="0.1"
              max="30"
              step="0.1"
              value={customWidth}
              onChange={(event) => onCustomWidth(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>
        </div>
      )}
      {validationMessage && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {validationMessage}
        </p>
      )}
      {dimensions && (
        <p className="mt-3 text-sm text-slate-700">
          Selected shell: {dimensions.lengthMetres} m × {dimensions.widthMetres}{" "}
          m. Rotation: {assessment?.rotationDegrees ?? 0}°.
        </p>
      )}
      <button
        type="button"
        onClick={onFindBest}
        disabled={searchDisabled}
        className="mt-4 min-h-11 rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Find best available position
      </button>
      {assessment && <PlacementStatus assessment={assessment} />}
      <div
        className="mt-4 grid gap-2 text-xs text-slate-700 sm:grid-cols-4"
        aria-label="Placement overlay legend"
      >
        <span>
          <i
            className="mr-2 inline-block size-3 rounded-sm bg-teal-700"
            aria-hidden="true"
          />
          Pool shell
        </span>
        <span>
          <i
            className="mr-2 inline-block size-3 rounded-sm bg-amber-600"
            aria-hidden="true"
          />
          Construction allowance
        </span>
        <span>
          <i
            className="mr-2 inline-block size-3 rounded-sm bg-violet-600"
            aria-hidden="true"
          />
          Indicative barrier
        </span>
        <span>
          <i
            className="mr-2 inline-block size-3 rounded-sm bg-blue-600"
            aria-hidden="true"
          />
          Access envelope
        </span>
      </div>
    </div>
  );
}

function PlacementStatus({
  assessment,
}: {
  assessment: CustomPoolPlacementAssessment;
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-live="polite">
      <div
        className={
          assessment.classification === "hard_conflict"
            ? "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950"
            : "rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950"
        }
      >
        <strong>
          {assessment.classification === "hard_conflict"
            ? "Hard GIS conflict"
            : assessment.classification === "unknown"
              ? "Evidence incomplete"
              : "No measured GIS conflict"}
        </strong>
        <ul className="mt-1 list-disc pl-5">
          {assessment.hardConflicts.map((item) => (
            <li key={`${item.type}-${item.evidenceId}`}>{item.message}</li>
          ))}
          {assessment.unknownEvidence.map((item) => (
            <li key={item.evidenceId}>{item.message}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Advisory aerial imagery conflict review</strong>
        <p className="mt-1">
          Aerial imagery is visual guidance only. Continue exploring the
          placement, then verify any apparent surface conflict on site.
        </p>
      </div>
    </div>
  );
}

function geoJsonSource(geometry: Feature | undefined) {
  return {
    type: "geojson" as const,
    data: geometry ?? { type: "FeatureCollection" as const, features: [] },
  };
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
