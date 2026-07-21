import { z } from "zod";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { humanizeIdentifier as humanize } from "@/shared/text/humanize-identifier";

export interface AssessmentNarrativeFact {
  id: string;
  kind:
    | "score"
    | "confidence"
    | "candidate"
    | "dimensions"
    | "risk"
    | "action"
    | "source";
  statement: string;
}

export interface AssessmentNarrativeProvider {
  explain(input: {
    facts: AssessmentNarrativeFact[];
    signal: AbortSignal;
  }): Promise<unknown>;
}

export interface AssessmentExplanation {
  source: "ai" | "deterministic_fallback";
  heading: string;
  paragraphs: string[];
}

const providerResponseSchema = z
  .object({
    paragraphs: z
      .array(
        z
          .object({
            factIds: z.array(z.string().min(1)).min(1).max(4),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

export async function generateAssessmentExplanation(input: {
  result: DataAccessSpikeResult;
  provider: AssessmentNarrativeProvider;
  timeoutMs?: number;
}): Promise<AssessmentExplanation> {
  const facts = buildNarrativeFacts(input.result);
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 4_000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let providerOutput: unknown;
  try {
    providerOutput = await Promise.race([
      input.provider.explain({ facts, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("ASSESSMENT_NARRATIVE_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
  } catch {
    return deterministicFallback(input.result, factsById);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  const response = providerResponseSchema.safeParse(providerOutput);
  if (
    !response.success ||
    response.data.paragraphs.some((paragraph) =>
      paragraph.factIds.some((id) => !factsById.has(id)),
    )
  ) {
    return deterministicFallback(input.result, factsById);
  }

  return {
    source: "ai",
    heading: "Constrained AI explanation",
    paragraphs: response.data.paragraphs.map(({ factIds }) =>
      factIds.map((id) => factsById.get(id)!.statement).join(" "),
    ),
  };
}

function deterministicFallback(
  result: DataAccessSpikeResult,
  factsById: Map<string, AssessmentNarrativeFact>,
): AssessmentExplanation {
  return {
    source: "deterministic_fallback",
    heading: "Deterministic assessment explanation",
    paragraphs: [
      result.feasibilityAssessment.finalRecommendation,
      factsById.get("assessment:confidence")!.statement,
      factsById.get("scenario:size_range")!.statement,
    ],
  };
}

function buildNarrativeFacts(
  result: DataAccessSpikeResult,
): AssessmentNarrativeFact[] {
  const assessment = result.feasibilityAssessment;
  const shellRange = result.scenarioComparison.shellRange;
  const sessionAssessment = buildSessionAssessment(result);

  return [
    {
      id: "assessment:score",
      kind: "score",
      statement:
        assessment.score === null
          ? "A deterministic feasibility score is unavailable because required evidence is incomplete."
          : `The deterministic feasibility score is ${assessment.score} out of 100 in the ${assessment.band} band.`,
    },
    {
      id: "assessment:confidence",
      kind: "confidence",
      statement: `Deterministic confidence is ${assessment.confidence.level} at ${assessment.confidence.score} out of 100.`,
    },
    ...candidateFacts(result),
    {
      id: "scenario:size_range",
      kind: "dimensions",
      statement: shellRange
        ? `The screened pool shell range runs from ${formatDimensions(shellRange.minimum)} to ${formatDimensions(shellRange.maximum)}.`
        : "No pool shell size range was successfully placed with the available evidence.",
    },
    ...riskFacts(result),
    ...sessionAssessment.actions.map((group) => ({
      id: `action:${group.phase}`,
      kind: "action" as const,
      statement: `${humanize(group.phase)}: ${group.items[0]}`,
    })),
    {
      id: "sources:availability",
      kind: "source",
      statement: `Official source evidence includes ${result.reportEligibleDatasets.length} report-eligible datasets, ${result.unavailableDatasets.length} unavailable datasets, and ${result.providerErrors.length} provider errors.`,
    },
  ];
}

function candidateFacts(
  result: DataAccessSpikeResult,
): AssessmentNarrativeFact[] {
  const candidates = result.scenarioComparison.successfulShells.slice(0, 3);
  return candidates.length > 0
    ? candidates.map((candidate) => ({
        id: `candidate:${candidate.candidateId}`,
        kind: "candidate" as const,
        statement: `${candidate.label} candidate ${candidate.candidateId} supports a ${formatDimensions(candidate)} screened shell.`,
      }))
    : [
        {
          id: "candidate:none",
          kind: "candidate",
          statement: "No ranked pool candidate was successfully placed.",
        },
      ];
}

function riskFacts(result: DataAccessSpikeResult): AssessmentNarrativeFact[] {
  const flags = result.feasibilityAssessment.criticalFlags;
  return flags.length > 0
    ? flags.map((flag) => ({
        id: `risk:${flag.id}`,
        kind: "risk" as const,
        statement: `${humanize(flag.id)} is a deterministic ${flag.effect} flag.`,
      }))
    : [
        {
          id: "risk:none",
          kind: "risk",
          statement: "No deterministic critical flags were raised.",
        },
      ];
}

function formatDimensions(shell: {
  lengthMetres: number;
  widthMetres: number;
}): string {
  return `${shell.lengthMetres} m by ${shell.widthMetres} m`;
}
