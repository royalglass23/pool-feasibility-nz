"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";
import { type FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { DetailedLayerResult } from "@/modules/data-access-spike/execute-fast-property-details";
import {
  buildFastPoolGeometry,
  FAST_POOL_CATALOGUE,
  findFastPoolDefaultPosition,
  isFastPoolWithinMappedArea,
  type FastPoolId,
  validateFastCustomDimensions,
} from "@/modules/data-access-spike/fast-pool-placement";
import {
  classifyFastPoolWarning,
  type FastPoolPlacementSnapshot,
  type FastPoolWarning,
} from "@/modules/data-access-spike/fast-pool-warning";
import type { DatasetKey } from "@/modules/data-access-spike/dataset-catalog";
import { bearing, point } from "@turf/turf";

type UtilityCategory =
  "stormwater" | "wastewater" | "water" | "electricity" | "gas";

type UtilityLayerDefinition = {
  key: DatasetKey;
  category: UtilityCategory;
  color: string;
  kind: "line" | "circle";
};

const contourLayer = {
  key: "contours",
  color: "#475569",
  kind: "line",
} as const;

const utilityCategories: {
  id: UtilityCategory;
  label: string;
  color: string;
}[] = [
  { id: "stormwater", label: "Stormwater", color: "#0369a1" },
  { id: "wastewater", label: "Wastewater", color: "#7c3aed" },
  { id: "water", label: "Water", color: "#0f766e" },
  { id: "electricity", label: "Electricity", color: "#ca8a04" },
  { id: "gas", label: "Gas", color: "#dc2626" },
];

const utilityLayerDefinitions: UtilityLayerDefinition[] = [
  {
    key: "public_stormwater_assets",
    category: "stormwater",
    color: "#0369a1",
    kind: "line",
  },
  { key: "manholes", category: "stormwater", color: "#0369a1", kind: "circle" },
  {
    key: "catchpits",
    category: "stormwater",
    color: "#0369a1",
    kind: "circle",
  },
  {
    key: "watercourses",
    category: "stormwater",
    color: "#0369a1",
    kind: "line",
  },
  {
    key: "wastewater_assets",
    category: "wastewater",
    color: "#7c3aed",
    kind: "line",
  },
  {
    key: "wastewater_manholes",
    category: "wastewater",
    color: "#7c3aed",
    kind: "circle",
  },
  {
    key: "wastewater_fittings",
    category: "wastewater",
    color: "#7c3aed",
    kind: "circle",
  },
  {
    key: "public_water_assets",
    category: "water",
    color: "#0f766e",
    kind: "line",
  },
  {
    key: "water_fittings",
    category: "water",
    color: "#0f766e",
    kind: "circle",
  },
  {
    key: "electricity_feeder_lines",
    category: "electricity",
    color: "#ca8a04",
    kind: "line",
  },
  {
    key: "gas_distribution_lines",
    category: "gas",
    color: "#dc2626",
    kind: "line",
  },
];

const allUtilityCategoriesVisible: Record<UtilityCategory, boolean> = {
  stormwater: true,
  wastewater: true,
  water: true,
  electricity: true,
  gas: true,
};

export function FastPropertyView({
  result,
  onLoadDetailed,
  onRetry,
  isLoadingDetailed,
  onPlacementChange,
}: {
  result: FastPropertyViewResult;
  onLoadDetailed: () => void;
  onRetry: () => void;
  isLoadingDetailed: boolean;
  onPlacementChange?: (snapshot: FastPoolPlacementSnapshot) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null);
  const placementRef = useRef<{
    position: [number, number];
    rotationDegrees: number;
    dimensions: { lengthMetres: number; widthMetres: number } | null;
  } | null>(null);
  const positionHandlerRef = useRef<(candidate: [number, number]) => void>(
    () => undefined,
  );
  const rotationHandlerRef = useRef<(candidate: number) => void>(
    () => undefined,
  );
  const [mapError, setMapError] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<FastPoolId>("compact");
  const [customLength, setCustomLength] = useState("6.5");
  const [customWidth, setCustomWidth] = useState("3");
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [utilityVisibility, setUtilityVisibility] = useState(
    allUtilityCategoriesVisible,
  );
  const [contoursVisible, setContoursVisible] = useState(true);
  const [position, setPosition] = useState<[number, number]>(() =>
    defaultPosition(result),
  );
  const [placementMessage, setPlacementMessage] = useState<string | null>(null);
  const dimensions = useMemo(() => {
    const preset = FAST_POOL_CATALOGUE.find(
      (pool) => pool.id === selectedPoolId,
    );
    if (!preset) return null;
    if (selectedPoolId !== "custom") return preset;
    return validateFastCustomDimensions(
      Number(customLength),
      Number(customWidth),
    );
  }, [customLength, customWidth, selectedPoolId]);
  const poolGeometry = useMemo(
    () =>
      dimensions &&
      (!result.boundary.geometry ||
        isFastPoolWithinMappedArea(
          position,
          dimensions,
          rotationDegrees,
          result.boundary.geometry,
        ))
        ? buildFastPoolGeometry(
            position,
            dimensions.lengthMetres,
            dimensions.widthMetres,
            rotationDegrees,
          )
        : null,
    [dimensions, position, result.boundary.geometry, rotationDegrees],
  );
  const poolWarning = useMemo(
    () =>
      classifyFastPoolWarning({
        boundaryState: result.boundary.state,
        pool: poolGeometry,
        detailedChecks: result.detailedChecks,
      }),
    [poolGeometry, result.boundary.state, result.detailedChecks],
  );
  const mappedUtilityLayers = useMemo(
    () =>
      (result.detailedChecks?.layers ?? []).flatMap((layer) => {
        const definition = utilityLayerDefinitions.find(
          (candidate) => candidate.key === layer.key,
        );
        return definition && layer.geometry?.features.length
          ? [{ definition, layer }]
          : [];
      }),
    [result.detailedChecks],
  );
  const mappedContours = useMemo(
    () =>
      (result.detailedChecks?.layers ?? []).find(
        (layer) =>
          layer.key === contourLayer.key &&
          Boolean(layer.geometry?.features.length),
      ) ?? null,
    [result.detailedChecks],
  );
  const contourResult = useMemo(
    () =>
      (result.detailedChecks?.layers ?? []).find(
        (layer) => layer.key === contourLayer.key,
      ) ?? null,
    [result.detailedChecks],
  );
  function toggleUtilityCategory(category: UtilityCategory) {
    setUtilityVisibility((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }

  useEffect(() => {
    onPlacementChange?.({
      position,
      rotationDegrees,
      dimensions,
      poolGeometry: poolGeometry ?? null,
      warning: poolWarning,
    });
  }, [
    dimensions,
    onPlacementChange,
    poolGeometry,
    poolWarning,
    position,
    rotationDegrees,
  ]);

  useEffect(() => {
    placementRef.current = { position, rotationDegrees, dimensions };
  }, [dimensions, position, rotationDegrees]);

  const setCandidatePosition = (candidate: [number, number]) => {
    if (
      dimensions &&
      result.boundary.geometry &&
      !isFastPoolWithinMappedArea(
        candidate,
        dimensions,
        rotationDegrees,
        result.boundary.geometry,
      )
    ) {
      setPlacementMessage(
        "The construction envelope must remain inside the mapped property area.",
      );
      return;
    }
    setPlacementMessage(null);
    setPosition(candidate);
  };

  const setCandidateRotation = (candidate: number) => {
    const normalized = ((candidate % 360) + 360) % 360;
    if (
      dimensions &&
      result.boundary.geometry &&
      !isFastPoolWithinMappedArea(
        position,
        dimensions,
        normalized,
        result.boundary.geometry,
      )
    ) {
      setPlacementMessage(
        "That rotation would move the construction envelope outside the mapped property area.",
      );
      return;
    }
    setPlacementMessage(null);
    setRotationDegrees(normalized);
  };

  useEffect(() => {
    positionHandlerRef.current = setCandidatePosition;
    rotationHandlerRef.current = setCandidateRotation;
  });

  const choosePool = (poolId: FastPoolId) => {
    setSelectedPoolId(poolId);
    const pool = FAST_POOL_CATALOGUE.find((item) => item.id === poolId)!;
    const nextDimensions =
      poolId === "custom"
        ? validateFastCustomDimensions(
            Number(customLength),
            Number(customWidth),
          )
        : pool;
    const nextPosition =
      nextDimensions && result.boundary.geometry
        ? findFastPoolDefaultPosition(
            result.boundary.geometry,
            nextDimensions,
            0,
          )
        : null;
    setRotationDegrees(0);
    if (nextPosition) setPosition(nextPosition as [number, number]);
    setPlacementMessage(
      nextPosition || !result.boundary.geometry
        ? null
        : "This size does not fit inside the available mapped area.",
    );
  };

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let disposed = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !mapRef.current) return;
      const boundary = result.boundary.geometry
        ? feature(result.boundary.geometry)
        : null;
      const activePlacement = placementRef.current;
      const pool = poolGeometry ?? {
        type: "FeatureCollection" as const,
        features: [],
      };
      const sources: Record<string, import("maplibre-gl").SourceSpecification> =
        {
          address: {
            type: "geojson",
            data: pointFeature(result.resolvedAddress.coordinates),
          },
          pool: { type: "geojson", data: pool },
          "pool-rotation": {
            type: "geojson",
            data: rotationHandleGeometry(
              activePlacement?.position ?? result.resolvedAddress.coordinates,
              activePlacement?.rotationDegrees ?? 0,
              dimensions,
            ),
          },
          ...(boundary
            ? { boundary: { type: "geojson", data: boundary } }
            : {}),
        };
      for (const { definition, layer } of mappedUtilityLayers) {
        sources[`utility-${definition.key}`] = {
          type: "geojson",
          data: layer.geometry!,
        };
      }
      if (mappedContours?.geometry) {
        sources.contours = {
          type: "geojson",
          data: mappedContours.geometry,
        };
      }
      const layers: import("maplibre-gl").LayerSpecification[] = [];
      if (result.aerial.state === "ready") {
        sources.aerial = {
          type: "raster",
          tiles: ["/api/public/aerial/tiles/{z}/{x}/{y}"],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 22,
        };
        layers.push({ id: "aerial", type: "raster", source: "aerial" });
      }
      if (boundary) {
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
      }
      if (mappedContours?.geometry) {
        layers.push({
          id: "contours",
          type: "line",
          source: "contours",
          paint: {
            "line-color": contourLayer.color,
            "line-width": 1.5,
            "line-dasharray": [2, 1.5],
          },
        });
      }
      for (const { definition } of mappedUtilityLayers) {
        const source = `utility-${definition.key}`;
        layers.push(
          definition.kind === "line"
            ? {
                id: source,
                type: "line",
                source,
                paint: { "line-color": definition.color, "line-width": 3 },
              }
            : {
                id: source,
                type: "circle",
                source,
                paint: {
                  "circle-color": definition.color,
                  "circle-radius": 5,
                  "circle-stroke-color": "#fff",
                  "circle-stroke-width": 1.5,
                },
              },
        );
      }
      layers.push(
        {
          id: "pool-fill",
          type: "fill",
          source: "pool",
          paint: { "fill-color": "#2563eb", "fill-opacity": 0.72 },
        },
        {
          id: "pool-line",
          type: "line",
          source: "pool",
          paint: { "line-color": "#0f172a", "line-width": 3 },
        },
        {
          id: "pool-rotation-guide",
          type: "line",
          source: "pool-rotation",
          paint: { "line-color": "#f97316", "line-width": 2 },
        },
        {
          id: "pool-rotation-handle",
          type: "circle",
          source: "pool-rotation",
          filter: ["==", ["get", "kind"], "handle"],
          paint: {
            "circle-color": "#f97316",
            "circle-radius": 8,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          },
        },
        {
          id: "address",
          type: "circle",
          source: "address",
          paint: {
            "circle-color": "#f97316",
            "circle-radius": 7,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          },
        },
      );
      try {
        map = new maplibregl.Map({
          container: mapRef.current,
          style: { version: 8, sources, layers },
          center: result.resolvedAddress.coordinates,
          zoom: 15,
          attributionControl: { compact: true },
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        mapInstanceRef.current = map;
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        if (result.boundary.geometry) {
          map.fitBounds(boundaryBounds(result.boundary.geometry), {
            padding: 56,
            duration: 0,
            maxZoom: 20,
          });
        }
        map.on("error", () => setMapError(true));
        let interaction: "move" | "rotate" | null = null;
        map.on("mousedown", "pool-rotation-handle", (event) => {
          interaction = "rotate";
          map?.dragPan.disable();
          map?.getCanvas().style.setProperty("cursor", "crosshair");
          event.originalEvent.stopPropagation();
        });
        map.on("mousedown", "pool-fill", (event) => {
          interaction = "move";
          map?.dragPan.disable();
          map?.getCanvas().style.setProperty("cursor", "grabbing");
          event.originalEvent.stopPropagation();
          positionHandlerRef.current(
            map!.unproject(event.point).toArray() as [number, number],
          );
        });
        map.on("mousemove", (event) => {
          if (interaction === "move") {
            positionHandlerRef.current(
              map!.unproject(event.point).toArray() as [number, number],
            );
          } else if (interaction === "rotate") {
            const active = placementRef.current;
            if (!active) return;
            const cursor = map!.unproject(event.point).toArray();
            rotationHandlerRef.current(
              180 - bearing(point(active.position), point(cursor)),
            );
          }
        });
        map.on("mouseup", () => {
          interaction = null;
          map?.dragPan.enable();
          map?.getCanvas().style.setProperty("cursor", "");
        });
      } catch {
        setMapError(true);
      }
    });
    return () => {
      disposed = true;
      map?.remove();
      mapInstanceRef.current = null;
    };
    // MapLibre is initialized once per resolved property. Placement geometry is
    // updated through GeoJSON source sync so pointer interaction is not rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedContours, mappedUtilityLayers, result]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (map.getLayer("contours")) {
      map.setLayoutProperty(
        "contours",
        "visibility",
        contoursVisible ? "visible" : "none",
      );
    }
    for (const { definition } of mappedUtilityLayers) {
      const layerId = `utility-${definition.key}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          "visibility",
          utilityVisibility[definition.category] ? "visible" : "none",
        );
      }
    }
  }, [contoursVisible, mappedUtilityLayers, utilityVisibility]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const emptyGeometry = {
      type: "FeatureCollection" as const,
      features: [],
    };
    const poolSource = map.getSource("pool") as
      import("maplibre-gl").GeoJSONSource | undefined;
    poolSource?.setData(poolGeometry ?? emptyGeometry);
    const rotationSource = map.getSource("pool-rotation") as
      import("maplibre-gl").GeoJSONSource | undefined;
    rotationSource?.setData(
      poolGeometry
        ? rotationHandleGeometry(position, rotationDegrees, dimensions)
        : emptyGeometry,
    );
  }, [dimensions, poolGeometry, position, rotationDegrees]);

  return (
    <section
      aria-labelledby="fast-view-heading"
      className="space-y-5 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-teal-700 uppercase">
            Fast property view
          </p>
          <h2
            id="fast-view-heading"
            className="mt-2 text-2xl font-semibold text-slate-950"
          >
            {result.resolvedAddress.fullAddress}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            A preliminary mapped view is ready. 
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadDetailed}
          disabled={isLoadingDetailed}
          className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {isLoadingDetailed
            ? "Loading detailed checks…"
            : "Load detailed official checks"}
        </button>
      </div>
      <ol
        aria-label="Fast view progress"
        className="grid gap-2 text-sm sm:max-w-xs"
      >
        <Progress label="Address found" state="complete" />
      </ol>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div
            ref={mapRef}
            className="h-[min(62vw,600px)] min-h-[360px] w-full bg-slate-800"
            aria-label={`Fast aerial map for ${result.resolvedAddress.fullAddress}`}
          />
          <aside
            aria-label="Map layers"
            className="border-t border-slate-200 bg-white p-4 lg:border-t-0 lg:border-l"
          >
            <h3 className="font-semibold text-slate-950">Map layers</h3>
            
            {result.detailedChecks ? (
              <>
                <div className="mt-4 border-b border-slate-200 pb-4 text-sm text-slate-700">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="Contours"
                      checked={Boolean(mappedContours) && contoursVisible}
                      onChange={() => setContoursVisible((current) => !current)}
                      disabled={!mappedContours}
                      className="size-4 accent-slate-950"
                    />
                    <span
                      aria-hidden="true"
                      className="h-0 w-5 border-t-2 border-dashed"
                      style={{ borderColor: contourLayer.color }}
                    />
                    <span className="font-semibold">Contours</span>
                  </label>
                  <p className="mt-1 ml-11 text-xs text-slate-500">
                    {mappedContours
                      ? "Terrain contours (2016, indicative only)"
                      : contourResult
                        ? "No contour geometry returned"
                        : "Contour data was not checked"}
                  </p>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-slate-700">
                  {utilityCategories.map((category) => {
                  const hasGeometry = mappedUtilityLayers.some(
                    ({ definition }) => definition.category === category.id,
                  );
                  return (
                    <li key={category.id}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            hasGeometry && utilityVisibility[category.id]
                          }
                          onChange={() => toggleUtilityCategory(category.id)}
                          disabled={!hasGeometry}
                          className="size-4 accent-slate-950"
                        />
                        <span
                          aria-hidden="true"
                          className="h-1 w-5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-semibold">{category.label}</span>
                      </label>
                      <p className="mt-1 ml-11 text-xs text-slate-500">
                        {hasGeometry
                          ? "Mapped evidence returned"
                          : "No mapped evidence returned"}
                      </p>
                    </li>
                  );
                  })}
                </ul>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Load detailed official checks to see contours and mapped utility evidence.
              </p>
            )}
            
          </aside>
        </div>
        <div className="flex justify-end bg-white px-4 py-3 text-sm">
          <p className="text-slate-600">
            Default pool: {result.defaultPool.label} (
            {result.defaultPool.lengthMetres} × {result.defaultPool.widthMetres}{" "}
            m)
          </p>
        </div>
      </div>
      <div
        aria-label="Pool catalogue and placement controls"
        className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
      >
        <div>
          <h3 className="font-semibold text-slate-950">Choose a pool layout</h3>
          <p className="mt-1 text-sm text-slate-600">
            Drag the pool or rotate it with the orange handle. The indicative
            construction envelope is constrained to the mapped area.
          </p>
        </div>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="group"
          aria-label="Pool catalogue"
        >
          {FAST_POOL_CATALOGUE.map((pool) => (
            <button
              key={pool.id}
              type="button"
              aria-pressed={selectedPoolId === pool.id}
              onClick={() => choosePool(pool.id)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
            >
              {pool.label} ({pool.lengthMetres} × {pool.widthMetres} m)
            </button>
          ))}
        </div>
        {selectedPoolId === "custom" && (
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <DimensionInput
              label="Custom length (m)"
              value={customLength}
              min={2}
              max={20}
              onChange={setCustomLength}
              invalid={
                !validateFastCustomDimensions(
                  Number(customLength),
                  Number(customWidth),
                )
              }
            />
            <DimensionInput
              label="Custom width (m)"
              value={customWidth}
              min={1.5}
              max={10}
              onChange={setCustomWidth}
              invalid={
                !validateFastCustomDimensions(
                  Number(customLength),
                  Number(customWidth),
                )
              }
            />
          </div>
        )}
        {!dimensions && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            Enter a length from 2–20 m and width from 1.5–10 m in 0.1 m
            increments.
          </p>
        )}
        {placementMessage && (
          <p role="alert" className="text-sm font-semibold text-amber-800">
            {placementMessage}
          </p>
        )}
      </div>
      <FastPoolWarning warning={poolWarning} />
      {mapError && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          The map could not load. Retry the fast view to try again.
        </p>
      )}
      {result.aerial.state !== "ready" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Aerial imagery is not ready yet. The address and mapped area can still
          be reviewed.
        </p>
      )}
      {result.detailedChecks && (
        <details className="group rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700">
            <span>
              <span
                id="detailed-checks-heading"
                role="heading"
                aria-level={3}
                className="block font-semibold text-slate-950"
              >
                Detailed official checks
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {result.detailedChecks.status === "complete"
                  ? "All configured provider queries completed."
                  : "Some provider queries remain unknown; this is a partial result."}
              </span>
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold uppercase">
              {result.detailedChecks.status}
            </span>
          </summary>
          <div className="space-y-3 border-t border-slate-200 p-4">
            <ul
              className="grid gap-2 sm:grid-cols-2"
              aria-label="Official layer results"
            >
              {result.detailedChecks.layers.map((layer) => (
                <DetailedLayer key={layer.key} layer={layer} />
              ))}
            </ul>
            <p className="text-xs leading-5 text-slate-600">
              {result.detailedChecks.region} Attribution and limitations remain
              applicable to every returned layer.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
              {result.detailedChecks.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-semibold text-teal-800 underline"
        >
          Retry fast view
        </button>
      </div>
    </section>
  );
}

function FastPoolWarning({ warning }: { warning: FastPoolWarning }) {
  const tone =
    warning.status === "blocked"
      ? "border-red-200 bg-red-50 text-red-950"
      : warning.status === "needs_checking"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";

  return (
    <section
      aria-labelledby="pool-warning-heading"
      className={`rounded-2xl border p-4 ${tone}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="pool-warning-heading" className="font-semibold">
          {warning.label}
        </h3>
        <span className="text-xs font-bold tracking-wide uppercase">
          Live pool check
        </span>
      </div>
      <p className="mt-2 text-sm leading-6">{warning.text}</p>
      {warning.recommendation && (
        <p className="mt-2 text-sm leading-6 font-semibold">
          Recommendation: {warning.recommendation}
        </p>
      )}
    </section>
  );
}

function DetailedLayer({ layer }: { layer: DetailedLayerResult }) {
  const stateLabel = layer.state.replaceAll("_", " ");
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">
          {layer.evidence.dataset}
        </span>
        <span className="text-xs font-bold text-slate-700 uppercase">
          {stateLabel}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600">{layer.message}</p>
      <p className="mt-1 text-xs text-slate-500">
        Provider: {layer.evidence.provider}
      </p>
      {layer.evidence.attribution && (
        <a
          href={layer.evidence.attribution.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs font-semibold text-teal-800 underline"
        >
          {layer.evidence.attribution.text}
        </a>
      )}
    </li>
  );
}

function Progress({
  label,
  state,
}: {
  label: string;
  state: "complete" | "partial" | "pending";
}) {
  return (
    <li
      className={`rounded-xl border px-3 py-2 ${state === "complete" ? "border-teal-200 bg-teal-50 text-teal-900" : state === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
    >
      {label}
    </li>
  );
}

function pointFeature(coordinates: [number, number]): Feature {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates },
  };
}
function feature(geometry: Polygon): Feature {
  return { type: "Feature", properties: {}, geometry };
}

function boundaryBounds(
  geometry: Polygon,
): [[number, number], [number, number]] {
  const coordinates = geometry.coordinates.flat(1);
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

export function returnedGeometry(
  result: FastPropertyViewResult,
  types: Geometry["type"][],
): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: (result.detailedChecks?.layers ?? []).flatMap(
      (layer) =>
        layer.geometry?.features.filter((item) =>
          types.includes(item.geometry.type),
        ) ?? [],
    ),
  };
}

function defaultPosition(result: FastPropertyViewResult): [number, number] {
  if (result.boundary.geometry) {
    return (findFastPoolDefaultPosition(
      result.boundary.geometry,
      { lengthMetres: 6.5, widthMetres: 3 },
      0,
    ) ?? result.resolvedAddress.coordinates) as [number, number];
  }
  return result.resolvedAddress.coordinates as [number, number];
}

function rotationHandleGeometry(
  position: [number, number],
  rotationDegrees: number,
  dimensions: { lengthMetres: number; widthMetres: number } | null | undefined,
) {
  if (!dimensions) return { type: "FeatureCollection" as const, features: [] };
  const pool = buildFastPoolGeometry(
    position,
    dimensions.lengthMetres,
    dimensions.widthMetres,
    rotationDegrees,
  );
  const [first, second] = pool.geometry.coordinates[0];
  const handle: [number, number] = [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
  ];
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { kind: "guide" },
        geometry: {
          type: "LineString" as const,
          coordinates: [position, handle],
        },
      },
      {
        type: "Feature" as const,
        properties: { kind: "handle" },
        geometry: { type: "Point" as const, coordinates: handle },
      },
    ],
  };
}

function DimensionInput({
  label,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        aria-invalid={invalid}
        aria-label={label}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 focus:border-teal-700 focus:outline-2 focus:outline-teal-700 aria-[invalid=true]:border-red-500"
      />
    </label>
  );
}
