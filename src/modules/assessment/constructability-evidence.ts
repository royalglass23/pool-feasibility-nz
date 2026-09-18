import { z } from "zod";

const coordinate = z.tuple([
  z.number().finite().min(160).max(180),
  z.number().finite().min(-48).max(-33),
]);
const routeGeometrySchema = z
  .object({
    type: z.literal("LineString"),
    coordinates: z.array(coordinate).min(2).max(4),
  })
  .strict()
  .superRefine((route, context) => {
    if (
      route.coordinates.some(
        (point, index) =>
          index > 0 &&
          point[0] === route.coordinates[index - 1][0] &&
          point[1] === route.coordinates[index - 1][1],
      )
    )
      context.addIssue({
        code: "custom",
        message: "Route must not contain duplicate adjacent points.",
      });
  });

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
    estimatedDepthMetres: z.number().finite().positive().max(2),
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
    estimatedDepthMetres:
      constructabilityAnswersSchema.shape.estimatedDepthMetres,
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
    mappedEvidence,
    providerAvailability,
  });
  return constructabilitySnapshotSchema.parse({
    ...answers,
    ...(input.routePolicyVersion === 1
      ? { routePolicyVersion: 1, suggestedRoute }
      : {}),
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
