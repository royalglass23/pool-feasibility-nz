import { z } from "zod";
import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import type { ReportAudience } from "@/modules/assessment/report-audience";

export type StaffFeasibilityState =
  PersistedAssessmentSubmission["report"]["feasibilityState"];

export const staffFeasibilityLabels: Record<
  StaffFeasibilityState,
  "No Warning" | "Needs Checking" | "Blocked"
> = {
  no_warning: "No Warning",
  needs_checking: "Needs Checking",
  blocked: "Blocked",
};

const staffDeliveryStateSchema = z.enum([
  "pending",
  "sending",
  "sent",
  "failed",
]);

export type StaffDeliveryState = z.infer<typeof staffDeliveryStateSchema>;

export function parseStaffDeliveryState(input: unknown): StaffDeliveryState {
  return staffDeliveryStateSchema.parse(input);
}

export type StaffAssessmentSummary = {
  id: string;
  reference: string;
  homeownerName: string;
  homeownerPhone: string;
  homeownerAddress: string;
  desiredTiming: PersistedAssessmentSubmission["homeowner"]["desiredTiming"];
  feasibilityState: StaffFeasibilityState;
  createdAt: Date;
  poolLayout: Pick<
    PersistedAssessmentSubmission["poolLayout"],
    "lengthMetres" | "widthMetres" | "rotationDegrees"
  >;
  evidenceCount: number;
};

export type StaffAssessmentRecord = {
  id: string;
  reference: string;
  status: string;
  homeownerName: string;
  homeownerPhone: string;
  homeownerEmail: string;
  homeownerAddress: string;
  builderCompanyName: string | null;
  visitorType: PersistedAssessmentSubmission["homeowner"]["visitorType"] | null;
  visitorTypeOtherDetail: string | null;
  reportAudience: ReportAudience;
  desiredTiming: PersistedAssessmentSubmission["homeowner"]["desiredTiming"];
  desiredTimingOtherDetail: string | null;
  additionalInfo: string | null;
  boundaryStatus: PersistedAssessmentSubmission["addressEvidence"]["boundaryStatus"];
  feasibilityState: StaffFeasibilityState;
  emailDeliveryState: StaffDeliveryState;
  forwardingState: StaffDeliveryState;
  createdAt: Date;
};

export type StaffAssessmentDetail = StaffAssessmentRecord & {
  report: SavedPreliminaryReport;
  constructabilityEvidence: StaffConstructabilityEvidence;
};

type ConstructabilitySnapshot = Extract<
  SavedPreliminaryReport["constructability"],
  { version: 1 }
>;

type DisplayStatus = {
  value:
    | ConstructabilitySnapshot["overallStatus"]
    | ConstructabilitySnapshot["sectionStatus"];
  label: string;
};

type EvidenceCategory =
  ConstructabilitySnapshot["mappedEvidence"][number]["category"];

export type StaffEvidenceSourceRow = {
  category: string;
  provider: string;
  dataset: string;
  status: string;
};

export type StaffConstructabilityEvidence =
  | {
      status: "not_assessed";
      reason: string;
    }
  | {
      status: "captured";
      estimatedDepth: string;
      overallStatus: DisplayStatus;
      sectionStatus: DisplayStatus;
      siteAnswers: {
        accessConditions: string[];
        nearbyFeatures: string[];
      };
      route: {
        response: string;
        provenance: ConstructabilitySnapshot["route"]["provenance"];
        points: Array<{ label: string; coordinate: string }>;
      };
      routeFacts: Array<{ label: string; value: string }>;
      excavation:
        | { status: "not_assessed"; reason: string }
        | {
            status: "captured";
            scenarios: Array<{ label: string; value: string }>;
            assumption: string;
            sideAllowance: string;
            terrain: string;
          };
      assumptions: string[];
      providerAvailability: StaffEvidenceSourceRow[];
      mappedEvidence: StaffEvidenceSourceRow[];
      userEvidence: Array<{ category: string; evidence: string }>;
      findings: Array<{
        category: string;
        source: string;
        evidence: string;
        status: string;
      }>;
    };

const ACCESS_CONDITION_LABELS: Record<
  ConstructabilitySnapshot["accessConditions"][number],
  string
> = {
  gate_or_narrow_passage: "Gate or narrow passage",
  steps_or_steep_level_change: "Steps or a steep level change",
  overhead_obstacle: "Overhead wires, branches, roof or carport",
  removable_feature: "Fence, landscaping or structure that may need removal",
  other_property_access: "Possible access through another property",
  retaining_wall: "Retaining wall near the pool",
  rocky_ground: "Apparently rocky ground",
  wet_or_soft_ground: "Apparently wet or soft ground",
  none_of_these: "None of these",
  not_sure: "I’m not sure",
};

const NEARBY_FEATURE_LABELS: Record<
  ConstructabilitySnapshot["nearbyFeatures"][number],
  string
> = {
  fences: "Fences",
  walls: "Walls",
  gates: "Gates",
  doors_or_windows: "Doors or windows",
  decks: "Decks",
  raised_areas: "Raised areas",
  trees_or_structures: "Trees or structures",
  none_of_these: "None of these",
  not_sure: "I’m not sure",
};

export function projectStaffConstructabilityEvidence(
  snapshot: SavedPreliminaryReport["constructability"],
): StaffConstructabilityEvidence {
  if (snapshot.version !== 1) {
    return { status: "not_assessed", reason: snapshot.reason };
  }

  const excavation = snapshot.excavationGeometry;
  const sideAllowanceMillimetres = excavation
    ? Math.round(excavation.sideAllowanceMetres * 1_000)
    : null;
  return {
    status: "captured",
    estimatedDepth: `${snapshot.estimatedDepthMetres.toFixed(2)} m`,
    overallStatus: statusLabel(snapshot.overallStatus),
    sectionStatus: statusLabel(snapshot.sectionStatus),
    siteAnswers: {
      accessConditions: snapshot.accessConditions.map(
        (value) => ACCESS_CONDITION_LABELS[value] ?? humanize(value),
      ),
      nearbyFeatures: snapshot.nearbyFeatures.map(
        (value) => NEARBY_FEATURE_LABELS[value] ?? humanize(value),
      ),
    },
    route: {
      response: routeResponse(snapshot.route.provenance),
      provenance: snapshot.route.provenance,
      points: projectRoutePoints(snapshot.route.geometry),
    },
    routeFacts: projectRouteFacts(snapshot.routeFacts),
    excavation: excavation
      ? {
          status: "captured",
          scenarios: [
            {
              label: "Selected pool outline",
              value: `${excavation.poolOutlineCubicMetres.toFixed(excavation.rounding.decimalPlaces)} m³`,
            },
            {
              label:
                excavation.version === 1
                  ? "300 mm side-allowance scenario"
                  : `${sideAllowanceMillimetres} mm selected side-clearance scenario`,
              value: `${excavation.sideAllowanceCubicMetres.toFixed(excavation.rounding.decimalPlaces)} m³`,
            },
          ],
          assumption: excavation.assumptionId,
          sideAllowance: `${Math.round(excavation.sideAllowanceMetres * 1_000)} mm each side`,
          terrain:
            excavation.terrainAdjustment === "unavailable"
              ? "Base geometry estimate only — terrain adjustment unavailable"
              : "Terrain information saved separately",
        }
      : {
          status: "not_assessed",
          reason: "Excavation geometry was not captured for this assessment.",
        },
    assumptions: snapshot.assumptions,
    providerAvailability: snapshot.providerAvailability.map((item) => ({
      category: categoryLabel(item.category),
      provider: item.provider,
      dataset: item.dataset,
      status: providerStatusLabel(item.status),
    })),
    mappedEvidence: snapshot.mappedEvidence.map((item) => ({
      category: categoryLabel(item.category),
      provider: item.provider,
      dataset: item.dataset,
      status: mappedStatusLabel(item.status),
    })),
    userEvidence: snapshot.userEvidence.map((item) => ({
      category: categoryLabel(item.category),
      evidence: userEvidenceLabel(item.condition),
    })),
    findings: snapshot.findings.map((item) => ({
      category: categoryLabel(item.category),
      source: findingSourceLabel(item.source),
      evidence: item.label,
      status:
        item.status === "needs_checking"
          ? "Potential site consideration — Needs checking"
          : "Not assessed — data unavailable or uncertain",
    })),
  };
}

function projectRoutePoints(
  geometry: ConstructabilitySnapshot["route"]["geometry"],
): Array<{ label: string; coordinate: string }> {
  if (!geometry) return [];
  return geometry.coordinates.map(([longitude, latitude], index, points) => ({
    label:
      index === 0
        ? "Start"
        : index === points.length - 1
          ? "Pool area"
          : `Turning point ${index}`,
    coordinate: `${longitude.toFixed(6)}, ${latitude.toFixed(6)}`,
  }));
}

function projectRouteFacts(
  facts: ConstructabilitySnapshot["routeFacts"],
): Array<{ label: string; value: string }> {
  if (!facts) {
    return [
      "Approximate length",
      "Elevation change",
      "Steepest mapped gradient",
      "Parcel departure",
      "Mapped building intersection",
      "Mapped service intersection or close approach",
    ].map((label) => ({
      label,
      value: "Not assessed — no saved route analysis",
    }));
  }
  const measured = (
    fact:
      | { status: "assessed"; value: number }
      | { status: "not_assessed"; reason: string },
    unit: string,
  ) =>
    fact.status === "assessed"
      ? `${fact.value.toFixed(1)} ${unit}`
      : unavailableFact(fact.reason);
  const identified = (
    fact:
      | { status: "assessed"; value: boolean }
      | { status: "not_assessed"; reason: string },
  ) =>
    fact.status === "assessed"
      ? fact.value
        ? "Identified"
        : "Not identified"
      : unavailableFact(fact.reason);
  return [
    { label: "Approximate length", value: measured(facts.length, "m") },
    {
      label: "Elevation change",
      value: measured(facts.elevationChange, "m"),
    },
    {
      label: "Steepest mapped gradient",
      value: measured(facts.steepestGradient, "°"),
    },
    { label: "Parcel departure", value: identified(facts.parcelDeparture) },
    {
      label: "Mapped building intersection",
      value: identified(facts.buildings),
    },
    {
      label: "Mapped service intersection or close approach",
      value: identified(facts.services),
    },
  ];
}

function unavailableFact(reason: string) {
  return reason === "invalid_geometry"
    ? "Not assessed — invalid route geometry"
    : "Not assessed — data unavailable";
}

function routeResponse(
  provenance: ConstructabilitySnapshot["route"]["provenance"],
) {
  const labels: Record<typeof provenance, string> = {
    confirmed: "Confirmed suggested route",
    "user-supplied": "Route supplied by user — confirm onsite",
    suggested: "Suggested route — not confirmed",
    uncertain: "I’m not sure — no confirmed route",
  };
  return labels[provenance];
}

function statusLabel(
  value:
    | ConstructabilitySnapshot["overallStatus"]
    | ConstructabilitySnapshot["sectionStatus"],
): DisplayStatus {
  const labels: Record<typeof value, string> = {
    needs_checking: "Needs checking",
    not_fully_assessed: "Not fully assessed",
    not_assessed: "Not assessed",
    no_obvious_concern: "No obvious concern identified — confirm onsite",
  };
  return {
    value,
    label: labels[value],
  };
}

function categoryLabel(value: EvidenceCategory) {
  const labels: Record<EvidenceCategory, string> = {
    terrain_ground: "Terrain and ground conditions",
    barrier: "Pool barrier feasibility",
    access_excavation: "Excavation and construction access",
  };
  return labels[value];
}

function providerStatusLabel(
  value: ConstructabilitySnapshot["providerAvailability"][number]["status"],
) {
  const labels: Record<typeof value, string> = {
    available: "Available when assessed",
    error: "Not assessed — provider error",
    unavailable: "Not assessed — data unavailable",
  };
  return labels[value];
}

function mappedStatusLabel(
  value: ConstructabilitySnapshot["mappedEvidence"][number]["status"],
) {
  const labels: Record<typeof value, string> = {
    concern: "Potential site consideration",
    no_concern: "No concern identified in saved mapped check",
    unavailable: "Not assessed — data unavailable",
  };
  return labels[value];
}

function findingSourceLabel(
  value: ConstructabilitySnapshot["findings"][number]["source"],
) {
  const labels: Record<typeof value, string> = {
    mapped: "Mapped",
    user: "User",
    provider: "Provider",
  };
  return labels[value];
}

function userEvidenceLabel(value: string) {
  if (hasOwn(ACCESS_CONDITION_LABELS, value)) {
    return ACCESS_CONDITION_LABELS[value];
  }
  if (hasOwn(NEARBY_FEATURE_LABELS, value)) {
    return NEARBY_FEATURE_LABELS[value];
  }
  return humanize(value);
}

function hasOwn<T extends object>(object: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function humanize(value: string) {
  const result = value.replaceAll("_", " ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}
