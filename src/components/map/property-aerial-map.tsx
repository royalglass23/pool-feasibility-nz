"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bearing, booleanWithin, feature, point } from "@turf/turf";
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
} from "./map-evidence";

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
  const placementAssessmentRef = useRef<CustomPoolPlacementAssessment | null>(
    null,
  );
  useEffect(() => {
    placementAssessmentRef.current = placementAssessment;
  }, [placementAssessment]);
  const placementValidationMessage =
    placementPreset === "custom" && !placementAssessment
      ? "Enter length and width between 0.1 m and 30 m before assessing the placement."
      : null;
  const captureReportSnapshot = useCallback(
    (waitForIdle = false) => {
      const map = mapRef.current;
      if (!map) return;
      const capture = () => {
        if (mapRef.current !== map) return;
        try {
          onSnapshotReady?.(map.getCanvas().toDataURL("image/png"));
        } catch {
          onSnapshotReady?.(null);
        }
      };
      if (waitForIdle) map.once("idle", capture);
      else capture();
    },
    [onSnapshotReady],
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
    let captureAfterMove: (() => void) | undefined;

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
        "placement-access": geoJsonSource(
          placementAssessment?.envelopes.access,
        ),
        "placement-rotation-handle": {
          type: "geojson",
          data: rotationHandleGeometry(placementAssessment),
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
      if (placementAssessment) {
        layers.push(
          {
            id: "placement-access-line",
            type: "line",
            source: "placement-access",
            paint: {
              "line-color": "#0891b2",
              "line-width": 3,
              "line-dasharray": [1, 2],
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
            paint: { "fill-color": "#2563eb", "fill-opacity": 0.72 },
          },
          {
            id: "placement-shell-outline",
            type: "line",
            source: "placement-shell",
            paint: { "line-color": "#0f172a", "line-width": 3 },
          },
          {
            id: "placement-rotation-guide",
            type: "line",
            source: "placement-rotation-handle",
            filter: ["==", ["get", "kind"], "guide"],
            paint: { "line-color": "#2563eb", "line-width": 2 },
          },
          {
            id: "placement-rotation-handle",
            type: "circle",
            source: "placement-rotation-handle",
            filter: ["==", ["get", "kind"], "handle"],
            paint: {
              "circle-color": "#2563eb",
              "circle-radius": 7,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
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

      let interaction: "move" | "rotate" | null = null;
      const updatePositionIfInsideParcel = (nextPosition: [number, number]) => {
        const currentAssessment = placementAssessmentRef.current;
        if (!currentAssessment) return;

        const candidate = assessCustomPoolPlacement({
          parcel: result.parcel.geometry,
          parcelStatus: "confirmed",
          position: nextPosition,
          rotationDegrees: currentAssessment.rotationDegrees,
          lengthMetres: currentAssessment.dimensions.lengthMetres,
          widthMetres: currentAssessment.dimensions.widthMetres,
          parcelEvidence: legalParcelEvidenceForMap(result),
          buildings: spatialEvidenceForMap("building_footprints", result),
          constraints: [],
        });
        if (
          !booleanWithin(
            candidate.envelopes.constructionAllowance,
            feature(result.parcel.geometry),
          )
        ) {
          return;
        }
        setPosition(nextPosition);
      };
      const updateRotationIfInsideParcel = (nextRotation: number) => {
        const currentAssessment = placementAssessmentRef.current;
        if (!currentAssessment) return;
        const wholeRotation = Math.round(nextRotation) % 360;

        const candidate = assessCustomPoolPlacement({
          parcel: result.parcel.geometry,
          parcelStatus: "confirmed",
          position: currentAssessment.position,
          rotationDegrees: wholeRotation,
          lengthMetres: currentAssessment.dimensions.lengthMetres,
          widthMetres: currentAssessment.dimensions.widthMetres,
          parcelEvidence: legalParcelEvidenceForMap(result),
          buildings: spatialEvidenceForMap("building_footprints", result),
          constraints: [],
        });
        if (
          booleanWithin(
            candidate.envelopes.constructionAllowance,
            feature(result.parcel.geometry),
          )
        ) {
          setRotationDegrees(wholeRotation);
        }
      };
      activeMap.on("mousedown", "placement-rotation-handle", (event) => {
        interaction = "rotate";
        activeMap.getCanvas().style.cursor = "crosshair";
        activeMap.dragPan.disable();
        event.originalEvent.stopPropagation();
      });
      activeMap.on("mousedown", "placement-shell-fill", (event) => {
        interaction = "move";
        activeMap.getCanvas().style.cursor = "grabbing";
        activeMap.dragPan.disable();
        updatePositionIfInsideParcel(
          activeMap.unproject(event.point).toArray(),
        );
      });
      activeMap.on("mousemove", (event) => {
        if (interaction === "move") {
          updatePositionIfInsideParcel(
            activeMap.unproject(event.point).toArray(),
          );
        } else if (interaction === "rotate") {
          const currentAssessment = placementAssessmentRef.current;
          if (!currentAssessment) return;
          const cursor = activeMap.unproject(event.point).toArray();
          const nextRotation =
            (180 -
              bearing(point([...currentAssessment.position]), point(cursor)) +
              360) %
            360;
          updateRotationIfInsideParcel((nextRotation + 360) % 360);
        }
      });
      activeMap.on("mouseup", () => {
        interaction = null;
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
      captureAfterMove = () => captureReportSnapshot(true);
      map.on("moveend", captureAfterMove);
      map.once("idle", () => {
        if (!cancelled) {
          setTilesLoaded(true);
          captureReportSnapshot();
        }
      });
    }

    void loadMap().catch(() => setMapError(true));
    return () => {
      cancelled = true;
      if (captureAfterMove) map?.off("moveend", captureAfterMove);
      map?.remove();
      mapRef.current = null;
    };
    // Placement geometry is updated through the source-sync effect below; rebuilding the map on every drag would interrupt pointer interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aerialAttribution,
    aerialConfigured,
    result,
    visibleMappedLayers,
    captureReportSnapshot,
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
        "placement-access",
        placementAssessment?.envelopes.access ?? emptyGeometry,
      ],
      [
        "placement-rotation-handle",
        rotationHandleGeometry(placementAssessment),
      ],
    ] as const) {
      const source = map.getSource(sourceId) as
        import("maplibre-gl").GeoJSONSource | undefined;
      source?.setData(geometry);
    }
    if (!placementAssessment) return;
    map.setPaintProperty("placement-shell-fill", "fill-color", "#2563eb");

    captureReportSnapshot(true);
  }, [
    captureReportSnapshot,
    placementAssessment,
    placementAssessment?.classification,
    placementAssessment?.envelopes.access,
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
      <div ref={containerRef} className="h-[600px] w-full bg-slate-800" />
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
          placementPreset={placementPreset}
          validationMessage={placementValidationMessage}
        />
      ) : (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Placement controls are unavailable until the legal parcel is
          confirmed. No placement recommendation is exposed.
        </div>
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
  placementPreset,
  validationMessage,
}: {
  assessment: CustomPoolPlacementAssessment | null;
  customLength: string;
  customWidth: string;
  dimensions: { lengthMetres: number; widthMetres: number } | null;
  onCustomLength: (value: string) => void;
  onCustomWidth: (value: string) => void;
  onPreset: (value: string) => void;
  placementPreset: string;
  validationMessage: string | null;
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
            <span className="font-semibold text-slate-800">How to use:</span>{" "}
            drag the pool within the parcel, or drag the blue handle to rotate
            it with the mouse.
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
              {formatPlacementPresetLabel(id)}
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
          m.
        </p>
      )}
      {assessment && <PlacementStatus assessment={assessment} />}
      <div
        className="mt-4 grid gap-2 text-xs text-slate-700 sm:grid-cols-3"
        aria-label="Placement overlay legend"
      >
        <span>
          <i
            className="mr-2 inline-block size-3 rounded-sm bg-blue-600"
            aria-hidden="true"
          />
          Pool shell (blue)
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
            className="mr-2 inline-block size-3 rounded-sm bg-cyan-600"
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

function rotationHandleGeometry(
  assessment: CustomPoolPlacementAssessment | null,
): FeatureCollection {
  if (!assessment) return { type: "FeatureCollection", features: [] };

  const [first, second] = assessment.shell.geometry.coordinates[0];
  const handle: [number, number] = [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
  ];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "guide" },
        geometry: {
          type: "LineString",
          coordinates: [[...assessment.position], handle],
        },
      },
      {
        type: "Feature",
        properties: { kind: "handle" },
        geometry: { type: "Point", coordinates: handle },
      },
    ],
  };
}

function formatPlacementPresetLabel(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
