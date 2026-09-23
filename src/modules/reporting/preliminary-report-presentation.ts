import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  calculatePoolShellClearances,
  hasValidPolygonRing,
  type PoolShellClearance,
} from "@/modules/spatial/pool-shell-clearances";
import {
  REPORT_MAP_BASE_STYLES,
  SELECTED_POOL_MAP_STYLE,
  reportMapLayerKey,
  reportMapLayerStyle,
  reportMapPoolStyle,
  shouldReproduceReportMapLayer,
} from "@/modules/reporting/report-map-style";

export const CC_BY_4_LICENCE_URL =
  "https://creativecommons.org/licenses/by/4.0/legalcode";
export const FIRTH_MASONRY_POOL_GUIDANCE_URL =
  "https://www.firth.co.nz/assets/Uploads/Resources/Documents/FIR0744-Masonry-Swimming-Pools.pdf";

export function reportLicenceUrl(licence: string): string | null {
  return /(?:Creative Commons Attribution 4\.0|CC BY 4\.0)/i.test(licence)
    ? CC_BY_4_LICENCE_URL
    : null;
}

export type ReportMapLegendEntry = {
  id: string;
  label: string;
  colour: string;
  kind: "area" | "line";
  dashed?: boolean;
  statusLabel?:
    | "Mapped"
    | "Not shown"
    | "Not reproduced"
    | "No mapped evidence"
    | "Unavailable / unknown";
};

const DETAILED_CHECK_LEGEND_KEYS = [
  "contours",
  "public_stormwater_assets",
  "wastewater_assets",
  "public_water_assets",
  "electricity_feeder_lines",
  "gas_distribution_lines",
] as const;

export function reportMapLegend(report: SavedPreliminaryReport): {
  entries: ReportMapLegendEntry[];
  excludedLayers: string[];
} {
  const isFastPropertyViewCapture =
    report.mapImageSource === "fast_property_view_capture";
  const entries: ReportMapLegendEntry[] = [
    {
      id: "property-boundary",
      ...REPORT_MAP_BASE_STYLES.boundary,
      kind: "area",
    },
    {
      id: "selected-pool",
      ...reportMapPoolStyle(report.warningState),
      // Saved fast-view images use a blue pool, independent of the assessment result.
      ...(isFastPropertyViewCapture
        ? { colour: SELECTED_POOL_MAP_STYLE.colour }
        : {}),
      kind: "area",
    },
    {
      id: "construction-envelope",
      ...REPORT_MAP_BASE_STYLES.constructionEnvelope,
      kind: "line",
    },
  ];
  if (
    isFastPropertyViewCapture &&
    report.constructability.version === 1 &&
    report.constructability.routePolicyVersion === 1 &&
    report.constructability.suggestedRoute
  ) {
    entries.push({
      id: "suggested-access-route",
      ...REPORT_MAP_BASE_STYLES.suggestedAccessRoute,
      label:
        report.constructability.route.provenance === "user-supplied"
          ? "Route supplied by user — confirm onsite"
          : REPORT_MAP_BASE_STYLES.suggestedAccessRoute.label,
      kind: "line",
    });
  }
  const seen = new Set(entries.map((entry) => entry.label));
  const excludedLayers: string[] = [];
  const visibleLayerKeys = new Set(report.mapVisibleLayerKeys ?? []);

  for (const layer of report.layers) {
    const hasMappedGeometry =
      layer.state === "returned" || layer.state === "internal_reference_only";
    if (
      !isFastPropertyViewCapture &&
      hasMappedGeometry &&
      layer.evidenceUse !== "report_allowed"
    ) {
      if (!excludedLayers.includes(layer.dataset)) {
        excludedLayers.push(layer.dataset);
      }
    }
  }

  for (const key of DETAILED_CHECK_LEGEND_KEYS) {
    const style = reportMapLayerStyle(key);
    const categoryLayers = report.layers.filter(
      (layer) => reportLayerStyle(layer).label === style.label,
    );
    const mapped = categoryLayers.some(
      (layer) =>
        (layer.state === "returned" ||
          (isFastPropertyViewCapture &&
            layer.state === "internal_reference_only")) &&
        (isFastPropertyViewCapture
          ? visibleLayerKeys.has(reportLayerKey(layer))
          : layer.evidenceUse === "report_allowed"),
    );
    const notShown =
      isFastPropertyViewCapture &&
      categoryLayers.some(
        (layer) =>
          (layer.state === "returned" ||
            layer.state === "internal_reference_only") &&
          !visibleLayerKeys.has(reportLayerKey(layer)),
      );
    const notReproduced = categoryLayers.some(
      (layer) =>
        !isFastPropertyViewCapture &&
        (layer.state === "returned" ||
          layer.state === "internal_reference_only") &&
        layer.evidenceUse !== "report_allowed",
    );
    const unavailableOrUnknown =
      categoryLayers.length === 0 ||
      categoryLayers.some(
        (layer) =>
          layer.state === "unavailable" || layer.state === "provider_error",
      );
    entries.push({
      id: key,
      label: style.label,
      colour: style.colour,
      kind: "line",
      dashed: style.dashed,
      statusLabel: mapped
        ? "Mapped"
        : notShown
          ? "Not shown"
          : notReproduced
            ? "Not reproduced"
            : unavailableOrUnknown
              ? "Unavailable / unknown"
              : "No mapped evidence",
    });
    seen.add(style.label);
  }

  for (const layer of report.layers) {
    if (
      layer.state !== "returned" ||
      (!isFastPropertyViewCapture && layer.evidenceUse !== "report_allowed") ||
      (isFastPropertyViewCapture &&
        !visibleLayerKeys.has(reportLayerKey(layer))) ||
      !shouldReproduceReportMapLayer(reportLayerKey(layer))
    ) {
      continue;
    }
    const style = reportLayerStyle(layer);
    if (seen.has(style.label)) continue;
    entries.push({
      id: layer.id ?? layer.dataset,
      label: style.label,
      colour: style.colour,
      kind: "line",
      dashed: style.dashed,
    });
    seen.add(style.label);
  }

  return { entries, excludedLayers };
}

export function reportPoolShellClearances(
  report: SavedPreliminaryReport,
): PoolShellClearance[] {
  if (
    !report.pool.clearancesVisible ||
    !hasValidPolygonRing(report.property.boundaryGeometry) ||
    !hasValidPolygonRing(report.pool.shellGeometry)
  ) {
    return [];
  }
  return calculatePoolShellClearances({
    shellGeometry: report.pool.shellGeometry,
    boundaryGeometry: report.property.boundaryGeometry,
  });
}

function reportLayerStyle(layer: SavedPreliminaryReport["layers"][number]) {
  return reportMapLayerStyle(reportLayerKey(layer));
}

function reportLayerKey(layer: SavedPreliminaryReport["layers"][number]) {
  return reportMapLayerKey(layer.id, layer.dataset);
}

export function reportWarningLabel(
  state: SavedPreliminaryReport["warningState"],
): string {
  if (state === "no_warning") return "No warning";
  if (state === "blocked") return "This pool position needs review";
  return "Needs checking";
}

export function humanizeReportValue(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatReportBoundaryArea(
  areaSquareMetres: number | null,
): string {
  return areaSquareMetres === null
    ? "Unavailable"
    : `${areaSquareMetres.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} m²`;
}

export function formatReportGeneratedAt(generatedAt: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Pacific/Auckland",
  }).format(new Date(generatedAt));
}

export type ReportConstructabilityStatus =
  "needs_checking" | "not_fully_assessed" | "no_obvious_concern";

export type ReportConstructabilitySection = {
  id: "terrain_ground" | "pool_barrier" | "access_excavation";
  title: string;
  status: ReportConstructabilityStatus;
  statusLabel:
    | "Needs checking"
    | "Not fully assessed"
    | "No obvious concern identified — confirm onsite";
  summary: string;
  details: Array<{ label: string; value: string }>;
  evidence: Array<{
    provenance:
      | "Mapped evidence"
      | "Your Site answer"
      | "Saved route analysis"
      | "Provider availability"
      | "Saved assumption";
    description: string;
  }>;
  provenanceNote: string | null;
  boundary: string;
  excavation: ReturnType<typeof reportExcavationGeometry>;
};

const ACCESS_CONDITION_LABELS: Record<string, string> = {
  gate_or_narrow_passage: "Gate or narrow passage",
  steps_or_steep_level_change: "Steps or a steep level change",
  overhead_obstacle: "Overhead wires, branches, roof or carport",
  removable_feature: "Fence, landscaping or structure that may need removal",
  other_property_access: "Possible access through another property",
  retaining_wall: "Retaining wall near the pool",
  rocky_ground: "Apparently rocky ground",
  wet_or_soft_ground: "Apparently wet or soft ground",
  none_of_these: "None of the listed conditions reported",
  not_sure: "I’m not sure",
};

const NEARBY_FEATURE_LABELS: Record<string, string> = {
  fences: "Fences",
  walls: "Walls",
  gates: "Gates",
  doors_or_windows: "Doors or windows",
  decks: "Decks",
  raised_areas: "Raised areas",
  trees_or_structures: "Trees or structures",
  none_of_these: "None of the listed nearby features reported",
  not_sure: "I’m not sure",
};

const GROUND_CONDITIONS = new Set([
  "retaining_wall",
  "rocky_ground",
  "wet_or_soft_ground",
]);

export function reportConstructabilitySections(
  report: SavedPreliminaryReport,
): ReportConstructabilitySection[] {
  const snapshot = report.constructability;
  if (snapshot.version !== 1) {
    return constructabilitySectionDefinitions().map((section) => ({
      ...section,
      status: "not_fully_assessed",
      statusLabel: "Not fully assessed",
      summary: snapshot.reason,
      details: [],
      evidence: [],
      provenanceNote: null,
      excavation: null,
    }));
  }

  const mappedEvidence = (category: string) =>
    snapshot.mappedEvidence
      .filter((item) => item.category === category)
      .map((item) => ({
        provenance: "Mapped evidence" as const,
        description: `${item.provider} — ${item.dataset}: ${mappedEvidenceLabel(item.status)}`,
      }));
  const providerEvidence = (category: string) =>
    snapshot.providerAvailability
      .filter((item) => item.category === category)
      .map((item) => ({
        provenance: "Provider availability" as const,
        description: `${item.provider} — ${item.dataset}: ${providerAvailabilityLabel(item.status)}`,
      }));
  const assumptions = snapshot.assumptions.map((description) => ({
    provenance: "Saved assumption" as const,
    description,
  }));
  const groundAnswers = snapshot.accessConditions.filter((condition) =>
    GROUND_CONDITIONS.has(condition),
  );
  const terrainEvidence = [
    ...mappedEvidence("terrain_ground"),
    ...groundAnswers.map((condition) => ({
      provenance: "Your Site answer" as const,
      description:
        ACCESS_CONDITION_LABELS[condition] ?? humanizeReportValue(condition),
    })),
    ...providerEvidence("terrain_ground"),
  ];
  const barrierEvidence = [
    ...mappedEvidence("barrier"),
    {
      provenance: "Your Site answer" as const,
      description: snapshot.nearbyFeatures
        .map(
          (condition) =>
            NEARBY_FEATURE_LABELS[condition] ?? humanizeReportValue(condition),
        )
        .join("; "),
    },
    ...providerEvidence("barrier"),
  ];
  const accessEvidence = [
    ...mappedEvidence("access_excavation"),
    {
      provenance: "Your Site answer" as const,
      description: snapshot.accessConditions
        .map(
          (condition) =>
            ACCESS_CONDITION_LABELS[condition] ??
            humanizeReportValue(condition),
        )
        .join("; "),
    },
    ...routeFactEvidence(snapshot.routeFacts),
    ...providerEvidence("access_excavation"),
    ...assumptions,
  ];

  return [
    {
      id: "terrain_ground",
      title: "Terrain and ground conditions",
      ...constructabilitySectionResult(
        snapshot,
        "terrain_ground",
        groundAnswers.length > 0,
      ),
      details: [],
      evidence: terrainEvidence,
      provenanceNote: evidenceDisagreementNote(
        snapshot,
        "terrain_ground",
        groundAnswers.length > 0,
      ),
      boundary:
        "This is preliminary terrain and ground screening, not a geotechnical assessment.",
      excavation: null,
    },
    {
      id: "pool_barrier",
      title: "Pool barrier feasibility",
      ...constructabilitySectionResult(snapshot, "barrier"),
      details: [],
      evidence: barrierEvidence,
      provenanceNote: evidenceDisagreementNote(snapshot, "barrier"),
      boundary:
        "This section reports proximity and declared nearby features only. It does not propose a barrier line or confirm barrier compliance.",
      excavation: null,
    },
    {
      id: "access_excavation",
      title: "Excavation and construction access",
      ...constructabilitySectionResult(
        snapshot,
        "access_excavation",
        snapshot.accessConditions.includes("not_sure"),
      ),
      details: [
        {
          label: "Estimated pool depth",
          value: `${snapshot.estimatedDepthMetres.toFixed(2)} m`,
        },
        {
          label: "Saved route",
          value: routeProvenanceLabel(snapshot.route.provenance),
        },
        ...routeFactDetails(snapshot.routeFacts),
      ],
      evidence: accessEvidence,
      provenanceNote: evidenceDisagreementNote(
        snapshot,
        "access_excavation",
        snapshot.userEvidence.some(
          (item) => item.category === "access_excavation",
        ),
      ),
      boundary:
        "This is preliminary access and excavation planning information, not a confirmed construction method, excavation footprint, quantity survey, spoil estimate or price estimate.",
      excavation: reportExcavationGeometry(report),
    },
  ];
}

function constructabilitySectionDefinitions() {
  return [
    {
      id: "terrain_ground" as const,
      title: "Terrain and ground conditions",
      boundary:
        "This is preliminary terrain and ground screening, not a geotechnical assessment.",
    },
    {
      id: "pool_barrier" as const,
      title: "Pool barrier feasibility",
      boundary:
        "This section reports proximity and declared nearby features only. It does not propose a barrier line or confirm barrier compliance.",
    },
    {
      id: "access_excavation" as const,
      title: "Excavation and construction access",
      boundary:
        "This is preliminary access and excavation planning information, not a confirmed construction method, excavation footprint, quantity survey, spoil estimate or price estimate.",
    },
  ];
}

function constructabilitySectionResult(
  snapshot: Extract<SavedPreliminaryReport["constructability"], { version: 1 }>,
  category: "terrain_ground" | "barrier" | "access_excavation",
  hasAdditionalUserConcern = false,
): Pick<ReportConstructabilitySection, "status" | "statusLabel" | "summary"> {
  const findings = snapshot.findings.filter(
    (finding) => finding.category === category,
  );
  const status: ReportConstructabilityStatus =
    hasAdditionalUserConcern ||
    findings.some((finding) => finding.status === "needs_checking")
      ? "needs_checking"
      : findings.some((finding) => finding.status === "not_assessed")
        ? "not_fully_assessed"
        : "no_obvious_concern";
  if (status === "needs_checking") {
    return {
      status,
      statusLabel: "Needs checking",
      summary:
        "Saved mapped evidence or a Site answer identifies a potential site consideration to confirm onsite.",
    };
  }
  if (status === "not_fully_assessed") {
    return {
      status,
      statusLabel: "Not fully assessed",
      summary:
        "Critical saved evidence or a Site answer is unavailable or uncertain, so this section is incomplete.",
    };
  }
  return {
    status,
    statusLabel: "No obvious concern identified — confirm onsite",
    summary:
      "The saved mapped evidence and Site answers identify no obvious concern. Confirm the actual conditions onsite.",
  };
}

function evidenceDisagreementNote(
  snapshot: Extract<SavedPreliminaryReport["constructability"], { version: 1 }>,
  category: "terrain_ground" | "barrier" | "access_excavation",
  hasUserConcern = snapshot.userEvidence.some(
    (item) => item.category === category,
  ),
): string | null {
  const mappedClear = snapshot.mappedEvidence.some(
    (item) => item.category === category && item.status === "no_concern",
  );
  const mappedConcern = snapshot.mappedEvidence.some(
    (item) => item.category === category && item.status === "concern",
  );
  const userClear =
    category === "barrier"
      ? snapshot.nearbyFeatures.includes("none_of_these")
      : snapshot.accessConditions.includes("none_of_these");
  return (mappedClear && hasUserConcern) || (mappedConcern && userClear)
    ? "Mapped evidence and your Site answer are both retained; neither source clears the other. Confirm the difference onsite."
    : null;
}

function mappedEvidenceLabel(status: "concern" | "no_concern" | "unavailable") {
  if (status === "concern") return "Potential site consideration";
  if (status === "no_concern")
    return "No concern identified in saved mapped check";
  return "Not assessed — data unavailable";
}

function providerAvailabilityLabel(
  status: "available" | "unavailable" | "error",
) {
  if (status === "available") return "available when assessed";
  if (status === "error") return "provider error";
  return "data unavailable";
}

function routeProvenanceLabel(
  provenance: "suggested" | "confirmed" | "user-supplied" | "uncertain",
) {
  if (provenance === "confirmed") return "Confirmed suggested route";
  if (provenance === "user-supplied")
    return "Route supplied by user — confirm onsite";
  if (provenance === "suggested") return "Suggested route — not yet confirmed";
  return "I’m not sure — no confirmed route";
}

function routeFactDetails(
  facts: Extract<
    SavedPreliminaryReport["constructability"],
    { version: 1 }
  >["routeFacts"],
): Array<{ label: string; value: string }> {
  if (!facts) return [];
  return [
    ...(facts.length.status === "assessed"
      ? [{ label: "Route length", value: `${facts.length.value.toFixed(1)} m` }]
      : []),
    ...(facts.elevationChange.status === "assessed"
      ? [
          {
            label: "Route elevation change",
            value: `${facts.elevationChange.value.toFixed(1)} m`,
          },
        ]
      : []),
    ...(facts.steepestGradient.status === "assessed"
      ? [
          {
            label: "Steepest route gradient",
            value: `${facts.steepestGradient.value.toFixed(1)}°`,
          },
        ]
      : []),
  ];
}

function routeFactEvidence(
  facts: Extract<
    SavedPreliminaryReport["constructability"],
    { version: 1 }
  >["routeFacts"],
): ReportConstructabilitySection["evidence"] {
  if (!facts) return [];
  return [
    routeBooleanEvidence("Parcel departure", facts.parcelDeparture),
    routeBooleanEvidence("Mapped building intersection", facts.buildings),
    routeBooleanEvidence("Mapped service intersection", facts.services),
    ...(facts.elevationChange.status === "not_assessed"
      ? [
          {
            provenance: "Saved route analysis" as const,
            description:
              "Route elevation change: Not assessed — data unavailable",
          },
        ]
      : []),
  ];
}

function routeBooleanEvidence(
  label: string,
  fact:
    | { status: "assessed"; value: boolean }
    | {
        status: "not_assessed";
        reason: "invalid_geometry" | "data_unavailable";
      },
): ReportConstructabilitySection["evidence"][number] {
  return {
    provenance: "Saved route analysis",
    description:
      fact.status === "assessed"
        ? `${label}: ${fact.value ? "identified" : "not identified"}`
        : `${label}: Not assessed — ${fact.reason === "invalid_geometry" ? "invalid route geometry" : "data unavailable"}`,
  };
}

export function reportExcavationGeometry(report: SavedPreliminaryReport) {
  if (
    report.constructability.version !== 1 ||
    !report.constructability.excavationGeometry
  ) {
    return null;
  }
  const geometry = report.constructability.excavationGeometry;
  const terrainUnavailable = geometry.terrainAdjustment === "unavailable";
  const sideAllowanceMillimetres = Math.round(
    geometry.sideAllowanceMetres * 1_000,
  );
  const isLegacy = geometry.version === 1;
  const isDefault = sideAllowanceMillimetres === 300;
  return {
    heading: "Illustrative excavation geometry",
    scenarios: [
      {
        id: "pool-outline" as const,
        label: "Selected pool outline",
        valueCubicMetres: geometry.poolOutlineCubicMetres,
        formattedValue: `${geometry.poolOutlineCubicMetres.toFixed(geometry.rounding.decimalPlaces)} m³`,
      },
      {
        id: isLegacy
          ? ("300mm-side-allowance" as const)
          : ("selected-side-clearance" as const),
        label: isLegacy
          ? "300 mm side-allowance scenario"
          : `${sideAllowanceMillimetres} mm selected side-clearance scenario`,
        valueCubicMetres: geometry.sideAllowanceCubicMetres,
        formattedValue: `${geometry.sideAllowanceCubicMetres.toFixed(geometry.rounding.decimalPlaces)} m³`,
      },
    ],
    assumptionId: geometry.assumptionId,
    sourceUrl: FIRTH_MASONRY_POOL_GUIDANCE_URL,
    clearanceDisclosure:
      isLegacy || isDefault
        ? "300 mm is PoolReady’s provisional Firth-derived starting point. It is not approved for the selected pool."
        : `${sideAllowanceMillimetres} mm was selected for planning. It is not approved for the selected pool; PoolReady’s provisional 300 mm starting point is Firth-derived.`,
    assumptionDisclosure:
      isLegacy || isDefault
        ? "300 mm added on each side of the selected pool outline. The provisional starting point is adapted from Firth's masonry-pool guidance, which measures from the outside masonry wall; applying it to the generic selected outline is a temporary PoolReady planning proxy, not a builder-approved construction specification."
        : `${sideAllowanceMillimetres} mm added on each side of the selected pool outline. This value was selected by the user for planning. It is not sourced from Firth or approved for the chosen pool; PoolReady's 300 mm starting point is adapted from Firth's masonry-pool guidance and must also be confirmed against the selected pool installation instructions.`,
    rangeDisclosure:
      "These are illustrative geometry scenarios, not minimum and maximum excavation quantities. The larger figure is not an upper bound, and the actual excavation may fall outside these two numbers.",
    publicDisclosure:
      "Indicative planning volumes only — not a quote, specification or upper bound. These figures use your selected side clearance but exclude base preparation, drainage, terrain, services and installation method. Confirm final excavation requirements onsite.",
    exclusions:
      "Extra base depth, masonry wall and footing dimensions, floor falls, drainage, terrain cut, battering or support, services, and installation method are not modelled.",
    terrainStatus: terrainUnavailable
      ? ("not_fully_assessed" as const)
      : ("available_separate" as const),
    terrainStatusLabel: terrainUnavailable ? "Not fully assessed" : null,
    terrainLabel: terrainUnavailable
      ? "Base geometry estimate only — terrain adjustment unavailable"
      : "Terrain information is considered separately and is not added to these geometry scenarios.",
    specialistDepthWarning: geometry.specialistDepthWarning
      ? "Specialist depth — professional confirmation required"
      : null,
  };
}

export function reportRecommendations(
  report: SavedPreliminaryReport,
): SavedPreliminaryReport["recommendations"] {
  if (report.recommendations.length > 0) return report.recommendations;
  return [
    {
      phase: "before_concept_design",
      priority: 0,
      title: "Main recommendation",
      reason: report.mainRecommendation,
    },
  ];
}
