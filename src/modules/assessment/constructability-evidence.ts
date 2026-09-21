import { z } from "zod";
import { estimatedPoolDepthSchema } from "./estimated-pool-depth";
import {
  calculateExcavationGeometryScenarios,
  excavationGeometryScenariosSchema,
} from "./excavation-geometry";
import type { AccessRouteFacts } from "@/modules/spatial/analyse-access-route";

const fact = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("assessed"), value }).strict(),
    z
      .object({
        status: z.literal("not_assessed"),
        reason: z.enum(["invalid_geometry", "data_unavailable"]),
      })
      .strict(),
  ]);
const routeFactsSchema = z
  .object({
    valid: z.boolean(),
    length: fact(z.number().finite().nonnegative()),
    elevationChange: fact(z.number().finite()),
    steepestGradient: fact(z.number().finite().nonnegative()),
    parcelDeparture: fact(z.boolean()),
    buildings: fact(z.boolean()),
    services: fact(z.boolean()),
  })
  .strict();

const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const routeGeometrySchema = z
  .object({
    type: z.literal("LineString"),
    coordinates: z.array(coordinate).min(2).max(4),
  })
  .strict();

const accessCondition = z.enum([
  "gate_or_narrow_passage",
  "steps_or_steep_level_change",
  "overhead_obstacle",
  "removable_feature",
  "other_property_access",
  "retaining_wall",
  "rocky_ground",
  "wet_or_soft_ground",
  "none_of_these",
  "not_sure",
]);
const nearbyFeature = z.enum([
  "fences",
  "walls",
  "gates",
  "doors_or_windows",
  "decks",
  "raised_areas",
  "trees_or_structures",
  "none_of_these",
  "not_sure",
]);

function exclusiveAnswers(values: string[]): boolean {
  return (
    new Set(values).size === values.length &&
    (!values.includes("none_of_these") || values.length === 1) &&
    (!values.includes("not_sure") || values.length === 1)
  );
}

export const constructabilityAnswersSchema = z
  .object({
    version: z.literal(1),
    estimatedDepthMetres: estimatedPoolDepthSchema,
    route: z
      .object({
        provenance: z.enum([
          "suggested",
          "confirmed",
          "user-supplied",
          "uncertain",
        ]),
        geometry: routeGeometrySchema.nullable(),
      })
      .strict()
      .superRefine((route, context) => {
        if ((route.provenance === "uncertain") !== (route.geometry === null)) {
          context.addIssue({
            code: "custom",
            message: "Route geometry and provenance disagree.",
          });
        }
      }),
    accessConditions: z
      .array(accessCondition)
      .min(1)
      .max(8)
      .refine(exclusiveAnswers),
    nearbyFeatures: z
      .array(nearbyFeature)
      .min(1)
      .max(7)
      .refine(exclusiveAnswers),
  })
  .strict();

export const mappedConstructabilityEvidenceSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    category: z.enum(["terrain_ground", "barrier", "access_excavation"]),
    status: z.enum(["concern", "no_concern", "unavailable"]),
    provider: z.string().trim().min(1).max(120),
    dataset: z.string().trim().min(1).max(160),
  })
  .strict();

export const constructabilityProviderSchema = z
  .object({
    category: z.enum(["terrain_ground", "barrier", "access_excavation"]),
    provider: z.string().trim().min(1).max(120),
    dataset: z.string().trim().min(1).max(160),
    status: z.enum(["available", "unavailable", "error"]),
  })
  .strict();

export const trustedConstructabilityEvidenceSchema = z
  .object({
    suggestedRoute: routeGeometrySchema.nullable(),
    routePolicyVersion: z.literal(1).optional(),
    routeFacts: routeFactsSchema.optional(),
    mappedEvidence: z.array(mappedConstructabilityEvidenceSchema).max(50),
    providerAvailability: z.array(constructabilityProviderSchema).max(50),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(20),
  })
  .strict();

export const trustedConstructabilitySubmissionSchema = z
  .object({
    answers: constructabilityAnswersSchema,
    evidence: trustedConstructabilityEvidenceSchema,
  })
  .strict();

export const constructabilitySnapshotSchema = z
  .object({
    version: z.literal(1),
    routePolicyVersion: z.literal(1).optional(),
    suggestedRoute: routeGeometrySchema.nullable().optional(),
    routeFacts: routeFactsSchema.optional(),
    estimatedDepthMetres:
      constructabilityAnswersSchema.shape.estimatedDepthMetres,
    excavationGeometry: excavationGeometryScenariosSchema.optional(),
    route: constructabilityAnswersSchema.shape.route,
    accessConditions: constructabilityAnswersSchema.shape.accessConditions,
    nearbyFeatures: constructabilityAnswersSchema.shape.nearbyFeatures,
    mappedEvidence: z.array(mappedConstructabilityEvidenceSchema).max(50),
    userEvidence: z
      .array(
        z
          .object({
            category: z.enum(["barrier", "access_excavation"]),
            condition: z.string().min(1).max(100),
          })
          .strict(),
      )
      .max(15),
    providerAvailability: z.array(constructabilityProviderSchema).max(50),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(20),
    findings: z
      .array(
        z
          .object({
            source: z.enum(["mapped", "user", "provider"]),
            evidenceId: z.string().min(1).max(100),
            category: z.enum([
              "terrain_ground",
              "barrier",
              "access_excavation",
            ]),
            status: z.enum(["needs_checking", "not_assessed"]),
            label: z.string().min(1).max(120),
          })
          .strict(),
      )
      .max(120),
    overallStatus: z.enum([
      "needs_checking",
      "not_fully_assessed",
      "no_obvious_concern",
    ]),
    sectionStatus: z.enum([
      "needs_checking",
      "not_assessed",
      "no_obvious_concern",
    ]),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const derived = deriveConstructability(snapshot);
    for (const field of [
      "userEvidence",
      "findings",
      "overallStatus",
      "sectionStatus",
    ] as const) {
      if (JSON.stringify(snapshot[field]) !== JSON.stringify(derived[field])) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Constructability result must match its saved evidence.",
        });
      }
    }
    if (
      snapshot.excavationGeometry &&
      snapshot.excavationGeometry.inputs.estimatedDepthMetres !==
        snapshot.estimatedDepthMetres
    ) {
      context.addIssue({
        code: "custom",
        path: ["excavationGeometry", "inputs", "estimatedDepthMetres"],
        message: "Excavation geometry must use the locked estimated depth.",
      });
    }
  });

export type ConstructabilityAnswers = z.input<
  typeof constructabilityAnswersSchema
>;
export type TrustedConstructabilityEvidence = z.input<
  typeof trustedConstructabilityEvidenceSchema
>;
export type TrustedConstructabilitySubmission = z.input<
  typeof trustedConstructabilitySubmissionSchema
>;
export type ConstructabilitySnapshot = z.infer<
  typeof constructabilitySnapshotSchema
>;

export function buildConstructabilitySnapshot(input: {
  answers: ConstructabilityAnswers;
  mappedEvidence?: TrustedConstructabilityEvidence["mappedEvidence"];
  providerAvailability?: TrustedConstructabilityEvidence["providerAvailability"];
  assumptions?: string[];
  suggestedRoute?: TrustedConstructabilityEvidence["suggestedRoute"];
  routePolicyVersion?: TrustedConstructabilityEvidence["routePolicyVersion"];
  routeFacts?: AccessRouteFacts;
  excavation?: {
    dimensions: { lengthMetres: number; widthMetres: number };
    terrainAdjustment: "available_separate" | "unavailable";
  };
}): ConstructabilitySnapshot {
  const answers = constructabilityAnswersSchema.parse(input.answers);
  const mappedEvidence = z
    .array(mappedConstructabilityEvidenceSchema)
    .max(50)
    .parse(input.mappedEvidence ?? []);
  const providerAvailability = z
    .array(constructabilityProviderSchema)
    .max(50)
    .parse(input.providerAvailability ?? []);
  const suggestedRoute = routeGeometrySchema
    .nullable()
    .parse(input.suggestedRoute ?? null);
  if (answers.route.provenance !== "uncertain") {
    if (
      !suggestedRoute ||
      !answers.route.geometry ||
      !samePoint(
        answers.route.geometry.coordinates[0],
        suggestedRoute.coordinates[0],
      ) ||
      !samePoint(
        answers.route.geometry.coordinates.at(-1)!,
        suggestedRoute.coordinates.at(-1)!,
      )
    ) {
      throw new ConstructabilityEvidenceError();
    }
    if (
      answers.route.provenance !== "user-supplied" &&
      JSON.stringify(answers.route.geometry) !== JSON.stringify(suggestedRoute)
    ) {
      throw new ConstructabilityEvidenceError();
    }
  }
  const derived = deriveConstructability({
    ...answers,
    routeFacts: input.routeFacts,
    mappedEvidence,
    providerAvailability,
  });
  return constructabilitySnapshotSchema.parse({
    ...answers,
    ...(input.excavation
      ? {
          excavationGeometry: calculateExcavationGeometryScenarios({
            ...input.excavation.dimensions,
            estimatedDepthMetres: answers.estimatedDepthMetres,
            terrainAdjustment: input.excavation.terrainAdjustment,
          }),
        }
      : {}),
    ...(input.routePolicyVersion === 1
      ? { routePolicyVersion: 1, suggestedRoute }
      : {}),
    ...(input.routeFacts ? { routeFacts: input.routeFacts } : {}),
    mappedEvidence,
    ...derived,
    providerAvailability,
    assumptions: input.assumptions ?? [],
  });
}

function deriveConstructability(
  input: Pick<
    z.infer<typeof constructabilityAnswersSchema>,
    "route" | "accessConditions" | "nearbyFeatures"
  > & {
    routeFacts?: AccessRouteFacts;
    mappedEvidence: z.infer<typeof mappedConstructabilityEvidenceSchema>[];
    providerAvailability: z.infer<typeof constructabilityProviderSchema>[];
  },
) {
  const userEvidence = [
    ...input.accessConditions
      .filter(
        (condition) =>
          condition !== "none_of_these" && condition !== "not_sure",
      )
      .map((condition) => ({
        category: "access_excavation" as const,
        condition,
      })),
    ...input.nearbyFeatures
      .filter(
        (condition) =>
          condition !== "none_of_these" && condition !== "not_sure",
      )
      .map((condition) => ({ category: "barrier" as const, condition })),
  ];
  const findings = [
    ...(input.routeFacts && !input.routeFacts.valid
      ? [
          {
            source: "user" as const,
            evidenceId: "route_invalid",
            category: "access_excavation" as const,
            status: "not_assessed" as const,
            label: "Not assessed — invalid route geometry",
          },
        ]
      : []),
    ...(["parcelDeparture", "buildings", "services"] as const)
      .filter(
        (key) =>
          input.routeFacts?.[key].status === "assessed" &&
          input.routeFacts[key].value,
      )
      .map((key) => ({
        source: "mapped" as const,
        evidenceId: `route_${key}`,
        category: "access_excavation" as const,
        status: "needs_checking" as const,
        label: "Potential site consideration",
      })),
    ...input.mappedEvidence
      .filter((evidence) => evidence.status === "concern")
      .map((evidence) => ({
        source: "mapped" as const,
        evidenceId: evidence.id,
        category: evidence.category,
        status: "needs_checking" as const,
        label: "Potential site consideration",
      })),
    ...input.mappedEvidence
      .filter((evidence) => evidence.status === "unavailable")
      .map((evidence) => ({
        source: "mapped" as const,
        evidenceId: evidence.id,
        category: evidence.category,
        status: "not_assessed" as const,
        label: "Not assessed — data unavailable",
      })),
    ...userEvidence.map((evidence) => ({
      source: "user" as const,
      evidenceId: evidence.condition,
      category: evidence.category,
      status: "needs_checking" as const,
      label: "Potential site consideration",
    })),
    ...input.providerAvailability
      .filter((provider) => provider.status !== "available")
      .map((provider) => ({
        source: "provider" as const,
        evidenceId: provider.dataset,
        category: provider.category,
        status: "not_assessed" as const,
        label: "Not assessed — data unavailable",
      })),
    ...(["terrain_ground", "barrier", "access_excavation"] as const)
      .filter(
        (category) =>
          !input.providerAvailability.some(
            (provider) => provider.category === category,
          ),
      )
      .map((category) => ({
        source: "provider" as const,
        evidenceId: `${category}_unavailable`,
        category,
        status: "not_assessed" as const,
        label: "Not assessed — data unavailable",
      })),
    ...(input.route.provenance === "uncertain" ||
    input.route.provenance === "suggested"
      ? [
          {
            source: "user" as const,
            evidenceId: "route_uncertain",
            category: "access_excavation" as const,
            status: "not_assessed" as const,
            label: "Not assessed — route unconfirmed",
          },
        ]
      : []),
    ...(input.accessConditions.includes("not_sure")
      ? [
          {
            source: "user" as const,
            evidenceId: "access_not_sure",
            category: "access_excavation" as const,
            status: "not_assessed" as const,
            label: "Not assessed — user unsure",
          },
        ]
      : []),
    ...(input.nearbyFeatures.includes("not_sure")
      ? [
          {
            source: "user" as const,
            evidenceId: "nearby_not_sure",
            category: "barrier" as const,
            status: "not_assessed" as const,
            label: "Not assessed — user unsure",
          },
        ]
      : []),
  ];
  return {
    userEvidence,
    findings,
    overallStatus:
      input.accessConditions.includes("not_sure") ||
      input.nearbyFeatures.includes("not_sure")
        ? ("not_fully_assessed" as const)
        : findings.some((finding) => finding.status === "needs_checking")
          ? ("needs_checking" as const)
          : findings.some((finding) => finding.status === "not_assessed")
            ? ("not_fully_assessed" as const)
            : ("no_obvious_concern" as const),
    sectionStatus: findings.some(
      (finding) => finding.status === "needs_checking",
    )
      ? ("needs_checking" as const)
      : findings.some((finding) => finding.status === "not_assessed")
        ? ("not_assessed" as const)
        : ("no_obvious_concern" as const),
  };
}

function samePoint(left: [number, number], right: [number, number]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export class ConstructabilityEvidenceError extends Error {
  constructor() {
    super("INVALID_CONSTRUCTABILITY_ROUTE");
  }
}
