"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Polygon,
} from "geojson";
import { type FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { DetailedLayerResult } from "@/modules/data-access-spike/execute-fast-property-details";
import {
  buildFastPoolGeometry,
  FAST_POOL_CATALOGUE,
  fastPoolConstructionEnvelopeDimensions,
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
import {
  calculatePoolShellClearances,
  type PoolShellClearance,
} from "@/modules/spatial/pool-shell-clearances";
import {
  POOL_SHELL_CLEARANCE_LIMITATION,
  PRELIMINARY_FEASIBILITY_SCOPE,
} from "@/modules/reporting/preliminary-feasibility-copy";
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

export type FastPropertyViewMapSnapshot = {
  imageDataUrl: string;
  visibleLayerKeys: DatasetKey[];
};

export function FastPropertyView({
  result,
  onLoadDetailed,
  onRetry,
  onStartAgain,
  isLoadingDetailed,
  onPlacementChange,
  onSnapshotReady,
}: {
  result: FastPropertyViewResult;
  onLoadDetailed: () => void;
  onRetry: () => void;
  onStartAgain?: () => void;
  isLoadingDetailed: boolean;
  onPlacementChange?: (snapshot: FastPoolPlacementSnapshot) => void;
  onSnapshotReady?: (snapshot: FastPropertyViewMapSnapshot | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null);
  const mapLibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const clearanceLabelMarkersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const poolShellClearancesRef = useRef<PoolShellClearance[]>([]);
  const clearancesVisibleRef = useRef(true);
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
  const snapshotHandlerRef = useRef(onSnapshotReady);
  const [mapError, setMapError] = useState<"aerial" | "map" | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<FastPoolId>("compact");
  const [customLength, setCustomLength] = useState("6.5");
  const [customWidth, setCustomWidth] = useState("3");
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [utilityVisibility, setUtilityVisibility] = useState(
    allUtilityCategoriesVisible,
  );
  const [contoursVisible, setContoursVisible] = useState(true);
  const [clearancesVisible, setClearancesVisible] = useState(true);
  const [initialPlacement] = useState(() => defaultPlacement(result));
  const [position, setPosition] = useState<[number, number]>(
    initialPlacement.position,
  );
  const [placementMessage, setPlacementMessage] = useState<string | null>(
    initialPlacement.message,
  );
  const isInitialAddressLoad = result.progress.boundary === "loading";

  useEffect(() => {
    snapshotHandlerRef.current = onSnapshotReady;
  }, [onSnapshotReady]);
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
  const constructionEnvelopeDimensions = useMemo(
    () => dimensions && fastPoolConstructionEnvelopeDimensions(dimensions),
    [dimensions],
  );
  const poolGeometry = useMemo(
    () =>
      dimensions
        ? buildFastPoolGeometry(
            position,
            dimensions.lengthMetres,
            dimensions.widthMetres,
            rotationDegrees,
          )
        : null,
    [dimensions, position, rotationDegrees],
  );
  const constructionEnvelopeGeometry = useMemo(
    () =>
      constructionEnvelopeDimensions
        ? buildFastPoolGeometry(
            position,
            constructionEnvelopeDimensions.lengthMetres,
            constructionEnvelopeDimensions.widthMetres,
            rotationDegrees,
          )
        : null,
    [constructionEnvelopeDimensions, position, rotationDegrees],
  );
  const constructionEnvelopeWithinMappedArea = useMemo(() => {
    if (isInitialAddressLoad) return false;
    if (!constructionEnvelopeDimensions) return false;
    if (!result.boundary.geometry) return true;
    return isFastPoolWithinMappedArea(
      position,
      constructionEnvelopeDimensions,
      rotationDegrees,
      result.boundary.geometry,
    );
  }, [
    constructionEnvelopeDimensions,
    isInitialAddressLoad,
    position,
    result.boundary.geometry,
    rotationDegrees,
  ]);
  const poolShellClearances = useMemo(
    () =>
      poolGeometry && result.boundary.geometry
        ? calculatePoolShellClearances({
            shellGeometry: poolGeometry.geometry,
            boundaryGeometry: result.boundary.geometry,
          })
        : [],
    [poolGeometry, result.boundary.geometry],
  );
  useEffect(() => {
    poolShellClearancesRef.current = poolShellClearances;
    clearancesVisibleRef.current = clearancesVisible;
  }, [clearancesVisible, poolShellClearances]);
  const poolWarning = useMemo(
    () =>
      classifyFastPoolWarning({
        boundaryState: result.boundary.state,
        pool: constructionEnvelopeGeometry,
        detailedChecks: result.detailedChecks,
      }),
    [
      constructionEnvelopeGeometry,
      result.boundary.state,
      result.detailedChecks,
    ],
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
  const visibleMapLayerKeys = useMemo(
    () => [
      ...(contoursVisible && mappedContours ? [contourLayer.key] : []),
      ...mappedUtilityLayers
        .filter(({ definition }) => utilityVisibility[definition.category])
        .map(({ definition }) => definition.key),
    ],
    [contoursVisible, mappedContours, mappedUtilityLayers, utilityVisibility],
  );
  const visibleMapLayerKeysRef = useRef<DatasetKey[]>(visibleMapLayerKeys);

  useEffect(() => {
    visibleMapLayerKeysRef.current = visibleMapLayerKeys;
  }, [visibleMapLayerKeys]);
  function toggleUtilityCategory(category: UtilityCategory) {
    setUtilityVisibility((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }

  useEffect(() => {
    if (isInitialAddressLoad) return;
    onPlacementChange?.({
      position,
      rotationDegrees,
      dimensions,
      poolGeometry: poolGeometry ?? null,
      constructionEnvelopeGeometry,
      constructionEnvelopeWithinMappedArea,
      clearancesVisible,
      warning: poolWarning,
    });
  }, [
    constructionEnvelopeGeometry,
    constructionEnvelopeWithinMappedArea,
    clearancesVisible,
    dimensions,
    isInitialAddressLoad,
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
    if (isInitialAddressLoad) return;
    if (
      constructionEnvelopeDimensions &&
      result.boundary.geometry &&
      !isFastPoolWithinMappedArea(
        candidate,
        constructionEnvelopeDimensions,
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
    if (isInitialAddressLoad) return;
    const normalized = ((candidate % 360) + 360) % 360;
    if (
      constructionEnvelopeDimensions &&
      result.boundary.geometry &&
      !isFastPoolWithinMappedArea(
        position,
        constructionEnvelopeDimensions,
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
    if (isInitialAddressLoad) return;
    setSelectedPoolId(poolId);
    const pool = FAST_POOL_CATALOGUE.find((item) => item.id === poolId)!;
    const nextDimensions =
      poolId === "custom"
        ? validateFastCustomDimensions(
            Number(customLength),
            Number(customWidth),
          )
        : pool;
    const nextEnvelopeDimensions =
      nextDimensions && fastPoolConstructionEnvelopeDimensions(nextDimensions);
    const nextPosition =
      nextEnvelopeDimensions && result.boundary.geometry
        ? findFastPoolDefaultPosition(
            result.boundary.geometry,
            nextEnvelopeDimensions,
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
    const clearanceLabelMarkers = clearanceLabelMarkersRef.current;
    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !mapRef.current) return;
      mapLibreRef.current = maplibregl;
      const boundary = result.boundary.geometry
        ? feature(result.boundary.geometry)
        : null;
      const activePlacement = placementRef.current;
      const emptyGeometry = {
        type: "FeatureCollection" as const,
        features: [],
      };
      const pool = isInitialAddressLoad
        ? emptyGeometry
        : (poolGeometry ?? emptyGeometry);
      const sources: Record<string, import("maplibre-gl").SourceSpecification> =
        {
          address: {
            type: "geojson",
            data: pointFeature(result.resolvedAddress.coordinates),
          },
          pool: { type: "geojson", data: pool },
          "construction-envelope": {
            type: "geojson",
            data: isInitialAddressLoad
              ? emptyGeometry
              : (constructionEnvelopeGeometry ?? emptyGeometry),
          },
          "pool-rotation": {
            type: "geojson",
            data: isInitialAddressLoad
              ? emptyGeometry
              : rotationHandleGeometry(
                  activePlacement?.position ??
                    result.resolvedAddress.coordinates,
                  activePlacement?.rotationDegrees ?? 0,
                  dimensions,
                ),
          },
          "pool-shell-clearances": {
            type: "geojson",
            data: clearancesVisible
              ? poolShellClearanceMapData(poolShellClearances)
              : { type: "FeatureCollection" as const, features: [] },
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
          id: "pool-shell-clearance-lines",
          type: "line",
          source: "pool-shell-clearances",
          paint: {
            "line-color": "#fff",
            "line-width": 2,
            "line-dasharray": [2, 1],
          },
        },
        {
          id: "construction-envelope-line",
          type: "line",
          source: "construction-envelope",
          paint: {
            "line-color": "#f97316",
            "line-width": 3,
            "line-dasharray": [3, 2],
          },
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
        syncPoolShellClearanceLabels({
          map,
          maplibregl,
          markers: clearanceLabelMarkers,
          clearances: poolShellClearancesRef.current,
          visible: clearancesVisibleRef.current,
        });
        if (result.boundary.geometry) {
          map.fitBounds(boundaryBounds(result.boundary.geometry), {
            padding: 56,
            duration: 0,
            maxZoom: 20,
          });
        }
        map.on("error", (event) => {
          const sourceId =
            "sourceId" in event && typeof event.sourceId === "string"
              ? event.sourceId
              : undefined;
          const message = event.error?.message ?? "Unknown MapLibre error";
          console.error("[GeoMap] fast property map error", {
            sourceId,
            message,
          });
          setMapError(
            sourceId === "aerial" || /aerial|tile/i.test(message)
              ? "aerial"
              : "map",
          );
        });
        map.on("movestart", () => snapshotHandlerRef.current?.(null));
        map.on("move", () =>
          positionPoolShellClearanceLabels(
            map!,
            clearanceLabelMarkersRef.current,
            poolShellClearancesRef.current,
          ),
        );
        map.on("idle", () => {
          try {
            const imageDataUrl = map?.getCanvas().toDataURL("image/png");
            snapshotHandlerRef.current?.(
              imageDataUrl
                ? {
                    imageDataUrl,
                    visibleLayerKeys: [...visibleMapLayerKeysRef.current],
                  }
                : null,
            );
          } catch {
            snapshotHandlerRef.current?.(null);
          }
        });
        let interaction: "move" | "rotate" | null = null;
        type PoolInteractionEvent =
          | import("maplibre-gl").MapMouseEvent
          | import("maplibre-gl").MapTouchEvent;
        const updateInteraction = (event: PoolInteractionEvent) => {
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
        };
        const beginInteraction = (
          nextInteraction: "move" | "rotate",
          event: PoolInteractionEvent,
          cursor: "crosshair" | "grabbing" | null,
        ) => {
          interaction = nextInteraction;
          map?.dragPan.disable();
          if (cursor) map?.getCanvas().style.setProperty("cursor", cursor);
          event.originalEvent.stopPropagation();
          if (nextInteraction === "move") updateInteraction(event);
        };
        const endInteraction = () => {
          interaction = null;
          map?.dragPan.enable();
          map?.getCanvas().style.setProperty("cursor", "");
        };
        map.on("mousedown", "pool-rotation-handle", (event) =>
          beginInteraction("rotate", event, "crosshair"),
        );
        map.on("touchstart", "pool-rotation-handle", (event) =>
          beginInteraction("rotate", event, null),
        );
        map.on("mousedown", "pool-fill", (event) =>
          beginInteraction("move", event, "grabbing"),
        );
        map.on("touchstart", "pool-fill", (event) =>
          beginInteraction("move", event, null),
        );
        map.on("mousemove", updateInteraction);
        map.on("touchmove", updateInteraction);
        map.on("mouseup", endInteraction);
        map.on("touchend", endInteraction);
        map.on("touchcancel", endInteraction);
      } catch (error) {
        console.error(
          "[GeoMap] fast property map initialization failed",
          error,
        );
        setMapError("map");
      }
    });
    return () => {
      disposed = true;
      removePoolShellClearanceLabels(clearanceLabelMarkers);
      map?.remove();
      mapInstanceRef.current = null;
      mapLibreRef.current = null;
    };
    // MapLibre is initialized once per resolved property. Placement geometry is
    // updated through GeoJSON source sync so pointer interaction is not rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedContours, mappedUtilityLayers, result]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    snapshotHandlerRef.current?.(null);
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
    snapshotHandlerRef.current?.(null);
    const emptyGeometry = {
      type: "FeatureCollection" as const,
      features: [],
    };
    const poolSource = map.getSource("pool") as
      import("maplibre-gl").GeoJSONSource | undefined;
    poolSource?.setData(
      isInitialAddressLoad ? emptyGeometry : (poolGeometry ?? emptyGeometry),
    );
    const constructionEnvelopeSource = map.getSource(
      "construction-envelope",
    ) as import("maplibre-gl").GeoJSONSource | undefined;
    constructionEnvelopeSource?.setData(
      isInitialAddressLoad
        ? emptyGeometry
        : (constructionEnvelopeGeometry ?? emptyGeometry),
    );
    const clearanceSource = map.getSource("pool-shell-clearances") as
      import("maplibre-gl").GeoJSONSource | undefined;
    clearanceSource?.setData(
      clearancesVisible
        ? poolShellClearanceMapData(poolShellClearances)
        : emptyGeometry,
    );
    const maplibregl = mapLibreRef.current;
    if (maplibregl) {
      syncPoolShellClearanceLabels({
        map,
        maplibregl,
        markers: clearanceLabelMarkersRef.current,
        clearances: poolShellClearances,
        visible: clearancesVisible,
      });
    }
    const rotationSource = map.getSource("pool-rotation") as
      import("maplibre-gl").GeoJSONSource | undefined;
    rotationSource?.setData(
      !isInitialAddressLoad && poolGeometry
        ? rotationHandleGeometry(position, rotationDegrees, dimensions)
        : emptyGeometry,
    );
  }, [
    constructionEnvelopeGeometry,
    clearancesVisible,
    dimensions,
    poolShellClearances,
    poolGeometry,
    position,
    rotationDegrees,
    isInitialAddressLoad,
  ]);

  return (
    <section
      aria-labelledby="fast-view-heading"
      className="space-y-5 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-pool-blue-700 text-xs font-bold tracking-[0.18em] uppercase">
            Fast property view
          </p>
          <h2
            id="fast-view-heading"
            className="text-pool-950 mt-2 text-2xl font-semibold"
          >
            {result.resolvedAddress.fullAddress}
          </h2>
          <p className="text-pool-600 mt-2 text-sm">
            {isInitialAddressLoad
              ? "The selected official address is ready."
              : "A preliminary mapped view is ready."}
          </p>
          <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
            <strong>Preliminary feasibility only.</strong>{" "}
            {PRELIMINARY_FEASIBILITY_SCOPE}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onStartAgain && (
            <button
              type="button"
              onClick={onStartAgain}
              disabled={isLoadingDetailed}
              className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start again
            </button>
          )}
          <button
            type="button"
            onClick={onLoadDetailed}
            disabled={isInitialAddressLoad || isLoadingDetailed}
            className="bg-pool-950 disabled:bg-pool-400 min-h-11 rounded-xl px-4 text-sm font-semibold text-white"
          >
            {isLoadingDetailed
              ? "Loading detailed checks…"
              : isInitialAddressLoad
                ? "Finding property boundary…"
                : "Load detailed official checks"}
          </button>
        </div>
      </div>
      <ol
        aria-label="Fast view progress"
        className="grid gap-2 text-sm sm:max-w-xs"
      >
        <Progress label="Address found" state="complete" />
        {isInitialAddressLoad && (
          <Progress label="Finding the property boundary…" state="pending" />
        )}
      </ol>
      <div className="border-pool-200 overflow-hidden rounded-2xl border">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div
            ref={mapRef}
            className="bg-pool-800 h-[min(62vw,600px)] min-h-[360px] w-full"
            aria-label={`Fast aerial map for ${result.resolvedAddress.fullAddress}`}
          />
          <aside
            aria-label="Map layers"
            className="border-pool-200 border-t bg-white p-4 lg:border-t-0 lg:border-l"
          >
            <h3 className="text-pool-950 font-semibold">Map layers</h3>
            <div className="border-pool-200 text-pool-700 mt-4 border-b pb-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Show pool-shell clearances"
                  checked={clearancesVisible}
                  onChange={() => setClearancesVisible((current) => !current)}
                  disabled={poolShellClearances.length !== 4}
                  className="accent-pool-950 size-4"
                />
                <span
                  aria-hidden="true"
                  className="w-5 border-t-2 border-dashed"
                  style={{ borderColor: "#fff" }}
                />
                <span className="font-semibold">Pool-shell clearances</span>
              </label>
              {clearancesVisible && poolShellClearances.length === 4 ? (
                <>
                  <ul
                    aria-label="Pool-shell clearance measurements"
                    className="mt-2 grid grid-cols-2 gap-1 pl-7 text-xs font-semibold"
                  >
                    {poolShellClearances.map((clearance, index) => (
                      <li key={clearance.id}>
                        Side {index + 1}: {clearance.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-pool-500 mt-2 ml-7 text-xs leading-5">
                    {POOL_SHELL_CLEARANCE_LIMITATION}
                  </p>
                </>
              ) : (
                <p className="text-pool-500 mt-1 ml-7 text-xs leading-5">
                  {result.boundary.geometry
                    ? "Clearance lines are hidden."
                    : "Clearances need a mapped property boundary."}
                </p>
              )}
            </div>

            {result.detailedChecks ? (
              <>
                <div className="border-pool-200 text-pool-700 mt-4 border-b pb-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="Contours"
                      checked={Boolean(mappedContours) && contoursVisible}
                      onChange={() => setContoursVisible((current) => !current)}
                      disabled={!mappedContours}
                      className="accent-pool-950 size-4"
                    />
                    <span
                      aria-hidden="true"
                      className="h-0 w-5 border-t-2 border-dashed"
                      style={{ borderColor: contourLayer.color }}
                    />
                    <span className="font-semibold">Contours</span>
                  </label>
                  <p className="text-pool-500 mt-1 ml-11 text-xs">
                    {mappedContours
                      ? "Terrain contours (2016, indicative only)"
                      : contourResult
                        ? "No contour geometry returned"
                        : "Contour data was not checked"}
                  </p>
                </div>
                <ul className="text-pool-700 mt-4 space-y-3 text-sm">
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
                            className="accent-pool-950 size-4"
                          />
                          <span
                            aria-hidden="true"
                            className="h-1 w-5 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-semibold">
                            {category.label}
                          </span>
                        </label>
                        <p className="text-pool-500 mt-1 ml-11 text-xs">
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
              <p className="text-pool-600 mt-4 text-sm leading-6">
                Load detailed official checks to see contours and mapped utility
                evidence.
              </p>
            )}
          </aside>
        </div>
        {!isInitialAddressLoad && (
          <div className="flex justify-end bg-white px-4 py-3 text-sm">
            <p className="text-pool-600">
              Default pool: {result.defaultPool.label} (
              {result.defaultPool.lengthMetres} × {result.defaultPool.widthMetres}{" "}
              m)
            </p>
          </div>
        )}
      </div>
      {!isInitialAddressLoad && (
        <>
          <div
            aria-label="Pool catalogue and placement controls"
            className="border-pool-200 bg-pool-50 space-y-4 rounded-2xl border p-4"
          >
            <div>
              <h3 className="text-pool-950 font-semibold">Choose a pool layout</h3>
              <p className="text-pool-600 mt-1 text-sm">
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
                  className="border-pool-300 focus-visible:outline-pool-blue-700 aria-pressed:border-pool-blue-700 aria-pressed:bg-pool-blue-50 min-h-11 rounded-xl border bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
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
        </>
      )}
      {mapError && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {mapError === "aerial"
            ? "Aerial imagery could not be loaded. Check the LINZ imagery configuration and retry the fast view."
            : "The interactive map could not load. Retry the fast view to try again."}
        </p>
      )}
      {result.aerial.state !== "ready" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Aerial imagery is not ready yet. The address and mapped area can still
          be reviewed.
        </p>
      )}
      {result.detailedChecks && (
        <details className="group border-pool-200 bg-pool-50 rounded-2xl border">
          <summary className="focus-visible:outline-pool-blue-700 flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
            <span>
              <span
                id="detailed-checks-heading"
                role="heading"
                aria-level={3}
                className="text-pool-950 block font-semibold"
              >
                Detailed official checks
              </span>
              <span className="text-pool-600 mt-1 block text-sm">
                {result.detailedChecks.status === "complete"
                  ? "All configured provider queries completed."
                  : "Some provider queries remain unknown; this is a partial result."}
              </span>
            </span>
            <span className="border-pool-300 rounded-full border bg-white px-3 py-1 text-xs font-bold uppercase">
              {result.detailedChecks.status}
            </span>
          </summary>
          <div className="border-pool-200 space-y-3 border-t p-4">
            <ul
              className="grid gap-2 sm:grid-cols-2"
              aria-label="Official layer results"
            >
              {result.detailedChecks.layers.map((layer) => (
                <DetailedLayer key={layer.key} layer={layer} />
              ))}
            </ul>
            <p className="text-pool-600 text-xs leading-5">
              {result.detailedChecks.region} Attribution and limitations remain
              applicable to every returned layer.
            </p>
            <ul className="text-pool-600 list-disc space-y-1 pl-5 text-xs leading-5">
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
          className="text-pool-blue-800 text-sm font-semibold underline"
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
    <li className="border-pool-200 rounded-xl border bg-white px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-pool-900 font-semibold">
          {layer.evidence.dataset}
        </span>
        <span className="text-pool-700 text-xs font-bold uppercase">
          {stateLabel}
        </span>
      </div>
      <p className="text-pool-600 mt-1 text-xs leading-5">{layer.message}</p>
      <p className="text-pool-500 mt-1 text-xs">
        Provider: {layer.evidence.provider}
      </p>
      {layer.evidence.attribution && (
        <a
          href={layer.evidence.attribution.url}
          target="_blank"
          rel="noreferrer"
          className="text-pool-blue-800 mt-1 inline-block text-xs font-semibold underline"
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
      className={`rounded-xl border px-3 py-2 ${state === "complete" ? "border-pool-blue-200 bg-pool-blue-50 text-pool-blue-900" : state === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-pool-200 bg-pool-50 text-pool-700"}`}
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

function poolShellClearanceMapData(
  clearances: PoolShellClearance[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: clearances.map((clearance) => ({
      type: "Feature",
      properties: { id: clearance.id, label: clearance.label },
      geometry: {
        type: "LineString",
        coordinates: [clearance.start, clearance.end],
      },
    })),
  };
}

function syncPoolShellClearanceLabels({
  map,
  maplibregl,
  markers,
  clearances,
  visible,
}: {
  map: import("maplibre-gl").Map;
  maplibregl: typeof import("maplibre-gl");
  markers: import("maplibre-gl").Marker[];
  clearances: PoolShellClearance[];
  visible: boolean;
}) {
  if (!visible || clearances.length !== 4) {
    removePoolShellClearanceLabels(markers);
    return;
  }

  clearances.forEach((clearance, index) => {
    let marker = markers[index];
    if (!marker) {
      const element = document.createElement("span");
      element.className = "pool-shell-clearance-label";
      element.setAttribute("aria-hidden", "true");
      // MapLibre renders a marker as soon as it is added. Give it its
      // coordinate first: adding an unpositioned marker makes its renderer
      // read `lng` from an undefined LngLat and prevents the whole map loading.
      marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat(clearance.end)
        .addTo(map);
      markers[index] = marker;
    }
    marker.getElement().textContent = `Side ${index + 1} · ${clearance.label}`;
    marker.setLngLat(clearance.end);
  });

  markers.splice(clearances.length).forEach((marker) => marker.remove());
  positionPoolShellClearanceLabels(map, markers, clearances);
}

function positionPoolShellClearanceLabels(
  map: import("maplibre-gl").Map,
  markers: import("maplibre-gl").Marker[],
  clearances: PoolShellClearance[],
) {
  clearances.forEach((clearance, index) => {
    const marker = markers[index];
    if (!marker) return;

    const boundary = map.project(clearance.end);
    const pool = map.project(clearance.start);
    const outwardX = boundary.x - pool.x;
    const outwardY = boundary.y - pool.y;
    const length = Math.hypot(outwardX, outwardY);
    if (length === 0) return;

    const element = marker.getElement();
    const horizontalInset = Math.abs(outwardX / length) * element.offsetWidth;
    const verticalInset = Math.abs(outwardY / length) * element.offsetHeight;
    const inset = (horizontalInset + verticalInset) / 2 + 8;
    marker.setOffset([
      (outwardX / length) * inset,
      (outwardY / length) * inset,
    ]);
  });
}

function removePoolShellClearanceLabels(
  markers: import("maplibre-gl").Marker[],
) {
  markers.splice(0).forEach((marker) => marker.remove());
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

function defaultPlacement(result: FastPropertyViewResult): {
  position: [number, number];
  message: string | null;
} {
  if (result.boundary.geometry) {
    const position = findFastPoolDefaultPosition(
      result.boundary.geometry,
      fastPoolConstructionEnvelopeDimensions({
        lengthMetres: 6.5,
        widthMetres: 3,
      }),
      0,
    );
    return position
      ? { position: position as [number, number], message: null }
      : {
          position: result.resolvedAddress.coordinates as [number, number],
          message: "This size does not fit inside the available mapped area.",
        };
  }
  return {
    position: result.resolvedAddress.coordinates as [number, number],
    message: null,
  };
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
    <label className="text-pool-800 text-sm font-medium">
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
        className="border-pool-300 focus:border-pool-blue-700 focus:outline-pool-blue-700 mt-1 block min-h-11 w-full rounded-xl border bg-white px-3 focus:outline-2 aria-[invalid=true]:border-red-500"
      />
    </label>
  );
}
