import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import { reportMapLayerKey } from "@/modules/reporting/report-map-style";

export type AssessmentStatus = "green" | "amber" | "red" | "unknown";

export type ReportAssessmentId =
  | "pool_fit"
  | "electricity"
  | "gas"
  | "water_wastewater"
  | "stormwater"
  | "flooding_drainage"
  | "terrain"
  | "planning"
  | "pool_barrier"
  | "construction_access";

export const REPORT_ASSESSMENT_ORDER: readonly ReportAssessmentId[] = [
  "pool_fit",
  "water_wastewater",
  "stormwater",
  "flooding_drainage",
  "electricity",
  "gas",
  "terrain",
  "planning",
  "pool_barrier",
  "construction_access",
];

export type FeasibilityFinding = {
  id: string;
  category:
    | "pool_fit"
    | "electricity"
    | "gas"
    | "water"
    | "wastewater"
    | "water_wastewater"
    | "stormwater"
    | "flooding"
    | "flooding_drainage"
    | "terrain"
    | "planning"
    | "pool_barrier"
    | "construction_access"
    | "other";
  severity: AssessmentStatus;
  title: string;
  clientSummary: string;
  action?: string;
  approximateDistanceMetres?: number;
  technicalDetails?: Record<string, unknown>;
  sourceIds?: string[];
  placementFinding?: boolean;
  keyFinding?: boolean;
};

export type ReportDataSource = {
  id?: string;
  provider: string;
  dataset: string;
  sourceUrl: string | null;
  licence: string;
  attribution: string | null;
  retrievedAt: string | null;
  queryStatus?: "success" | "empty" | "unavailable" | "error";
  status: string;
  evidenceUse: string;
};

export type ReportAssessment = {
  id: ReportAssessmentId;
  title: string;
  status: AssessmentStatus;
  headline: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  technicalDetails: Array<{ label: string; value: string }>;
};

export type ReportRecommendation = {
  id: string;
  title: string;
  summary: string;
};

export type CanonicalPoolFeasibilityReport = {
  overall: {
    status: AssessmentStatus;
    headline: string;
    summary: string;
    recommendedStage: string;
  };
  assessments: Record<ReportAssessmentId, ReportAssessment>;
  keyFindings: FeasibilityFinding[];
  laterVerification: string[];
  nextSteps: ReportRecommendation[];
  sources: ReportDataSource[];
};

type ReportSource = Pick<
  PersistedAssessmentSubmission,
  | "addressEvidence"
  | "poolLayout"
  | "layerStates"
  | "warnings"
  | "recommendations"
  | "report"
>;

type ReportLayer = {
  id?: string;
  provider: string;
  dataset: string;
  evidenceUse?: string;
  state: PersistedAssessmentSubmission["layerStates"][number]["status"];
  confidence: string;
  attribution: string | null;
  sourceUrl: string | null;
};

const ASSESSMENT_TITLES: Record<ReportAssessmentId, string> = {
  pool_fit: "Pool fit",
  electricity: "Electricity",
  gas: "Gas",
  water_wastewater: "Water & wastewater",
  stormwater: "Stormwater",
  flooding_drainage: "Flooding & drainage",
  terrain: "Terrain",
  planning: "Planning",
  pool_barrier: "Pool safety barrier",
  construction_access: "Construction access",
};

const LATER_VERIFICATION = [
  "Current title and registered easements",
  "Exact underground service positions and depths",
  "Geotechnical and groundwater conditions",
  "Detailed construction access",
  "Final structural design",
  "Final consent and approval requirements",
];

export function buildCanonicalPoolFeasibilityReport(
  submission: ReportSource,
  layers: ReportLayer[],
): CanonicalPoolFeasibilityReport {
  const sources = reportSources(submission, layers);
  const findings = buildFindings(submission, sources);
  const overallStatus = overallStatusFor(submission, findings);
  const keyFindings = selectKeyFindings(findings, overallStatus);

  return {
    overall: buildOverall(overallStatus, keyFindings),
    assessments: buildAssessments(submission, layers, findings),
    keyFindings,
    laterVerification: [...LATER_VERIFICATION],
    nextSteps: buildNextSteps(keyFindings, overallStatus),
    sources,
  };
}

function buildFindings(
  submission: ReportSource,
  sources: ReportDataSource[],
): FeasibilityFinding[] {
  const reportData = submission.report.reportData;
  const placementLayerFindings = reportData.placementLayerFindings ?? [];
  const placementFindings: FeasibilityFinding[] = placementLayerFindings.map(
    (finding) => ({
      id: `placement_layer:${finding.key}`,
      category: finding.category,
      severity: finding.status === "potential_constraint" ? "red" : "amber",
      title: clientFindingTitle(
        finding.category,
        `${finding.dataset} affects the proposed pool position`,
      ),
      clientSummary:
        finding.status === "potential_constraint"
          ? `The selected pool layout overlaps reliable mapped ${finding.dataset.toLowerCase()} infrastructure.`
          : `The selected pool layout overlaps mapped ${finding.dataset.toLowerCase()} infrastructure that needs position confirmation.`,
      placementFinding: true,
      keyFinding:
        finding.category === "electricity" || finding.category === "gas",
    }),
  );
  const riskFindings: FeasibilityFinding[] = reportData.risks
    .filter((risk) => !isNormalLaterVerificationRisk(risk))
    .map((risk) => {
      const category = findingCategory(risk);
      return {
        id: risk.id,
        category,
        severity: riskSeverity(risk.severity),
        title: clientFindingTitle(category, risk.title),
        clientSummary: clientFindingSummary(category, risk.evidence),
        action: risk.action,
        technicalDetails: {
          source: risk.source,
          confidence: risk.confidence,
        },
        sourceIds: sources
          .filter((source) => risk.source.includes(source.provider))
          .map((source) => source.id ?? source.dataset),
      } satisfies FeasibilityFinding;
    });
  const warning = submission.warnings[0];
  const aggregatePlacementFinding =
    placementFindings.length > 0
      ? {
          id: "pool_position_review",
          category: "pool_fit" as const,
          severity: placementFindings.some(
            (finding) => finding.severity === "red",
          )
            ? ("red" as const)
            : ("amber" as const),
          title:
            submission.report.feasibilityState === "blocked"
              ? "Pool position needs review"
              : "Pool position requires checking",
          clientSummary: warning?.message ?? submission.report.summary,
          action: reportData.recommendation,
        }
      : null;
  const findings = [
    ...(aggregatePlacementFinding ? [aggregatePlacementFinding] : []),
    ...riskFindings,
    ...placementFindings,
  ];

  if (
    findings.length === 0 &&
    submission.report.feasibilityState !== "no_warning"
  ) {
    findings.push({
      id: warning?.code ?? "pool_position_review",
      category: "pool_fit",
      severity:
        submission.report.feasibilityState === "blocked" ? "red" : "amber",
      title:
        submission.report.feasibilityState === "blocked"
          ? "Pool position needs review"
          : "Pool position requires checking",
      clientSummary: warning?.message ?? submission.report.summary,
      action: reportData.recommendation,
    });
  }

  return findings;
}

function overallStatusFor(
  submission: ReportSource,
  findings: FeasibilityFinding[],
): AssessmentStatus {
  if (!hasCriticalPropertyAndPoolGeometry(submission)) {
    return "unknown";
  }
  if (submission.report.feasibilityState === "blocked") return "red";
  if (
    submission.report.feasibilityState === "needs_checking" ||
    findings.some(
      (finding) => finding.severity === "red" || finding.severity === "amber",
    )
  ) {
    return "amber";
  }
  return "green";
}

function buildOverall(
  status: AssessmentStatus,
  keyFindings: FeasibilityFinding[],
): CanonicalPoolFeasibilityReport["overall"] {
  const lead = keyFindings[0];
  if (status === "unknown") {
    return {
      status,
      headline: "Assessment incomplete",
      summary:
        "The available property information is insufficient to provide a useful preliminary assessment.",
      recommendedStage: "Confirm property information",
    };
  }
  if (status === "red") {
    return {
      status,
      headline: "Potential Constraint",
      summary: lead
        ? `${lead.clientSummary} Review this issue before progressing with the current pool layout.`
        : "A significant mapped constraint may affect the proposed pool location. Review the identified issue before progressing with this layout.",
      recommendedStage: "Review pool position",
    };
  }
  if (status === "amber") {
    return {
      status,
      headline: "Further investigation required",
      summary: lead
        ? `The proposed pool appears worth progressing, but ${lowercaseFirst(lead.clientSummary)}`
        : "The proposed pool appears feasible, but one or more mapped conditions should be investigated before the position is finalised.",
      recommendedStage: "Site verification",
    };
  }
  return {
    status,
    headline: "Appears suitable",
    summary:
      "No major mapped constraint has been identified for the proposed pool location. Site verification and detailed design are still required before construction.",
    recommendedStage: "Site verification",
  };
}

function buildAssessments(
  submission: ReportSource,
  layers: ReportLayer[],
  findings: FeasibilityFinding[],
): CanonicalPoolFeasibilityReport["assessments"] {
  const poolStatus: AssessmentStatus = !hasCriticalPropertyAndPoolGeometry(
    submission,
  )
    ? "unknown"
    : submission.report.feasibilityState === "blocked"
      ? "red"
      : submission.report.feasibilityState === "needs_checking"
        ? "amber"
        : "green";

  return {
    pool_fit: assessment({
      id: "pool_fit",
      status: poolStatus,
      summary:
        poolStatus === "green"
          ? "The proposed pool fits within the mapped property area and no major mapped overlap has been identified."
          : poolStatus === "unknown"
            ? "The mapped property area could not be confirmed, so pool fit has not been assessed."
            : submission.report.summary,
      details: [
        {
          label: "Selected pool",
          value: `${formatNumber(submission.poolLayout.lengthMetres)} m x ${formatNumber(submission.poolLayout.widthMetres)} m`,
        },
        ...(submission.addressEvidence.boundaryAreaSquareMetres
          ? [
              {
                label: "Mapped property area",
                value: `Approx. ${Math.round(submission.addressEvidence.boundaryAreaSquareMetres).toLocaleString("en-NZ")} m²`,
              },
            ]
          : []),
      ],
      technicalDetails: submission.addressEvidence.parcelIdentifier
        ? [
            {
              label: "Parcel identifier",
              value: submission.addressEvidence.parcelIdentifier,
            },
          ]
        : [],
    }),
    water_wastewater: layerAssessment({
      id: "water_wastewater",
      layers,
      findings,
      keys: [
        "wastewater_assets",
        "public_water_assets",
        "wastewater_manholes",
        "water_fittings",
        "wastewater_fittings",
      ],
      findingCategories: ["water", "wastewater", "water_wastewater"],
      clearSummary:
        "No major mapped water or wastewater conflict was identified for the proposed pool area.",
      unknownSummary:
        "Water and wastewater information could not be fully assessed from the currently available mapped data.",
    }),
    stormwater: layerAssessment({
      id: "stormwater",
      layers,
      findings,
      keys: [
        "public_stormwater_assets",
        "manholes",
        "catchpits",
        "watercourses",
        "culverts",
      ],
      findingCategories: ["stormwater"],
      clearSummary:
        "No major mapped stormwater conflict was identified for the proposed pool area.",
      unknownSummary:
        "Stormwater information could not be fully assessed from the currently available mapped data.",
    }),
    electricity: layerAssessment({
      id: "electricity",
      layers,
      findings,
      keys: ["electricity_feeder_lines"],
      findingCategories: ["electricity"],
      clearSummary:
        "No mapped electricity conflict was identified for the proposed pool area.",
      unknownSummary:
        "Electricity information could not be fully assessed from the currently available mapped data.",
    }),
    gas: layerAssessment({
      id: "gas",
      layers,
      findings,
      keys: ["gas_distribution_lines"],
      findingCategories: ["gas"],
      clearSummary:
        "No mapped gas conflict was identified for the proposed pool area.",
      unknownSummary:
        "Gas information could not be fully assessed from the currently available mapped data.",
    }),
    flooding_drainage: layerAssessment({
      id: "flooding_drainage",
      layers,
      findings,
      keys: ["flood_plains", "flood_prone_areas", "overland_flow_paths"],
      findingCategories: ["flooding", "flooding_drainage"],
      clearSummary:
        "No mapped flood or overland-flow conflict was identified at the proposed pool location.",
      unknownSummary:
        "Flooding and drainage information could not be fully assessed from the currently available mapped data.",
    }),
    terrain: layerAssessment({
      id: "terrain",
      layers,
      findings,
      keys: ["contours"],
      findingCategories: ["terrain"],
      clearSummary:
        "No major terrain issue was identified from the available mapped elevation information.",
      unknownSummary:
        "Terrain could not be reliably assessed from the currently available mapped information.",
    }),
    planning: layerAssessment({
      id: "planning",
      layers,
      findings,
      keys: ["planning_zone", "planning_overlays"],
      findingCategories: ["planning"],
      clearSummary:
        "No major mapped planning constraint was identified for the proposed pool area.",
      unknownSummary:
        "Planning constraints could not be fully assessed from the currently available mapped information.",
    }),
    pool_barrier: assessment({
      id: "pool_barrier",
      status: "amber",
      summary:
        "A compliant residential pool barrier will be required. Existing fences, walls, gates and building openings must be verified before they are relied upon.",
      details: [],
      technicalDetails: [],
    }),
    construction_access: assessment({
      id: "construction_access",
      status: "unknown",
      summary:
        "Construction equipment access cannot be reliably confirmed from the available desktop information.",
      details: [],
      technicalDetails: [],
    }),
  };
}

function layerAssessment(input: {
  id: ReportAssessmentId;
  layers: ReportLayer[];
  findings: FeasibilityFinding[];
  keys: string[];
  findingCategories: FeasibilityFinding["category"][];
  clearSummary: string;
  unknownSummary: string;
}): ReportAssessment {
  const relevantLayers = input.layers.filter((layer) =>
    input.keys.includes(reportMapLayerKey(layer.id, layer.dataset)),
  );
  const categoryFindings = input.findings
    .filter((finding) => input.findingCategories.includes(finding.category))
    .sort(
      (left, right) =>
        statusPriority(right.severity) - statusPriority(left.severity),
    );
  const strongest =
    categoryFindings.find((finding) => finding.placementFinding) ??
    categoryFindings[0];
  const hasUsableEvidence = relevantLayers.some((layer) =>
    ["returned", "empty", "internal_reference_only"].includes(layer.state),
  );
  const status =
    strongest?.severity ?? (hasUsableEvidence ? "green" : "unknown");
  return assessment({
    id: input.id,
    status,
    summary:
      strongest?.clientSummary ??
      (status === "green" ? input.clearSummary : input.unknownSummary),
    details: strongest?.approximateDistanceMetres
      ? [
          {
            label: "Approximate mapped distance",
            value: `${formatNumber(strongest.approximateDistanceMetres)} m`,
          },
        ]
      : [],
    technicalDetails: relevantLayers.map((layer) => ({
      label: layer.dataset,
      value: `${layer.provider} - ${technicalLayerState(layer.state)}`,
    })),
  });
}

function assessment(
  input: Omit<ReportAssessment, "title" | "headline">,
): ReportAssessment {
  return {
    ...input,
    title: ASSESSMENT_TITLES[input.id],
    headline: assessmentHeadline(input.status),
  };
}

function selectKeyFindings(
  findings: FeasibilityFinding[],
  overallStatus: AssessmentStatus,
): FeasibilityFinding[] {
  const material = [...findings]
    .filter(
      (finding) => finding.severity !== "green" && finding.keyFinding !== false,
    )
    .sort(
      (left, right) =>
        statusPriority(right.severity) - statusPriority(left.severity),
    )
    .slice(0, 3);
  if (material.length > 0) return material;
  if (overallStatus !== "green") return [];
  return [
    {
      id: "no_major_mapped_issue",
      category: "pool_fit",
      severity: "green",
      title: "No major mapped issue identified",
      clientSummary:
        "The proposed pool location appears worth progressing to site verification and detailed design.",
    },
  ];
}

function buildNextSteps(
  keyFindings: FeasibilityFinding[],
  overallStatus: AssessmentStatus,
): ReportRecommendation[] {
  if (overallStatus === "unknown") {
    return [
      {
        id: "confirm_property_information",
        title: "Confirm the property information",
        summary:
          "Confirm the correct parcel boundary and proposed pool position before the assessment is repeated.",
      },
    ];
  }
  const steps: ReportRecommendation[] = [];
  for (const finding of keyFindings) {
    if (finding.severity === "green") continue;
    steps.push({
      id: `finding:${finding.id}`,
      title: recommendationTitle(finding.category),
      summary:
        finding.action ??
        "Review this mapped condition before the pool position is finalised.",
    });
  }
  steps.push(
    {
      id: "review_title",
      title: "Review title and easements",
      summary:
        "Confirm whether registered interests affect the proposed pool area.",
    },
    {
      id: "verify_site_conditions",
      title: "Verify site conditions",
      summary:
        "Confirm ground conditions, retaining requirements, underground services and construction access onsite.",
    },
    {
      id: "finalise_barrier",
      title: "Finalise the pool barrier layout",
      summary:
        "Confirm fencing, gate locations and applicable pool safety requirements.",
    },
    {
      id: "confirm_approvals",
      title: "Confirm approvals",
      summary:
        "Determine final consent and approval requirements once the design is finalised.",
    },
  );
  return uniqueBy(steps, (step) => step.title).slice(0, 6);
}

function reportSources(
  submission: ReportSource,
  layers: ReportLayer[],
): ReportDataSource[] {
  const reportData = submission.report.reportData;
  const visibleLayerKeys = new Set(reportData.mapVisibleLayerKeys ?? []);
  const capturedLayerSources = new Set(
    reportData.mapImageSource === "fast_property_view_capture"
      ? layers
          .filter((layer) =>
            visibleLayerKeys.has(reportMapLayerKey(layer.id, layer.dataset)),
          )
          .map((layer) => `${layer.provider}|${layer.dataset}`)
      : [],
  );
  const sources: ReportDataSource[] = reportData.provenance.datasets
    .filter(
      (dataset) =>
        dataset.evidenceUse === "report_allowed" ||
        dataset.evidenceUse === "unavailable" ||
        capturedLayerSources.has(`${dataset.provider}|${dataset.dataset}`),
    )
    .map((dataset) => ({
      id: dataset.id,
      provider: dataset.provider,
      dataset: dataset.dataset,
      sourceUrl: dataset.attribution?.url ?? null,
      licence: dataset.licence,
      attribution: dataset.attribution?.text ?? null,
      retrievedAt: dataset.retrievedAt,
      queryStatus: sourceStatus(
        dataset.status,
        layers.find((layer) => layer.id === dataset.id)?.state,
      ),
      status: dataset.status,
      evidenceUse: dataset.evidenceUse,
    }));
  for (const layer of layers) {
    if (
      layer.state === "internal_reference_only" &&
      !capturedLayerSources.has(`${layer.provider}|${layer.dataset}`)
    ) {
      continue;
    }
    if (!layer.attribution && !layer.sourceUrl) continue;
    if (
      sources.some(
        (source) =>
          source.provider === layer.provider &&
          source.dataset === layer.dataset,
      )
    ) {
      continue;
    }
    sources.push({
      provider: layer.provider,
      dataset: layer.dataset,
      sourceUrl: layer.sourceUrl,
      licence: "Licence recorded with the saved source metadata.",
      attribution: layer.attribution,
      retrievedAt: null,
      queryStatus: sourceStatus(layer.state),
      status: layer.state,
      evidenceUse: "saved_layer",
    });
  }
  return sources;
}

function findingCategory(
  risk: PersistedAssessmentSubmission["report"]["reportData"]["risks"][number],
): FeasibilityFinding["category"] {
  const value = `${risk.id} ${risk.category} ${risk.title}`.toLowerCase();
  if (/stormwater|catchpit|watercourse|culvert/.test(value))
    return "stormwater";
  if (/flood|overland flow|drainage/.test(value)) return "flooding";
  if (/electricity|electric/.test(value)) return "electricity";
  if (/gas distribution|\bgas\b/.test(value)) return "gas";
  if (/wastewater|sewer/.test(value)) return "wastewater";
  if (
    /watercare|public water|water main|underground service|infrastructure/.test(
      value,
    )
  )
    return "water";
  if (/terrain|slope|retaining|elevation/.test(value)) return "terrain";
  if (/planning|heritage|ecological|overlay|zone/.test(value))
    return "planning";
  if (/barrier|fenc|gate/.test(value)) return "pool_barrier";
  if (/access|equipment/.test(value)) return "construction_access";
  if (/parcel|property|pool|building|space|candidate/.test(value))
    return "pool_fit";
  return "other";
}

function isNormalLaterVerificationRisk(
  risk: PersistedAssessmentSubmission["report"]["reportData"]["risks"][number],
) {
  return (
    risk.id === "unverified_legal_and_site_information" ||
    /legal interests and site conditions remain unverified/i.test(risk.title)
  );
}

function clientFindingTitle(
  category: FeasibilityFinding["category"],
  fallback: string,
): string {
  const titles: Partial<Record<FeasibilityFinding["category"], string>> = {
    electricity: "Electricity infrastructure near the proposed pool",
    gas: "Gas infrastructure near the proposed pool",
    water: "Mapped water infrastructure requires checking",
    wastewater: "Wastewater infrastructure near the proposed pool",
    water_wastewater: "Water and wastewater infrastructure requires checking",
    stormwater: "Stormwater infrastructure requires checking",
    flooding: "Mapped flooding or drainage constraint",
    flooding_drainage: "Mapped flooding or drainage constraint",
    terrain: "Terrain conditions require checking",
    planning: "Mapped planning constraint",
    pool_fit: "Pool position needs review",
    pool_barrier: "Pool barrier design required",
    construction_access: "Construction access requires a site check",
  };
  return titles[category] ?? fallback;
}

function clientFindingSummary(
  category: FeasibilityFinding["category"],
  evidence: string,
): string {
  if (
    category === "water" ||
    category === "wastewater" ||
    category === "water_wastewater"
  ) {
    return "Mapped water or wastewater infrastructure may affect the proposed pool position and should be checked before the layout is finalised.";
  }
  if (category === "stormwater") {
    return "Mapped stormwater infrastructure may affect the proposed pool area and should be considered during detailed design.";
  }
  if (category === "electricity") {
    return "Mapped electricity infrastructure may affect the proposed pool position and should be verified before the layout is finalised.";
  }
  if (category === "gas") {
    return "Mapped gas infrastructure may affect the proposed pool position and should be verified before the layout is finalised.";
  }
  if (category === "flooding" || category === "flooding_drainage") {
    return "A mapped flooding or drainage condition may affect the proposed pool position and requires further review.";
  }
  if (category === "terrain") {
    return "Mapped terrain information indicates that excavation or retaining may need consideration during detailed design.";
  }
  if (category === "planning") {
    return "A mapped planning condition may affect the proposed pool and should be confirmed before design is finalised.";
  }
  return evidence;
}

function riskSeverity(severity: "low" | "medium" | "high"): AssessmentStatus {
  if (severity === "high") return "red";
  if (severity === "medium") return "amber";
  return "green";
}

export function assessmentHeadline(status: AssessmentStatus): string {
  if (status === "green") return "Appears suitable";
  if (status === "amber") return "Further investigation required";
  if (status === "red") return "Potential Constraint";
  return "Not assessed";
}

export function assessmentStatusLabel(status: AssessmentStatus): string {
  return assessmentHeadline(status);
}

export function reportShortStatus(status: AssessmentStatus): string {
  return assessmentHeadline(status);
}

export function formatReportNumber(value: number): string {
  return value.toLocaleString("en-NZ", { maximumFractionDigits: 1 });
}

export function reportAddressSlug(address: string): string {
  return (
    address
      .split(",")[0]
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || ""
  ).slice(0, 64);
}

function recommendationTitle(category: FeasibilityFinding["category"]): string {
  if (
    category === "water" ||
    category === "wastewater" ||
    category === "water_wastewater"
  ) {
    return "Verify water and wastewater infrastructure";
  }
  if (category === "stormwater") return "Verify stormwater infrastructure";
  if (category === "electricity") return "Verify electricity infrastructure";
  if (category === "gas") return "Verify gas infrastructure";
  if (category === "flooding" || category === "flooding_drainage") {
    return "Review flooding and drainage";
  }
  if (category === "terrain") return "Verify terrain and ground conditions";
  if (category === "planning") return "Confirm planning requirements";
  if (category === "pool_barrier") return "Finalise the pool barrier layout";
  if (category === "construction_access") return "Confirm construction access";
  return "Confirm the pool position";
}

function sourceStatus(
  status: string,
  layerState?: ReportLayer["state"],
): ReportDataSource["queryStatus"] {
  if (layerState === "empty") return "empty";
  if (
    status === "success" ||
    status === "available" ||
    status === "returned" ||
    status === "internal_reference_only"
  )
    return "success";
  if (status === "error" || status === "provider_error") return "error";
  return "unavailable";
}

function technicalLayerState(state: ReportLayer["state"]): string {
  if (state === "returned" || state === "internal_reference_only") {
    return "mapped information available";
  }
  if (state === "empty") return "no mapped feature returned";
  return "not available for this assessment";
}

function statusPriority(status: AssessmentStatus): number {
  if (status === "red") return 4;
  if (status === "amber") return 3;
  if (status === "unknown") return 2;
  return 1;
}

const formatNumber = formatReportNumber;

function lowercaseFirst(value: string): string {
  return value ? `${value[0]?.toLowerCase()}${value.slice(1)}` : value;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function hasCriticalPropertyAndPoolGeometry(submission: ReportSource): boolean {
  return (
    submission.addressEvidence.boundaryStatus !== "unavailable" &&
    isUsableAreaGeometry(submission.addressEvidence.boundaryGeometry) &&
    isUsableAreaGeometry(submission.poolLayout.shellGeometry) &&
    isUsableAreaGeometry(submission.poolLayout.constructionEnvelopeGeometry) &&
    isUsableMapPosition(submission.poolLayout.position)
  );
}

function isUsableAreaGeometry(geometry: unknown): boolean {
  if (!geometry || typeof geometry !== "object") return false;
  const candidate = geometry as { type?: unknown; coordinates?: unknown };
  if (candidate.type === "Polygon") {
    return isUsablePolygonCoordinates(candidate.coordinates);
  }
  if (
    candidate.type === "MultiPolygon" &&
    Array.isArray(candidate.coordinates)
  ) {
    return candidate.coordinates.some(isUsablePolygonCoordinates);
  }
  return false;
}

function isUsablePolygonCoordinates(coordinates: unknown): boolean {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  const outerRing = coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 4) return false;
  const positions = outerRing.filter(isMapPosition);
  if (positions.length !== outerRing.length) return false;
  const first = positions[0];
  const last = positions.at(-1);
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    return false;
  }
  let doubledArea = 0;
  for (let index = 0; index < positions.length - 1; index += 1) {
    const current = positions[index]!;
    const next = positions[index + 1]!;
    doubledArea += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(doubledArea) > Number.EPSILON;
}

function isUsableMapPosition(value: unknown): boolean {
  return (
    isMapPosition(value) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function isMapPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}
