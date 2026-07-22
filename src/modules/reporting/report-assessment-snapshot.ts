import { z } from "zod";
import type { SessionAssessment } from "@/modules/assessment/build-session-assessment";

const shortText = z.string().min(1).max(240);
const longText = z.string().min(1).max(2_000);
const isoDateTime = z.iso.datetime({ offset: true });

const reportAssessmentSnapshotSchema = z
  .object({
    property: z
      .object({
        addressId: shortText,
        address: shortText,
        parcelId: shortText,
        appellation: shortText,
        generatedAt: isoDateTime,
      })
      .strict(),
    recommendation: longText,
    feasibilityAssessment: z
      .object({
        score: z.number().finite().min(0).max(100).nullable(),
        band: z
          .enum([
            "strong_preliminary_candidate",
            "likely_feasible_with_normal_investigations",
            "potentially_feasible_but_constrained",
            "significant_constraints",
            "low_preliminary_feasibility",
          ])
          .nullable(),
        confidence: z
          .object({ level: z.enum(["high", "medium", "low"]) })
          .strict(),
        categories: z
          .array(
            z
              .object({
                id: z.enum([
                  "available_space",
                  "underground_services",
                  "flooding_and_drainage",
                  "terrain_and_slope",
                  "planning_constraints",
                  "construction_access",
                ]),
                maximumPoints: z.number().finite().min(0).max(100),
                awardedPoints: z.number().finite().min(0).max(100).nullable(),
                status: z.enum(["scored", "unknown"]),
                rationale: longText,
              })
              .strict(),
          )
          .length(6),
        criticalFlags: z
          .array(z.object({ id: shortText, rationale: longText }).strict())
          .max(12),
      })
      .strict(),
    scenarioComparison: z
      .object({
        scenarios: z
          .array(
            z
              .object({
                scenario: z.object({ label: shortText }).strict(),
                status: z.enum([
                  "likely",
                  "possible_with_constraints",
                  "specialist_review_required",
                  "no_clear_candidate",
                  "insufficient_data",
                ]),
                usableAreaSquareMetres: z.number().finite().min(0).nullable(),
              })
              .strict(),
          )
          .min(1)
          .max(3),
      })
      .strict(),
    preliminaryFeasibilityWording: longText,
    risks: z
      .array(
        z
          .object({
            title: shortText,
            severity: z.enum(["low", "medium", "high"]),
            evidence: longText,
            impact: longText,
            action: longText,
          })
          .strict(),
      )
      .max(5),
    actions: z
      .array(
        z
          .object({
            phase: z.enum([
              "before_concept_design",
              "before_quotations",
              "before_consent_or_construction",
            ]),
            items: z.array(longText).max(8),
          })
          .strict(),
      )
      .max(3),
    missingInformation: z
      .array(z.object({ label: shortText }).strict())
      .max(12),
    limitations: z.array(longText).min(1).max(8),
    provenance: z
      .object({
        datasets: z
          .array(
            z
              .object({
                provider: shortText,
                dataset: shortText,
                status: z.enum([
                  "success",
                  "available",
                  "unavailable",
                  "error",
                ]),
                evidenceUse: z.enum([
                  "report_allowed",
                  "spike_only",
                  "internal_reference",
                  "unavailable",
                ]),
                licence: longText,
                attribution: z
                  .object({
                    text: longText,
                    url: z.string().url().max(2_048),
                  })
                  .strict()
                  .nullable(),
                confidence: z.enum(["high", "limited", "unavailable"]),
              })
              .strict(),
          )
          .max(24),
      })
      .strict(),
  })
  .strict();

export type ReportAssessmentSnapshot = z.infer<
  typeof reportAssessmentSnapshotSchema
>;

export function buildReportAssessmentSnapshot(
  assessment: SessionAssessment,
): ReportAssessmentSnapshot {
  return reportAssessmentSnapshotSchema.parse({
    property: assessment.property,
    recommendation: assessment.recommendation,
    feasibilityAssessment: {
      score: assessment.feasibilityAssessment.score,
      band: assessment.feasibilityAssessment.band,
      confidence: {
        level: assessment.feasibilityAssessment.confidence.level,
      },
      categories: assessment.feasibilityAssessment.categories.map(
        ({ id, maximumPoints, awardedPoints, status, rationale }) => ({
          id,
          maximumPoints,
          awardedPoints,
          status,
          rationale,
        }),
      ),
      criticalFlags: assessment.feasibilityAssessment.criticalFlags.map(
        ({ id, rationale }) => ({ id, rationale }),
      ),
    },
    scenarioComparison: {
      scenarios: assessment.scenarioComparison.scenarios
        .slice(0, 3)
        .map(({ scenario, status, usableAreaSquareMetres }) => ({
          scenario: { label: scenario.label },
          status,
          usableAreaSquareMetres,
        })),
    },
    preliminaryFeasibilityWording: assessment.preliminaryFeasibilityWording,
    risks: assessment.risks
      .slice(0, 5)
      .map(({ title, severity, evidence, impact, action }) => ({
        title,
        severity,
        evidence,
        impact,
        action,
      })),
    actions: assessment.actions.map(({ phase, items }) => ({ phase, items })),
    missingInformation: assessment.missingInformation.map(({ label }) => ({
      label,
    })),
    limitations: assessment.limitations,
    provenance: {
      datasets: assessment.provenance.datasets.map(
        ({
          provider,
          dataset,
          status,
          evidenceUse,
          licence,
          attribution,
          confidence,
        }) => ({
          provider,
          dataset,
          status,
          evidenceUse,
          licence,
          attribution,
          confidence,
        }),
      ),
    },
  });
}

export function parseReportAssessmentSnapshot(
  value: unknown,
): ReportAssessmentSnapshot {
  return reportAssessmentSnapshotSchema.parse(value);
}
