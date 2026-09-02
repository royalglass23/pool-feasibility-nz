import { booleanIntersects, feature } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import type {
  DetailedLayerResult,
  FastPropertyDetails,
} from "./execute-fast-property-details";
import type { BoundaryState } from "./run-data-access-spike";

export const FAST_POOL_SERVICE_RECOMMENDATION =
  "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.";

export type FastPoolWarningStatus = "no_warning" | "needs_checking" | "blocked";

export type PlacementLayerCategory =
  | "pool_fit"
  | "electricity"
  | "gas"
  | "water_wastewater"
  | "stormwater"
  | "flooding_drainage"
  | "planning";

export type PlacementLayerFinding = {
  key: DetailedLayerResult["key"];
  dataset: string;
  category: PlacementLayerCategory;
  status: "potential_constraint" | "further_investigation";
  evidence: "reliable" | "needs_checking";
};

export type FastPoolWarning = {
  status: FastPoolWarningStatus;
  label: "No Warning" | "Needs Checking" | "Blocked";
  text: string;
  recommendation: string | null;
  conflictingDatasets: string[];
  checkingDatasets: string[];
  placementLayerFindings?: PlacementLayerFinding[];
};

export type FastPoolWarningInput = {
  boundaryState: BoundaryState | "loading";
  pool: Feature<Polygon> | null;
  detailedChecks?: FastPropertyDetails;
};

export type FastPoolPlacementSnapshot = {
  position: [number, number];
  rotationDegrees: number;
  dimensions: { lengthMetres: number; widthMetres: number } | null;
  poolGeometry: Feature<Polygon> | null;
  constructionEnvelopeGeometry: Feature<Polygon> | null;
  constructionEnvelopeWithinMappedArea: boolean;
  clearancesVisible?: boolean;
  warning: FastPoolWarning;
};

const placementLayerCategories: Partial<
  Record<DetailedLayerResult["key"], PlacementLayerCategory>
> = {
  building_footprints: "pool_fit",
  flood_plains: "flooding_drainage",
  flood_prone_areas: "flooding_drainage",
  overland_flow_paths: "flooding_drainage",
  planning_overlays: "planning",
  public_stormwater_assets: "stormwater",
  manholes: "stormwater",
  catchpits: "stormwater",
  watercourses: "stormwater",
  culverts: "stormwater",
  wastewater_assets: "water_wastewater",
  public_water_assets: "water_wastewater",
  wastewater_manholes: "water_wastewater",
  water_fittings: "water_wastewater",
  wastewater_fittings: "water_wastewater",
  electricity_feeder_lines: "electricity",
  gas_distribution_lines: "gas",
};

const placementDatasetKeys = new Set<DetailedLayerResult["key"]>([
  "building_footprints",
  "flood_plains",
  "flood_prone_areas",
  "overland_flow_paths",
  "planning_overlays",
  "public_stormwater_assets",
  "watercourses",
  "manholes",
  "catchpits",
  "wastewater_assets",
  "public_water_assets",
  "wastewater_manholes",
  "water_fittings",
  "wastewater_fittings",
  "electricity_feeder_lines",
  "gas_distribution_lines",
  "culverts",
]);

export function classifyFastPoolWarning(
  input: FastPoolWarningInput,
): FastPoolWarning {
  if (input.boundaryState !== "confirmed" || !input.pool) {
    return needsChecking(
      "The mapped property boundary or pool position needs checking before this layout can be assessed.",
    );
  }

  if (!input.detailedChecks) {
    return needsChecking(
      "Detailed official checks have not been loaded, so mapped utility conflicts still need checking.",
    );
  }

  // A staged retry may preserve a partial detailed-check response while an
  // upstream provider is unavailable. Treat that as no returned evidence,
  // rather than letting the interactive map fail before the visitor can retry.
  const detailedLayers = input.detailedChecks.layers ?? [];
  const intersectingLayers = detailedLayers
    .filter((layer) => placementDatasetKeys.has(layer.key))
    .filter((layer) => isMappedIntersection(layer, input.pool!));
  const placementLayerFindings = intersectingLayers.map((layer) => {
    const reliable = isReliableIntersection(layer, input.pool!);
    return {
      key: layer.key,
      dataset: datasetName(layer),
      category: placementLayerCategories[layer.key] ?? "pool_fit",
      status: reliable ? "potential_constraint" : "further_investigation",
      evidence: reliable ? "reliable" : "needs_checking",
    } satisfies PlacementLayerFinding;
  });
  const conflictingDatasets = placementLayerFindings
    .filter((finding) => finding.evidence === "reliable")
    .map((finding) => finding.dataset);
  const checkingDatasets = placementLayerFindings
    .filter((finding) => finding.evidence === "needs_checking")
    .map((finding) => finding.dataset);

  if (conflictingDatasets.length > 0) {
    const checkingText =
      checkingDatasets.length > 0
        ? ` Mapped ${formatDatasetList(checkingDatasets)} position also needs checking.`
        : "";
    return {
      status: "blocked",
      label: "Blocked",
      text: `The pool overlaps reliable mapped ${formatDatasetList(conflictingDatasets)}.${checkingText}`,
      recommendation: FAST_POOL_SERVICE_RECOMMENDATION,
      conflictingDatasets,
      checkingDatasets,
      placementLayerFindings,
    };
  }

  if (checkingDatasets.length > 0) {
    return needsChecking(
      `The pool overlaps mapped ${formatDatasetList(checkingDatasets)}. Its mapped position needs checking before this layout can be assessed.`,
      checkingDatasets,
      placementLayerFindings,
    );
  }

  if (input.detailedChecks.status !== "complete") {
    return needsChecking(
      "Some detailed official checks are incomplete or unavailable, so the mapped utility evidence needs checking.",
    );
  }

  if (detailedLayers.length === 0) {
    return needsChecking(
      "No detailed official layer results were returned, so the mapped utility evidence needs checking.",
    );
  }

  const incompleteLayer = detailedLayers.find(
    (layer) => !isKnownLayerOutcome(layer),
  );
  if (incompleteLayer) {
    return needsChecking(
      `${incompleteLayer.evidence.dataset || incompleteLayer.key} evidence needs checking before this layout can be assessed.`,
    );
  }

  return {
    status: "no_warning",
    label: "No Warning",
    text: "No mapped utility conflict was found in the loaded official checks.",
    recommendation: null,
    conflictingDatasets: [],
    checkingDatasets: [],
    placementLayerFindings: [],
  };
}

function isReliableIntersection(
  layer: DetailedLayerResult,
  pool: Feature<Polygon>,
): boolean {
  if (
    !isMappedIntersection(layer, pool) ||
    layer.evidence.status !== "success" ||
    layer.evidence.evidenceUse !== "report_allowed" ||
    layer.evidence.confidence === "unavailable"
  ) {
    return false;
  }

  return true;
}

function isMappedIntersection(
  layer: DetailedLayerResult,
  pool: Feature<Polygon>,
): boolean {
  if (
    (layer.state !== "returned" && layer.state !== "internal_reference_only") ||
    !layer.geometry
  )
    return false;

  return layer.geometry.features.some((item) => {
    if (!item.geometry) return false;
    return booleanIntersects(pool, feature(item.geometry));
  });
}

function isKnownLayerOutcome(layer: DetailedLayerResult): boolean {
  return (
    layer.state === "verified_empty" ||
    (layer.state === "returned" &&
      layer.geometry !== null &&
      layer.geometry.features.length > 0)
  );
}

function needsChecking(
  text: string,
  checkingDatasets: string[] = [],
  placementLayerFindings: PlacementLayerFinding[] = [],
): FastPoolWarning {
  return {
    status: "needs_checking",
    label: "Needs Checking",
    text,
    recommendation: null,
    conflictingDatasets: [],
    checkingDatasets,
    placementLayerFindings,
  };
}

function datasetName(layer: DetailedLayerResult): string {
  return layer.evidence.dataset || layer.key;
}

function formatDatasetList(datasets: string[]): string {
  if (datasets.length === 1) return datasets[0].toLowerCase();
  if (datasets.length === 2) {
    return `${datasets[0].toLowerCase()} and ${datasets[1].toLowerCase()}`;
  }
  return `${datasets
    .slice(0, -1)
    .map((dataset) => dataset.toLowerCase())
    .join(", ")}, and ${datasets.at(-1)!.toLowerCase()}`;
}
