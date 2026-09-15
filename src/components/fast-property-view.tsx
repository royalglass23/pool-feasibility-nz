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
  formatPoolShellClearanceLabel,
  type PoolShellClearance,
} from "@/modules/spatial/pool-shell-clearances";
import {
  POOL_SHELL_CLEARANCE_LIMITATION,
  PRELIMINARY_FEASIBILITY_SCOPE,
} from "@/modules/reporting/preliminary-feasibility-copy";
import { captureFastPropertyViewMap } from "@/modules/reporting/fast-property-view-map-capture";
import { SELECTED_POOL_MAP_STYLE } from "@/modules/reporting/report-map-style";
import type { DatasetKey } from "@/modules/data-access-spike/dataset-catalog";
import { configureMapLibreWorker } from "@/components/map/configure-maplibre-worker";
import { aerialTileRateLimitMessage } from "@/components/map/aerial-tile-error";
import { FieldValidationMessage } from "@/components/field-validation-message";
import {
  readClientApiErrorFromBlobError,
  type ClientApiError,
} from "@/shared/http/client-api-error";
import { bearing, point } from "@turf/turf";
import {
  assessSelectedPoolTerrain,
  type SelectedPoolTerrain,
} from "@/modules/terrain/assess-selected-pool-terrain";

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

const terrainSlopeLayer = {
  key: "terrain-slope",
  colours: {
    lower: "#16a34a",
    medium: "#f59e0b",
    higher: "#dc2626",
  },
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
  isLoadingDetailed = false,
  onPlacementChange,
  onSnapshotReady,
  isDetailedRateLimited = false,
}: {
  result: FastPropertyViewResult;
  onLoadDetailed?: () => void;
  onRetry: () => void;
  onStartAgain?: () => void;
  isLoadingDetailed?: boolean;
  onPlacementChange?: (snapshot: FastPoolPlacementSnapshot) => void;
  onSnapshotReady?: (snapshot: FastPropertyViewMapSnapshot | null) => void;
  isDetailedRateLimited?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const rotationControlVisibleRef = useRef(false);
  const syncRotationControlRef = useRef<() => void>(() => {});
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
  const [mapApiError, setMapApiError] = useState<ClientApiError | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<FastPoolId>("compact");
  const [customLength, setCustomLength] = useState("6.5");
  const [customWidth, setCustomWidth] = useState("3");
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [utilityVisibility, setUtilityVisibility] = useState(
    allUtilityCategoriesVisible,
  );
  const [contoursVisible, setContoursVisible] = useState(true);
  const [terrainSlopeVisible, setTerrainSlopeVisible] = useState(true);
  const [clearancesVisible, setClearancesVisible] = useState(true);
  const [mapLayersOpen, setMapLayersOpen] = useState(false);
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
  const terrainSlopeGeometry = useMemo(() => {
    const terrain = result.detailedChecks?.terrain;
    const samples =
      terrain?.status === "measured" ? (terrain.slopeSamples ?? []) : [];
    const slopeValues = samples.map(({ slopeDegrees }) => slopeDegrees);
    const minimumSlope = Math.min(...slopeValues);
    const slopeRange = Math.max(...slopeValues) - minimumSlope;
    return {
      type: "FeatureCollection" as const,
      features: samples.map((sample) => ({
        type: "Feature" as const,
        properties: {
          slopeDegrees: sample.slopeDegrees,
          relativeSlope:
            slopeRange > 0
              ? (sample.slopeDegrees - minimumSlope) / slopeRange
              : 0.5,
        },
        geometry: {
          type: "Point" as const,
          coordinates: sample.position,
        },
      })),
    };
  }, [result.detailedChecks?.terrain]);
  const selectedPoolTerrain = useMemo(() => {
    const terrain = result.detailedChecks?.terrain;
    if (
      terrain?.status !== "measured" ||
      !poolGeometry ||
      !terrain.slopeSamples?.length
    ) {
      return null;
    }
    return assessSelectedPoolTerrain({
      samples: terrain.slopeSamples,
      footprint: poolGeometry.geometry,
    });
  }, [poolGeometry, result.detailedChecks?.terrain]);
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
  const detailedLayers = result.detailedChecks?.layers;
  const detailedConstraintStatus = result.detailedChecks
    ? (result.detailedChecks.constraints?.status ??
      ((result.detailedChecks.layers ?? []).some(
        (layer) =>
          layer.state === "timeout" || layer.state === "provider_error",
      )
        ? "retryable"
        : "complete"))
    : null;
  const detailedActionDisabled =
    isInitialAddressLoad ||
    isLoadingDetailed ||
    isDetailedRateLimited ||
    detailedConstraintStatus === "complete";
  const mappedUtilityLayers = useMemo(
    () =>
      (detailedLayers ?? []).flatMap((layer) => {
        const definition = utilityLayerDefinitions.find(
          (candidate) => candidate.key === layer.key,
        );
        return definition && layer.geometry?.features.length
          ? [{ definition, layer }]
          : [];
      }),
    [detailedLayers],
  );
  const mappedContours = useMemo(
    () =>
      (detailedLayers ?? []).find(
        (layer) =>
          layer.key === contourLayer.key &&
          Boolean(layer.geometry?.features.length),
      ) ?? null,
    [detailedLayers],
  );
  const contourResult = useMemo(
    () =>
      (detailedLayers ?? []).find((layer) => layer.key === contourLayer.key) ??
      null,
    [detailedLayers],
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
  const visibleMapLayerCount =
    (clearancesVisible && poolShellClearances.length === 4 ? 1 : 0) +
    (terrainSlopeVisible && terrainSlopeGeometry.features.length > 0 ? 1 : 0) +
    (contoursVisible && mappedContours ? 1 : 0) +
    utilityCategories.filter(
      (category) =>
        utilityVisibility[category.id] &&
        mappedUtilityLayers.some(
          ({ definition }) => definition.category === category.id,
        ),
    ).length;
  const mapBoundaryGeometry = result.boundary.geometry;
  const mapCoordinates = result.resolvedAddress.coordinates;
  const mapAerialState = result.aerial.state;

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
    rotationControlVisibleRef.current =
      !isInitialAddressLoad && Boolean(poolGeometry);
  }, [
    dimensions,
    position,
    rotationDegrees,
    isInitialAddressLoad,
    poolGeometry,
  ]);

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
    let rotationMarker: import("maplibre-gl").Marker | null = null;
    const clearanceLabelMarkers = clearanceLabelMarkersRef.current;
    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !mapRef.current) return;
      configureMapLibreWorker(maplibregl);
      mapLibreRef.current = maplibregl;
      const boundary = mapBoundaryGeometry
        ? feature(mapBoundaryGeometry)
        : null;
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
            data: pointFeature(mapCoordinates),
          },
          pool: { type: "geojson", data: pool },
          "construction-envelope": {
            type: "geojson",
            data: isInitialAddressLoad
              ? emptyGeometry
              : (constructionEnvelopeGeometry ?? emptyGeometry),
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
      if (terrainSlopeGeometry.features.length > 0) {
        sources[terrainSlopeLayer.key] = {
          type: "geojson",
          data: terrainSlopeGeometry,
        };
      }
      const layers: import("maplibre-gl").LayerSpecification[] = [];
      if (mapAerialState === "ready") {
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
        layers.push({
          id: "boundary-fill",
          type: "fill",
          source: "boundary",
          paint: { "fill-color": "#14b8a6", "fill-opacity": 0.1 },
        });
      }
      if (terrainSlopeGeometry.features.length > 0) {
        layers.push({
          id: terrainSlopeLayer.key,
          type: "circle",
          source: terrainSlopeLayer.key,
          layout: {
            visibility: terrainSlopeVisible ? "visible" : "none",
          },
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "relativeSlope"],
              0,
              terrainSlopeLayer.colours.lower,
              0.5,
              terrainSlopeLayer.colours.medium,
              1,
              terrainSlopeLayer.colours.higher,
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              3,
              18,
              12,
              20,
              22,
            ],
            "circle-opacity": 0.1,
            "circle-blur": 0.72,
          },
        });
      }
      if (boundary) {
        layers.push({
          id: "boundary-line",
          type: "line",
          source: "boundary",
          paint: { "line-color": "#0f766e", "line-width": 4 },
        });
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
          paint: {
            "fill-color": SELECTED_POOL_MAP_STYLE.colour,
            "fill-opacity": SELECTED_POOL_MAP_STYLE.opacity,
          },
        },
        {
          id: "pool-line",
          type: "line",
          source: "pool",
          paint: {
            "line-color": SELECTED_POOL_MAP_STYLE.outline,
            "line-width": 3,
          },
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
          center: mapCoordinates,
          zoom: 15,
          attributionControl: { compact: true },
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        // DOM overlays stay visible while canvas snapshots are captured.
        const control = document.createElement("div");
        control.dataset.testid = "pool-rotate-control";
        control.title = "Drag to rotate pool";
        control.style.cssText =
          "width:44px;height:44px;border-radius:50%;background:white;border:1px solid #0077bd;display:grid;place-items:center;pointer-events:auto;touch-action:none;cursor:grab;";
        control.innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0077bd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v-5m0 5h-5M20 7a8 8 0 1 0 1 8"/></svg>';
        rotationMarker = new maplibregl.Marker({
          element: control,
          anchor: "center",
        })
          .setLngLat(mapCoordinates)
          .addTo(map);
        syncRotationControlRef.current = () => {
          const active = placementRef.current;
          if (!map || !active) return;
          control.dataset.rotationDegrees = String(active.rotationDegrees);
          const geometry = rotationHandleGeometry(
            active.position,
            active.rotationDegrees,
            rotationControlVisibleRef.current ? active.dimensions : null,
            map,
          );
          const handle = geometry.features.find(
            (entry) => entry.geometry.type === "Point",
          );
          control.style.display = handle ? "grid" : "none";
          if (handle?.geometry.type === "Point")
            rotationMarker?.setLngLat(
              handle.geometry.coordinates as [number, number],
            );
        };
        syncRotationControlRef.current();
        map.on("move", () => syncRotationControlRef.current());
        mapInstanceRef.current = map;
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        syncPoolShellClearanceLabels({
          map,
          maplibregl,
          markers: clearanceLabelMarkers,
          clearances: poolShellClearancesRef.current,
          visible: clearancesVisibleRef.current,
        });
        if (mapBoundaryGeometry) {
          map.fitBounds(boundaryBounds(mapBoundaryGeometry), {
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
          const errorKind =
            sourceId === "aerial" || /aerial|tile/i.test(message)
              ? "aerial"
              : "map";
          setMapError(errorKind);
          setMapApiError(null);
          if (errorKind === "aerial")
            void readClientApiErrorFromBlobError(event.error).then((error) => {
              if (!disposed) setMapApiError(error);
            });
        });
        map.on("movestart", () => {
          snapshotHandlerRef.current?.(null);
        });
        map.on("move", () =>
          positionPoolShellClearanceLabels(
            map!,
            clearanceLabelMarkersRef.current,
            poolShellClearancesRef.current,
          ),
        );
        map.on("idle", () => {
          if (disposed || !map) return;
          try {
            const imageDataUrl = captureFastPropertyViewMap({
              map,
              clearances: poolShellClearancesRef.current,
              visible: clearancesVisibleRef.current,
            });
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
          if (!interaction && event.type === "mousemove" && map) {
            // Pointer events can arrive before the style's layers are ready.
            // Querying a missing layer emits a MapLibre error even when the
            // map subsequently loads successfully.
            if (!map.getLayer("pool-fill")) {
              map.getCanvas().style.cursor = "";
              return;
            }
            const target = map.queryRenderedFeatures(event.point, {
              layers: ["pool-fill"],
            })[0];
            map.getCanvas().style.cursor = target ? "move" : "";
          }
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
          cursor: "grabbing" | null,
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
        control.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          interaction = "rotate";
          control.setPointerCapture(event.pointerId);
          map?.dragPan.disable();
          control.style.cursor = "grabbing";
        });
        control.addEventListener("pointermove", (event) => {
          if (!control.hasPointerCapture(event.pointerId) || !map) return;
          const active = placementRef.current;
          if (!active) return;
          const bounds = map.getCanvas().getBoundingClientRect();
          const cursor = map
            .unproject([
              event.clientX - bounds.left,
              event.clientY - bounds.top,
            ])
            .toArray();
          rotationHandlerRef.current(
            180 - bearing(point(active.position), point(cursor)),
          );
        });
        const releaseRotation = (event: PointerEvent) => {
          if (control.hasPointerCapture(event.pointerId))
            control.releasePointerCapture(event.pointerId);
          control.style.cursor = "grab";
          endInteraction();
        };
        control.addEventListener("pointerup", releaseRotation);
        control.addEventListener("pointercancel", releaseRotation);
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
      rotationMarker?.remove();
      syncRotationControlRef.current = () => {};
      removePoolShellClearanceLabels(clearanceLabelMarkers);
      map?.remove();
      mapInstanceRef.current = null;
      mapLibreRef.current = null;
    };
    // MapLibre is initialized once per resolved property. Placement geometry is
    // updated through GeoJSON source sync so pointer interaction is not rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isInitialAddressLoad,
    mapAerialState,
    mapBoundaryGeometry,
    mapCoordinates,
    mappedContours,
    mappedUtilityLayers,
    terrainSlopeGeometry,
  ]);

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
    if (map.getLayer(terrainSlopeLayer.key)) {
      map.setLayoutProperty(
        terrainSlopeLayer.key,
        "visibility",
        terrainSlopeVisible ? "visible" : "none",
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
  }, [
    contoursVisible,
    mappedUtilityLayers,
    terrainSlopeVisible,
    utilityVisibility,
  ]);

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
    syncRotationControlRef.current();
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
      className="space-y-5 rounded-sm border border-[#c8dce8] bg-white p-5 text-[#0d3050] sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="fast-view-heading"
            className="text-pool-950 text-2xl font-semibold"
          >
            {result.resolvedAddress.fullAddress}
          </h2>
          <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
            <strong>Preliminary feasibility only.</strong>{" "}
            {PRELIMINARY_FEASIBILITY_SCOPE}
          </p>
        </div>
      </div>
      <ol
        aria-label="Fast view progress"
        className="grid gap-2 text-sm lg:mr-[22rem]"
      >
        <Progress
          label={
            isInitialAddressLoad
              ? "Address found"
              : "Address found. Next, choose a pool size, then move and rotate it into your preferred position."
          }
          state="complete"
        />
        {isInitialAddressLoad && (
          <Progress label="Finding the property boundary…" state="pending" />
        )}
      </ol>
      <div className="border-pool-200 overflow-hidden rounded-sm border">
        {(!isInitialAddressLoad ||
          placementMessage ||
          mapError ||
          result.aerial.state !== "ready") && (
          <div
            aria-label="Property check notices"
            className="border-pool-200 flex flex-col gap-2 border-b bg-white p-3 sm:p-4"
          >
            {!isInitialAddressLoad && <FastPoolWarning warning={poolWarning} />}
            {placementMessage && (
              <p
                role="alert"
                className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 font-semibold text-amber-950 sm:px-4 sm:py-3 sm:text-sm sm:leading-6"
              >
                {placementMessage}
              </p>
            )}
            {mapError && (
              <div
                role="alert"
                className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 font-semibold text-red-950 sm:px-4 sm:py-3 sm:text-sm sm:leading-6"
              >
                <p>
                  {mapError === "aerial"
                    ? (aerialTileRateLimitMessage(mapApiError) ??
                      "We couldn't load the aerial photo. You can still review the property boundary; try the property check again in a minute.")
                    : "We couldn't load the interactive map. Try the property check again in a minute."}
                </p>
                {detailedConstraintStatus !== "complete" && (
                  <RetryPropertyCheckButton
                    disabled={detailedActionDisabled}
                    onRetry={onRetry}
                  />
                )}
              </div>
            )}
            {!mapError && result.aerial.state !== "ready" && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 sm:px-4 sm:py-3 sm:text-sm sm:leading-6">
                <p>
                  {result.aerial.state === "loading"
                    ? "The aerial photo is still loading. You can keep reviewing the address and mapped property area."
                    : result.aerial.state === "unavailable"
                      ? "An aerial photo isn't available for this property. You can still review the address and mapped property area."
                      : "We couldn't load the aerial photo. You can still review the address and mapped property area."}
                </p>
                {result.aerial.state === "error" &&
                  detailedConstraintStatus !== "complete" && (
                    <RetryPropertyCheckButton
                      disabled={detailedActionDisabled}
                      onRetry={onRetry}
                    />
                  )}
              </div>
            )}
          </div>
        )}
        <div
          className={
            isInitialAddressLoad
              ? "grid"
              : "grid lg:grid-cols-[minmax(0,1fr)_22rem]"
          }
        >
          <div
            data-testid="aerial-map-frame"
            className="relative order-1 h-[min(62vw,600px)] min-h-[360px] w-full lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-[600px]"
          >
            <div
              ref={mapRef}
              className="bg-pool-800 h-full w-full"
              aria-label={`Fast aerial map for ${result.resolvedAddress.fullAddress}`}
            />
            <PropertySlopeMapOverlay terrain={result.detailedChecks?.terrain} />
          </div>
          {!isInitialAddressLoad && (
            <div
              aria-label="Pool catalogue and placement controls"
              className="border-pool-200 order-2 flex flex-col gap-4 border-t bg-white p-4 lg:col-start-2 lg:row-start-1 lg:border-t-0 lg:border-l"
            >
              <div>
                <h3 className="text-pool-950 font-semibold">
                  Choose a pool layout
                </h3>
                <p className="text-pool-600 mt-1 text-sm">
                  Drag your pool to move it. Drag the rotate handle to turn it.
                </p>
              </div>
              <div
                className="grid grid-cols-1 border-t border-[#c8dce8]"
                role="group"
                aria-label="Pool catalogue"
              >
                {FAST_POOL_CATALOGUE.map((pool) => (
                  <button
                    key={pool.id}
                    type="button"
                    aria-pressed={selectedPoolId === pool.id}
                    aria-label={`${pool.label} (${pool.lengthMetres} × ${pool.widthMetres} m)`}
                    onClick={() => choosePool(pool.id)}
                    className="group grid min-h-16 grid-cols-[3rem_1fr_auto_1rem] items-center gap-3 border-b border-[#c8dce8] bg-white px-3 py-3 text-left text-sm text-[#0d3050] transition-colors hover:bg-[#edf8fd] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd] aria-pressed:bg-[#03a9ee]"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 52 30"
                      className="h-8 w-12 text-[#0077bd] group-aria-pressed:text-[#0d3050]"
                    >
                      <rect
                        x={(52 - (44 * pool.lengthMetres) / 10) / 2}
                        y={(30 - (24 * pool.widthMetres) / 4.4) / 2}
                        width={(44 * pool.lengthMetres) / 10}
                        height={(24 * pool.widthMetres) / 4.4}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.25"
                        strokeDasharray={
                          pool.id === "custom" ? "2 2" : undefined
                        }
                      />
                    </svg>
                    <span className="font-semibold">{pool.label}</span>
                    <span className="text-xs whitespace-nowrap tabular-nums">
                      {pool.lengthMetres} × {pool.widthMetres} m
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-base font-semibold"
                    >
                      {selectedPoolId === pool.id ? "✓" : ""}
                    </span>
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
                <FieldValidationMessage>
                  Enter a length from 2–20 m and width from 1.5–10 m in 0.1 m
                  increments.
                </FieldValidationMessage>
              )}
              <div className="border-pool-200 mt-auto space-y-3 border-t pt-4">
                <p
                  className="text-pool-700 text-sm leading-6"
                  aria-live="polite"
                >
                  {detailedConstraintStatus === "complete" ? (
                    "All available constraints are loaded. You can still adjust your pool before creating your report."
                  ) : detailedConstraintStatus === "retryable" ? (
                    "Some constraints were temporarily unavailable. Retry to check those layers again."
                  ) : (
                    <>
                      <strong className="text-pool-950 block font-semibold">
                        Happy with your pool position?
                      </strong>
                      Check for potential site constraints, or start again with
                      another property.
                    </>
                  )}
                </p>
                <div className="grid gap-2">
                  {onLoadDetailed && (
                    <button
                      type="button"
                      onClick={onLoadDetailed}
                      disabled={detailedActionDisabled}
                      className="bg-pool-950 hover:bg-pool-800 focus-visible:outline-pool-blue-700 disabled:bg-pool-100 disabled:text-pool-700 min-h-11 rounded-sm px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
                    >
                      {isLoadingDetailed
                        ? "Checking constraints…"
                        : detailedConstraintStatus === "complete"
                          ? "All available constraints loaded"
                          : detailedConstraintStatus === "retryable"
                            ? "Retry unavailable constraints"
                            : "Check for constraints"}
                    </button>
                  )}
                  {onStartAgain && (
                    <button
                      type="button"
                      onClick={onStartAgain}
                      disabled={isLoadingDetailed}
                      className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-sm border bg-white px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Start again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <section
          aria-label="Map layers"
          className="border-pool-200 border-t bg-white"
        >
          <button
            type="button"
            aria-expanded={mapLayersOpen}
            aria-controls="fast-view-map-layers"
            onClick={() => setMapLayersOpen((current) => !current)}
            className="hover:bg-pool-50 focus-visible:outline-pool-blue-700 grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:px-5"
          >
            <span>
              <span className="text-pool-950 block font-semibold">
                Map layers
              </span>
              <span className="text-pool-600 mt-0.5 block text-xs leading-5 sm:text-sm">
                Clearances, slope, contours and mapped services
              </span>
            </span>
            <span className="border-pool-200 text-pool-600 hidden rounded-full border bg-white px-2.5 py-1 text-xs font-semibold tabular-nums sm:inline">
              {visibleMapLayerCount}{" "}
              {visibleMapLayerCount === 1 ? "layer" : "layers"} shown
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`text-pool-700 size-5 transition-transform ${mapLayersOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </button>
          <div
            id="fast-view-map-layers"
            hidden={!mapLayersOpen}
            className="border-pool-200 border-t"
          >
            <div
              className={
                result.detailedChecks ? "grid lg:grid-cols-3" : undefined
              }
            >
              <div
                data-testid="map-layer-clearances"
                className={`text-pool-700 p-4 text-sm sm:p-5 ${
                  result.detailedChecks
                    ? "border-pool-200 border-b lg:border-r lg:border-b-0"
                    : ""
                }`}
              >
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
                  <div
                    data-testid="map-layer-slope"
                    className="border-pool-200 text-pool-700 border-b p-4 text-sm sm:p-5 lg:border-r lg:border-b-0"
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label="Slope shading"
                        checked={
                          terrainSlopeGeometry.features.length > 0 &&
                          terrainSlopeVisible
                        }
                        onChange={() =>
                          setTerrainSlopeVisible((current) => !current)
                        }
                        disabled={terrainSlopeGeometry.features.length === 0}
                        className="accent-pool-950 size-4"
                      />
                      <span className="font-semibold">Slope shading</span>
                    </label>
                    {terrainSlopeGeometry.features.length > 0 ? (
                      <div className="mt-2 ml-6">
                        <ul
                          aria-label="Slope shading legend"
                          className="grid gap-1 text-xs"
                        >
                          <SlopeLegendItem
                            colour={terrainSlopeLayer.colours.lower}
                            label="Lower slope on this property"
                          />
                          <SlopeLegendItem
                            colour={terrainSlopeLayer.colours.medium}
                            label="Medium slope on this property"
                          />
                          <SlopeLegendItem
                            colour={terrainSlopeLayer.colours.higher}
                            label="Higher slope on this property"
                          />
                        </ul>
                        <p className="text-pool-500 mt-2 text-xs leading-5">
                          Relative visual guide only—not a suitability or
                          engineering classification.
                        </p>
                      </div>
                    ) : (
                      <p className="text-pool-500 mt-1 ml-6 text-xs leading-5">
                        Location-based slope data is unavailable.
                      </p>
                    )}
                  </div>
                  <div
                    data-testid="map-layer-contours"
                    className="text-pool-700 p-4 text-sm sm:p-5"
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label="Contours"
                        checked={Boolean(mappedContours) && contoursVisible}
                        onChange={() =>
                          setContoursVisible((current) => !current)
                        }
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
                </>
              ) : null}
            </div>

            {result.detailedChecks ? (
              <div
                data-testid="map-layer-services"
                className="border-pool-200 border-t p-4 sm:p-5"
              >
                <p className="text-pool-950 text-sm font-semibold">
                  Mapped services
                </p>
                <ul className="text-pool-700 mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-5">
                  {utilityCategories.map((category) => {
                    const hasGeometry = mappedUtilityLayers.some(
                      ({ definition }) => definition.category === category.id,
                    );
                    return (
                      <li
                        key={category.id}
                        className="border-pool-200 bg-pool-50 min-w-0 rounded-sm border p-3 last:col-span-2 lg:last:col-span-1"
                      >
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
              </div>
            ) : null}
          </div>
        </section>
        {!isInitialAddressLoad && (
          <div className="flex justify-end bg-white px-4 py-3 text-sm">
            <p className="text-pool-600">
              Default pool: {result.defaultPool.label} (
              {result.defaultPool.lengthMetres} ×{" "}
              {result.defaultPool.widthMetres} m)
            </p>
          </div>
        )}
      </div>
      {result.detailedChecks?.terrain ? (
        <TerrainSlopeResult
          terrain={result.detailedChecks.terrain}
          contoursAvailable={Boolean(mappedContours)}
          selectedPoolTerrain={selectedPoolTerrain}
        />
      ) : null}
    </section>
  );
}

function PropertySlopeMapOverlay({
  terrain,
}: {
  terrain: NonNullable<FastPropertyViewResult["detailedChecks"]>["terrain"];
}) {
  if (!terrain || terrain.status !== "measured") return null;

  const downhill = terrain.downhillDirection ?? "approximately flat";
  return (
    <div
      aria-label={`Indicative property slope: average ${terrain.averageSlopeDegrees.toFixed(1)} degrees, downhill ${downhill}`}
      className="text-pool-950 pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-3 rounded-sm border border-white/80 bg-white/95 px-3 py-2 shadow-md"
    >
      <span
        aria-hidden="true"
        className="bg-pool-blue-50 text-pool-blue-800 grid size-9 place-items-center rounded-full text-xl font-bold"
        style={{
          transform:
            terrain.downhillBearingDegrees === null
              ? undefined
              : `rotate(${terrain.downhillBearingDegrees}deg)`,
        }}
      >
        ↑
      </span>
      <span className="leading-tight">
        <span className="block text-[0.7rem] font-semibold tracking-wide uppercase">
          Indicative property slope
        </span>
        <span className="mt-0.5 block text-sm font-semibold tabular-nums">
          Average {terrain.averageSlopeDegrees.toFixed(1)}° · downhill{" "}
          {downhill}
        </span>
      </span>
    </div>
  );
}

function SlopeLegendItem({ colour, label }: { colour: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: colour }}
      />
      <span>{label}</span>
    </li>
  );
}

function TerrainSlopeResult({
  terrain,
  contoursAvailable,
  selectedPoolTerrain,
}: {
  terrain: NonNullable<FastPropertyViewResult["detailedChecks"]>["terrain"];
  contoursAvailable: boolean;
  selectedPoolTerrain: SelectedPoolTerrain | null;
}) {
  if (!terrain) return null;
  if (terrain.status === "needs_checking") {
    return (
      <section
        aria-labelledby="terrain-slope-heading"
        className="rounded-sm border border-amber-200 bg-amber-50/60 p-4"
      >
        <h3 id="terrain-slope-heading" className="font-semibold">
          Indicative property slope
        </h3>
        <p className="mt-2 text-sm leading-6">
          Needs Checking — {terrain.reasons.join(" ")}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="terrain-slope-heading"
      className="border-pool-blue-200 bg-pool-blue-50/50 rounded-sm border p-4"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="terrain-slope-heading" className="font-semibold">
            Indicative property slope
          </h3>
          <p className="text-pool-600 mt-1 text-sm">
            Across the mapped property parcel, not the selected pool position
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-pool-600 text-xs">Average slope</p>
          <p className="text-pool-950 text-3xl font-semibold tabular-nums">
            {terrain.averageSlopeDegrees.toFixed(1)}°
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-pool-600">Steeper areas</dt>
          <dd className="mt-1">
            <span className="block font-semibold tabular-nums">
              {terrain.upperSlopeDegrees.toFixed(1)}°
            </span>
            <span className="text-pool-500 mt-1 block text-xs leading-5">
              90% of sampled areas are at or below this angle.
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-pool-600">Estimated height change</dt>
          <dd className="mt-1">
            <span className="block font-semibold tabular-nums">
              {terrain.estimatedFallMetres.toFixed(2)} m
            </span>
            <span className="text-pool-500 mt-1 block text-xs leading-5">
              Across the parcel in the overall slope direction.
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-pool-600">Overall downhill direction</dt>
          <dd className="mt-1 font-semibold">
            {terrain.downhillDirection ?? "Approximately flat"}
          </dd>
        </div>
      </dl>
      <div className="border-pool-blue-200 mt-4 border-t pt-4">
        <h4 className="text-pool-950 text-sm font-semibold">
          Selected pool position
        </h4>
        {selectedPoolTerrain ? (
          <>
            <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-pool-600">Average slope here</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {selectedPoolTerrain.averageSlopeDegrees.toFixed(1)}°
                </dd>
              </div>
              <div>
                <dt className="text-pool-600">Estimated height change here</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {selectedPoolTerrain.estimatedFallMetres.toFixed(2)} m
                </dd>
              </div>
            </dl>
            <p className="text-pool-700 mt-3 max-w-3xl text-sm leading-6">
              Based on {selectedPoolTerrain.sampleCount} nearby terrain samples.
              Lower figures generally indicate gentler ground, but they do not
              confirm buildability.
            </p>
          </>
        ) : (
          <p className="text-pool-700 mt-1 max-w-3xl text-sm leading-6">
            There are not enough terrain samples beneath this pool position to
            calculate a local result.{" "}
            {contoursAvailable ? (
              <>Use Slope shading or Contours to compare nearby areas. </>
            ) : null}
            A current site survey is still required before design, excavation,
            retaining, consent, or construction decisions.
          </p>
        )}
      </div>
    </section>
  );
}

const fastPoolWarningPresentation: Record<
  FastPoolWarning["status"],
  { dotClassName: string; summary: string }
> = {
  blocked: {
    dotClassName: "bg-red-600",
    summary:
      "This pool position overlaps a mapped constraint and needs review.",
  },
  needs_checking: {
    dotClassName: "bg-amber-600",
    summary:
      "Some mapped evidence still needs checking for this pool position.",
  },
  no_warning: {
    dotClassName: "bg-emerald-700",
    summary: "No mapped conflict was found for this pool position.",
  },
};

function FastPoolWarning({ warning }: { warning: FastPoolWarning }) {
  const presentation = fastPoolWarningPresentation[warning.status];

  return (
    <section
      aria-labelledby="pool-warning-heading"
      className="text-pool-950 lg:min-h-32"
    >
      <div className="flex items-start justify-between gap-2 sm:items-center">
        <h3
          id="pool-warning-heading"
          className="flex items-center gap-2 font-semibold sm:gap-3"
        >
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${presentation.dotClassName}`}
          />
          {warning.label}
        </h3>
        <span className="hidden text-xs font-bold tracking-wide uppercase sm:inline">
          Live pool check
        </span>
      </div>
      <p className="mt-1 text-sm leading-5 sm:mt-2 sm:pl-5 sm:leading-6 lg:min-h-6">
        {presentation.summary}
      </p>
      <details className="group mt-1 sm:mt-2 sm:pl-5">
        <summary className="text-pool-blue-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 -ml-2 inline-flex min-h-11 cursor-pointer items-center rounded-sm px-2 font-semibold underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">
          <span className="group-open:hidden">View details</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        <div className="border-pool-200 max-w-4xl border-t pt-3 pb-1 text-sm leading-5 sm:leading-6">
          <p>{warning.text}</p>
          {warning.recommendation && (
            <p className="mt-2 font-semibold">
              Recommendation: {warning.recommendation}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

function RetryPropertyCheckButton({
  disabled,
  onRetry,
}: {
  disabled: boolean;
  onRetry: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRetry}
      className="focus-visible:outline-pool-blue-700 mt-2 min-h-11 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Retry property check
    </button>
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
      className={`rounded-sm border px-3 py-2 ${state === "complete" ? "border-pool-blue-200 bg-pool-blue-50 text-pool-blue-900" : state === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-pool-200 bg-pool-50 text-pool-700"}`}
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
    marker.getElement().textContent = formatPoolShellClearanceLabel(
      clearance,
      index,
    );
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
  map?: Pick<import("maplibre-gl").Map, "project" | "unproject">,
) {
  if (!dimensions) return { type: "FeatureCollection" as const, features: [] };
  const envelope = fastPoolConstructionEnvelopeDimensions(dimensions);
  const pool = buildFastPoolGeometry(
    position,
    envelope.lengthMetres,
    envelope.widthMetres,
    rotationDegrees,
  );
  const [first, second] = pool.geometry.coordinates[0];
  let handle: [number, number] = [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
  ];
  if (map) {
    const centre = map.project(position);
    const edge = map.project(handle);
    const distance = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    if (distance > 0) {
      // 22px button radius, 8px gap, plus clearance for the orange stroke.
      handle = map
        .unproject([
          edge.x + ((edge.x - centre.x) / distance) * 32,
          edge.y + ((edge.y - centre.y) / distance) * 32,
        ])
        .toArray() as [number, number];
    }
  }
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
        className="border-pool-300 focus:border-pool-blue-700 focus:outline-pool-blue-700 mt-1 block min-h-11 w-full rounded-sm border bg-white px-3 focus:outline-2 aria-[invalid=true]:border-red-500"
      />
    </label>
  );
}
