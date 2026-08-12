export type ReportMapLayerStyle = {
  label: string;
  colour: string;
  rgba: readonly [number, number, number, number];
  dashed?: boolean;
};

export const REPORT_MAP_BASE_STYLES = {
  boundary: {
    label: "Mapped property boundary",
    colour: "#0f766e",
  },
  constructionEnvelope: {
    label: "Indicative investigation buffer",
    colour: "#f97316",
    dashed: true,
  },
} as const;

const REPORT_MAP_LAYER_KEY_ALIASES: Readonly<Record<string, string>> = {
  nz_building_outlines: "building_footprints",
};

const REPORT_MAP_OMITTED_LAYER_KEYS = new Set(["building_footprints"]);

export function reportMapLayerKey(
  id: string | undefined,
  dataset?: string,
): string {
  const key =
    id ??
    dataset
      ?.toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "_")
      .replaceAll(/^_+|_+$/g, "") ??
    "";
  return REPORT_MAP_LAYER_KEY_ALIASES[key] ?? key;
}

export function shouldReproduceReportMapLayer(key: string): boolean {
  return !REPORT_MAP_OMITTED_LAYER_KEYS.has(reportMapLayerKey(key));
}

export function reportMapPoolStyle(
  warning: "no_warning" | "needs_checking" | "blocked",
) {
  if (warning === "blocked") {
    return { label: "Selected pool", colour: "#dc2626" } as const;
  }
  if (warning === "needs_checking") {
    return { label: "Selected pool", colour: "#d97706" } as const;
  }
  return { label: "Selected pool", colour: "#16a34a" } as const;
}

export function reportMapLayerStyle(key: string): ReportMapLayerStyle {
  if (key === "electricity_feeder_lines") {
    return {
      label: "Electricity",
      colour: "#ca8a04",
      rgba: [202, 138, 4, 255],
    };
  }
  if (key === "gas_distribution_lines") {
    return {
      label: "Gas",
      colour: "#dc2626",
      rgba: [220, 38, 38, 255],
    };
  }
  if (key.includes("wastewater")) {
    return {
      label: "Wastewater",
      colour: "#7c3aed",
      rgba: [124, 58, 237, 255],
    };
  }
  if (key === "public_water_assets" || key === "water_fittings") {
    return {
      label: "Water",
      colour: "#0f766e",
      rgba: [15, 118, 110, 255],
    };
  }
  if (
    key.includes("stormwater") ||
    key === "manholes" ||
    key === "catchpits" ||
    key === "watercourses" ||
    key === "culverts"
  ) {
    return {
      label: "Stormwater",
      colour: "#0369a1",
      rgba: [3, 105, 161, 255],
    };
  }
  if (key.includes("flood") || key === "overland_flow_paths") {
    return {
      label: "Flooding and flow paths",
      colour: "#0e7490",
      rgba: [14, 116, 144, 255],
    };
  }
  if (key === "contours") {
    return {
      label: "Contours",
      colour: "#475569",
      rgba: [71, 85, 105, 255],
      dashed: true,
    };
  }
  if (key === "building_footprints") {
    return {
      label: "Building outlines",
      colour: "#64748b",
      rgba: [100, 116, 139, 255],
    };
  }
  return {
    label: key.replaceAll("_", " "),
    colour: "#7e22ce",
    rgba: [126, 34, 206, 255],
  };
}
