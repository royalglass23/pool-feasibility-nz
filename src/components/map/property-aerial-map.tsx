"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bearing, point } from "@turf/turf";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { escapeHtml } from "@/shared/html/escape-html";
import {
  assessCustomPoolPlacement,
  type CustomPoolPlacementEvidence,
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

export type PropertyPoolPlacement = {
  lengthMetres: number;
  widthMetres: number;
  rotationDegrees: number;
  position: readonly [number, number];
  shellGeometry: Geometry;
  constructionEnvelopeGeometry: Geometry;
  classification: CustomPoolPlacementAssessment["classification"];
};

const mapLayerDefinitions: MapLayerDefinition[] = [
  { key: "public_stormwater_assets", color: "#0369a1", kind: "line" },
  { key: "manholes", color: "#0369a1", kind: "circle" },
  { key: "catchpits", color: "#0369a1", kind: "circle" },
  { key: "watercourses", color: "#0369a1", kind: "line" },
  { key: "wastewater_assets", color: "#7c3aed", kind: "line" },
  { key: "wastewater_manholes", color: "#7c3aed", kind: "circle" },
  { key: "wastewater_fittings", color: "#7c3aed", kind: "circle" },
  { key: "public_water_assets", color: "#0f766e", kind: "line" },
  { key: "water_fittings", color: "#0f766e", kind: "circle" },
  { key: "electricity_feeder_lines", color: "#ca8a04", kind: "line" },
  { key: "gas_distribution_lines", color: "#dc2626", kind: "line" },
];

export function PropertyAerialMap({
  result,
  onRetry,
  onSnapshotReady,
  onPlacementChange,
}: {
  result: DataAccessSpikeResult;
  onRetry: () => void;
  onSnapshotReady?: (dataUrl: string | null) => void;
  onPlacementChange?: (placement: PropertyPoolPlacement | null) => void;
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
  const availableMappedLayers = useMemo(
    () =>
      mappedLayers.filter(
        ({ evidence }) =>
          evidence.status === "success" &&
          Boolean(evidence.geometry),
      ),
    [mappedLayers],
  );
  const visibleMappedLayers = useMemo(
    () =>
      availableMappedLayers.filter(
        ({ definition }) =>
          (layerVisibility[definition.key] ?? true),
      ),
    [availableMappedLayers, layerVisibility],
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
            result.parcelMatch.status === "mapped_primary_parcel" &&
            result.identityCheck.distinctFromAlternatives
              ? "confirmed"
              : "unconfirmed",
          position,
          rotationDegrees,
          lengthMetres: placementDimensions.lengthMetres,
          widthMetres: placementDimensions.widthMetres,
          parcelEvidence: legalParcelEvidenceForMap(result),
          buildings: spatialEvidenceForMap("building_footprints", result),
          services: combinedSpatialEvidenceForMap(
            [
              "public_stormwater_assets",
              "wastewater_assets",
              "public_water_assets",
              "electricity_feeder_lines",
              "gas_distribution_lines",
            ],
            result,
            "mapped_services",
            "mapped services",
          ),
          manholes: combinedSpatialEvidenceForMap(
            ["manholes", "wastewater_manholes"],
            result,
            "manholes",
            "manholes",
          ),
          catchpits: combinedSpatialEvidenceForMap(
            ["catchpits"],
            result,
            "catchpits",
            "catchpits",
          ),
          constraints: placementConstraintsForMap(result),
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
  useEffect(() => {
    onPlacementChange?.(
      placementAssessment
        ? {
            lengthMetres: placementAssessment.dimensions.lengthMetres,
            widthMetres: placementAssessment.dimensions.widthMetres,
            rotationDegrees: placementAssessment.rotationDegrees,
            position: placementAssessment.position,
            shellGeometry: placementAssessment.shell.geometry,
            constructionEnvelopeGeometry:
              placementAssessment.envelopes.constructionAllowance.geometry,
            classification: placementAssessment.classification,
          }
        : null,
    );
  }, [onPlacementChange, placementAssessment]);
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
      const updatePosition = (nextPosition: [number, number]) => {
        if (!isConfirmedParcelForPlacement(result)) return;
        setPosition(nextPosition);
      };
      const updateRotation = (nextRotation: number) => {
        if (!isConfirmedParcelForPlacement(result)) return;
        const wholeRotation = Math.round(nextRotation) % 360;
        setRotationDegrees(wholeRotation);
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
        updatePosition(activeMap.unproject(event.point).toArray());
      });
      activeMap.on("mousemove", (event) => {
        if (interaction === "move") {
          updatePosition(activeMap.unproject(event.point).toArray());
        } else if (interaction === "rotate") {
          const currentAssessment = placementAssessmentRef.current;
          if (!currentAssessment) return;
          const cursor = activeMap.unproject(event.point).toArray();
          const nextRotation =
            (180 -
              bearing(point([...currentAssessment.position]), point(cursor)) +
              360) %
            360;
          updateRotation((nextRotation + 360) % 360);
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
      map.fitBounds(bounds, { padding: 72, maxZoom: 17, duration: 0 });
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
      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-[0_1px_2px_0_rgb(0_0_0/5%)]"
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
      <div className="grid border-b border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div
          ref={containerRef}
          className="h-[min(62vw,600px)] min-h-[420px] w-full bg-slate-800"
          aria-label="Interactive property map showing the confirmed parcel, pool concept, and mapped utility evidence"
        />
        <aside
          aria-label="Map legend"
          className="border-t border-slate-200 p-5 lg:border-t-0 lg:border-l"
        >
          <h4 className="font-semibold text-slate-950">Utility legend</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Returned services only. Building outlines, contours, and planning
            layers are kept out of this view.
          </p>
          {availableMappedLayers.length ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {availableMappedLayers.map(({ definition, evidence }) => (
                <li key={definition.key}>
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      aria-label={evidence.dataset}
                      checked={layerVisibility[definition.key] ?? true}
                      onChange={(event) =>
                        setLayerVisibility((current) => ({
                          ...current,
                          [definition.key]: event.target.checked,
                        }))
                      }
                      className="mt-1 size-4 shrink-0 accent-teal-700"
                    />
                    <span
                      aria-hidden="true"
                      className={
                        definition.kind === "circle"
                          ? "mt-1 size-3 shrink-0 rounded-full"
                          : "mt-2 h-0.5 w-4 shrink-0 rounded-full"
                      }
                      style={{ backgroundColor: definition.color }}
                    />
                    <span>
                      <span className="block font-medium text-slate-900">
                        {evidence.dataset}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {evidence.featureCount ?? 0} mapped
                      </span>
                      {evidence.evidenceUse === "internal_reference" && (
                        <span className="block text-xs font-semibold text-amber-700">
                          Internal reference only
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              No mapped utility geometry was returned for this property.
            </p>
          )}
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
        </aside>
      </div>
      {isConfirmedParcelForPlacement(result) ? (
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

function isConfirmedParcelForPlacement(result: DataAccessSpikeResult): boolean {
  return (
    result.parcelMatch.status === "mapped_primary_parcel" &&
    result.identityCheck.distinctFromAlternatives
  );
}

function placementConstraintsForMap(result: DataAccessSpikeResult) {
  return [
    "planning_overlays",
    "flood_plains",
    "flood_prone_areas",
    "overland_flow_paths",
  ].map((key) => spatialEvidenceForMap(key, result));
}

function combinedSpatialEvidenceForMap(
  keys: string[],
  result: DataAccessSpikeResult,
  id: string,
  label: string,
): CustomPoolPlacementEvidence[] {
  const datasets = keys.map((key) => result.datasets[key as DatasetKey]);
  const available = datasets.filter(
    (item) =>
      item.status === "success" &&
      item.geometry &&
      item.geometry.features.length > 0,
  );
  const unavailable = datasets.some(
    (item) => item.status !== "success" || !item.geometry,
  );
  const evidence: CustomPoolPlacementEvidence[] = [];
  if (available.length > 0) {
    evidence.push({
      id,
      label,
      status: "available",
      geometry: {
        type: "FeatureCollection",
        features: available.flatMap((item) => item.geometry?.features ?? []),
      } satisfies FeatureCollection<Geometry>,
    });
  }
  if (available.length === 0 || unavailable) {
    evidence.push({ id, label, status: "unavailable" });
  }
  return evidence;
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
      className="border-t border-slate-200 bg-white px-5 py-6"
      aria-label="Manual pool placement workspace"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-slate-950">
            Manual pool placement
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            Choose a pool size, then drag the blue pool within the parcel. Drag
            the handle above it to rotate the layout.
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
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold transition-colors hover:border-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
            >
              {formatPlacementPresetLabel(id)}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={placementPreset === "custom"}
            onClick={() => onPreset("custom")}
            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold transition-colors hover:border-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
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
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 focus:border-teal-700 focus:bg-white focus:outline-2 focus:outline-teal-700"
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
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 focus:border-teal-700 focus:bg-white focus:outline-2 focus:outline-teal-700"
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
    <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite">
      <div
        className={
          assessment.classification === "hard_conflict"
            ? "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950"
            : assessment.classification === "unknown"
              ? "rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
              : "rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950"
        }
      >
        <strong className="text-base">
          {assessment.classification === "hard_conflict"
            ? "Hard GIS conflict"
            : assessment.classification === "unknown"
              ? "Evidence incomplete"
              : "No measured GIS conflict"}
        </strong>
        <ul className="mt-1 list-disc pl-5">
          {assessment.hardConflicts.map((item) => (
            <li key={`${item.type}-${item.evidenceId}`}>
              {item.customerMessage} ({item.technicalLabel})
            </li>
          ))}
          {assessment.unknownEvidence.map((item) => (
            <li key={item.evidenceId}>
              {item.customerMessage} ({item.technicalLabel})
            </li>
          ))}
        </ul>
        {assessment.confidence < 80 && (
          <p className="mt-3 font-semibold">
            Preliminary result — review required
          </p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
        <strong className="text-base">Measurements from mapped evidence</strong>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Distances are indicative and only available where a reliable layer was
          returned.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Distance
            label="Parcel boundary"
            value={assessment.distances.parcelBoundaryMetres}
          />
          <Distance
            label="Buildings"
            value={assessment.distances.buildingsMetres}
          />
          <Distance
            label="Mapped services"
            value={assessment.distances.mappedServicesMetres}
          />
          <Distance
            label="Manholes"
            value={assessment.distances.manholesMetres}
          />
          <Distance
            label="Catchpits"
            value={assessment.distances.catchpitsMetres}
          />
        </dl>
        <p className="mt-3 font-semibold">
          Confidence: {assessment.confidence}% — {assessment.confidenceLabel}
        </p>
        <p className="mt-1">Next action: {assessment.nextAction}</p>
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

function Distance({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">
        {value === null ? "Not mapped" : `${value.toFixed(1)} m`}
      </dd>
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
