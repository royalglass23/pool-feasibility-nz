import type { Feature, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";

export type AerialConflictType =
  | "possible_existing_pool"
  | "building_roof_overlap"
  | "deck_hardstand_conflict"
  | "driveway_access_conflict"
  | "vegetation_obstruction"
  | "image_alignment_uncertainty"
  | "image_resolution_uncertainty";

export type AerialConflictEvidenceStatus =
  "observed" | "possible" | "unknown" | "unavailable";

export interface AerialConflictCandidate {
  id: string;
  envelope: Feature<Polygon>;
  dimensions: { lengthMetres: number; widthMetres: number };
  rotationDegrees: number;
}

export interface AerialImageryContext {
  status: "available" | "unavailable";
  alignment: "aligned" | "uncertain" | "unavailable";
  resolution: "sufficient" | "limited" | "unavailable";
  evidenceId: string;
  image?: {
    dataUrl: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
  };
}

export interface AerialConflictFinding {
  type: AerialConflictType;
  affectedArea: Feature<Polygon | MultiPolygon>;
  confidence: "high" | "medium" | "low";
  explanation: string;
  evidenceStatus: AerialConflictEvidenceStatus;
  inspectionRequirement: "required" | "recommended" | "not_required";
}

export interface AerialImageryConflictProvider {
  assess(input: {
    candidate: AerialConflictCandidate;
    context: AerialImageryContext;
    signal: AbortSignal;
  }): Promise<unknown>;
}

export interface AerialImageryConflictAssessment {
  source: "provider" | "fallback";
  candidateId: string;
  findings: AerialConflictFinding[];
}

const coordinate = z.number().finite();
const polygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(coordinate).min(2))).min(1),
});
const multiPolygon = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z
    .array(z.array(z.array(z.array(coordinate).min(2)).min(1)))
    .min(1),
});
const affectedArea = z.object({
  type: z.literal("Feature"),
  properties: z.union([z.record(z.string(), z.unknown()), z.null()]),
  geometry: z.union([polygon, multiPolygon]),
});
const providerFinding = z.object({
  type: z.enum([
    "possible_existing_pool",
    "building_roof_overlap",
    "deck_hardstand_conflict",
    "driveway_access_conflict",
    "vegetation_obstruction",
    "image_alignment_uncertainty",
    "image_resolution_uncertainty",
  ]),
  affectedArea,
  confidence: z.enum(["high", "medium", "low"]),
  explanation: z.string().trim().min(1).max(1_000),
  evidenceStatus: z.enum(["observed", "possible", "unknown", "unavailable"]),
  inspectionRequirement: z.enum(["required", "recommended", "not_required"]),
});
const providerOutput = z.object({
  findings: z.array(providerFinding).min(1).max(32),
});

export async function assessAerialImageryConflicts(input: {
  candidate: AerialConflictCandidate;
  context: AerialImageryContext;
  provider?: AerialImageryConflictProvider;
  timeoutMs?: number;
}): Promise<AerialImageryConflictAssessment> {
  if (
    input.provider &&
    input.context.status === "available" &&
    input.context.alignment === "aligned" &&
    input.context.resolution === "sufficient"
  ) {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await Promise.race([
        input.provider.assess({
          candidate: input.candidate,
          context: input.context,
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error("AERIAL_CONFLICT_ASSESSMENT_TIMEOUT"));
          }, input.timeoutMs ?? 4_000);
        }),
      ]);
      const parsed = providerOutput.safeParse(output);
      if (parsed.success) {
        return {
          source: "provider",
          candidateId: input.candidate.id,
          findings: parsed.data.findings.map((finding) =>
            normalizeFinding({
              ...finding,
              affectedArea: input.candidate.envelope,
            }),
          ),
        };
      }
    } catch {
      // Provider uncertainty is intentionally converted to the safe fallback below.
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return {
    source: "fallback",
    candidateId: input.candidate.id,
    findings: fallbackFindings(input.candidate.envelope, input.context),
  };
}

function normalizeFinding(
  finding: AerialConflictFinding,
): AerialConflictFinding {
  const isObserved = finding.evidenceStatus === "observed";
  return {
    ...finding,
    evidenceStatus: isObserved ? "observed" : "possible",
    inspectionRequirement: isObserved
      ? finding.inspectionRequirement
      : "required",
  };
}

function fallbackFindings(
  envelope: Feature<Polygon>,
  context: AerialImageryContext,
): AerialConflictFinding[] {
  const findings: AerialConflictFinding[] = [];
  if (context.status !== "available" || context.alignment !== "aligned") {
    findings.push({
      type: "image_alignment_uncertainty",
      affectedArea: envelope,
      confidence: "low",
      explanation:
        "Aerial imagery is unavailable or not sufficiently aligned to the candidate envelope.",
      evidenceStatus: context.status === "unavailable" ? "possible" : "unknown",
      inspectionRequirement: "required",
    });
  }
  if (context.status !== "available" || context.resolution !== "sufficient") {
    findings.push({
      type: "image_resolution_uncertainty",
      affectedArea: envelope,
      confidence: "low",
      explanation:
        "Aerial imagery resolution or availability is insufficient to establish a reliable conflict result.",
      evidenceStatus: context.status === "unavailable" ? "possible" : "unknown",
      inspectionRequirement: "required",
    });
  }
  if (findings.length === 0) {
    findings.push({
      type: "image_alignment_uncertainty",
      affectedArea: envelope,
      confidence: "low",
      explanation:
        "The aerial assessment did not return a valid structured result; onsite confirmation is required.",
      evidenceStatus: "unknown",
      inspectionRequirement: "required",
    });
  }
  return findings;
}
