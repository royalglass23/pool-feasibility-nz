import { booleanIntersects, feature } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import type {
  DetailedLayerResult,
  FastPropertyDetails,
} from "./execute-fast-property-details";
import type { BoundaryState } from "./run-data-access-spike";

export const FAST_POOL_SERVICE_RECOMMENDATION =
  "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.";

export type FastPoolWarningStatus =
  | "no_warning"
  | "needs_checking"
  | "blocked";

export type FastPoolWarning = {
  status: FastPoolWarningStatus;
  label: "No Warning" | "Needs Checking" | "Blocked";
  text: string;
  recommendation: string | null;
  conflictingDatasets: string[];
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
  warning: FastPoolWarning;
};

const serviceDatasetKeys = new Set<
  DetailedLayerResult["key"]
>([
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

  if (input.detailedChecks.status !== "complete") {
    return needsChecking(
      "Some detailed official checks are incomplete or unavailable, so the mapped utility evidence needs checking.",
    );
  }

  if (input.detailedChecks.layers.length === 0) {
    return needsChecking(
      "No detailed official layer results were returned, so the mapped utility evidence needs checking.",
    );
  }

  const conflictingDatasets = input.detailedChecks.layers
    .filter((layer) => serviceDatasetKeys.has(layer.key))
    .filter((layer) => isReliableIntersection(layer, input.pool!))
    .map((layer) => layer.evidence.dataset || layer.key);

  if (conflictingDatasets.length > 0) {
    return {
      status: "blocked",
      label: "Blocked",
      text: `The pool overlaps reliable mapped ${formatDatasetList(conflictingDatasets)} infrastructure.`,
      recommendation: FAST_POOL_SERVICE_RECOMMENDATION,
      conflictingDatasets,
    };
  }

  const incompleteLayer = input.detailedChecks.layers.find(
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
  };
}

function isReliableIntersection(
  layer: DetailedLayerResult,
  pool: Feature<Polygon>,
): boolean {
  if (
    layer.state !== "returned" ||
    !layer.geometry ||
    layer.evidence.status !== "success" ||
    layer.evidence.evidenceUse !== "report_allowed" ||
    layer.evidence.confidence === "unavailable"
  ) {
    return false;
  }

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

function needsChecking(text: string): FastPoolWarning {
  return {
    status: "needs_checking",
    label: "Needs Checking",
    text,
    recommendation: null,
    conflictingDatasets: [],
  };
}

function formatDatasetList(datasets: string[]): string {
  if (datasets.length === 1) return datasets[0].toLowerCase();
  if (datasets.length === 2) {
    return `${datasets[0].toLowerCase()} and ${datasets[1].toLowerCase()}`;
  }
  return `${datasets.slice(0, -1).map((dataset) => dataset.toLowerCase()).join(", ")}, and ${datasets.at(-1)!.toLowerCase()}`;
}
