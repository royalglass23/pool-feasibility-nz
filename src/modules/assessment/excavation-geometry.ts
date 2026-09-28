import { z } from "zod";

export const EXCAVATION_GEOMETRY_ASSUMPTION_ID =
  "user-selected-side-clearance-v1" as const;
export const LEGACY_EXCAVATION_GEOMETRY_ASSUMPTION_ID =
  "firth-masonry-side-300mm-v1" as const;
export const EXCAVATION_SIDE_ALLOWANCE_METRES = 0.3;
export const MIN_EXCAVATION_SIDE_ALLOWANCE_METRES = 0.2;
export const MAX_EXCAVATION_SIDE_ALLOWANCE_METRES = 0.6;
export const EXCAVATION_GEOMETRY_DECIMAL_PLACES = 2;

export const excavationSideAllowanceSchema = z
  .number()
  .finite()
  .min(MIN_EXCAVATION_SIDE_ALLOWANCE_METRES)
  .max(MAX_EXCAVATION_SIDE_ALLOWANCE_METRES);

const excavationGeometryInputSchema = z
  .object({
    lengthMetres: z.number().finite().positive(),
    widthMetres: z.number().finite().positive(),
    estimatedDepthMetres: z.number().finite().positive().max(2),
    sideAllowanceMetres: excavationSideAllowanceSchema,
    terrainAdjustment: z.enum(["available_separate", "unavailable"]),
  })
  .strict();

const scenarioFields = {
  inputs: excavationGeometryInputSchema.omit({
    sideAllowanceMetres: true,
    terrainAdjustment: true,
  }),
  poolOutlineCubicMetres: z.number().finite().positive(),
  sideAllowanceCubicMetres: z.number().finite().positive(),
  rounding: z
    .object({
      decimalPlaces: z.literal(EXCAVATION_GEOMETRY_DECIMAL_PLACES),
      method: z.literal("half_up"),
    })
    .strict(),
  specialistDepthWarning: z.boolean(),
  terrainAdjustment: z.enum(["available_separate", "unavailable"]),
};

const legacyExcavationGeometryScenariosSchema = z
  .object({
    version: z.literal(1),
    assumptionId: z.literal(LEGACY_EXCAVATION_GEOMETRY_ASSUMPTION_ID),
    ...scenarioFields,
    sideAllowanceMetres: z.literal(EXCAVATION_SIDE_ALLOWANCE_METRES),
  })
  .strict()
  .superRefine((scenario, context) => {
    validateScenario(scenario, context);
  });

const adjustableExcavationGeometryScenariosSchema = z
  .object({
    version: z.literal(2),
    assumptionId: z.literal(EXCAVATION_GEOMETRY_ASSUMPTION_ID),
    ...scenarioFields,
    sideAllowanceMetres: excavationSideAllowanceSchema,
    selectionSource: z.enum(["default_300mm", "user_adjusted"]),
  })
  .strict()
  .superRefine((scenario, context) => {
    validateScenario(scenario, context);
    const expectedSelectionSource =
      scenario.sideAllowanceMetres === EXCAVATION_SIDE_ALLOWANCE_METRES
        ? "default_300mm"
        : "user_adjusted";
    if (scenario.selectionSource !== expectedSelectionSource) {
      context.addIssue({
        code: "custom",
        path: ["selectionSource"],
        message: "Excavation clearance provenance must match the saved value.",
      });
    }
  });

export const excavationGeometryScenariosSchema = z.union([
  legacyExcavationGeometryScenariosSchema,
  adjustableExcavationGeometryScenariosSchema,
]);

function validateScenario(
  scenario: {
    inputs: {
      lengthMetres: number;
      widthMetres: number;
      estimatedDepthMetres: number;
    };
    sideAllowanceMetres: number;
    poolOutlineCubicMetres: number;
    sideAllowanceCubicMetres: number;
    specialistDepthWarning: boolean;
  },
  context: z.RefinementCtx,
) {
  const expected = calculateValues(
    scenario.inputs,
    scenario.sideAllowanceMetres,
  );
  if (
    scenario.poolOutlineCubicMetres !== expected.poolOutlineCubicMetres ||
    scenario.sideAllowanceCubicMetres !== expected.sideAllowanceCubicMetres ||
    scenario.specialistDepthWarning !== expected.specialistDepthWarning
  ) {
    context.addIssue({
      code: "custom",
      message: "Excavation geometry must match its saved inputs.",
    });
  }
}

export type ExcavationGeometryScenarios = z.infer<
  typeof excavationGeometryScenariosSchema
>;

export function calculateExcavationGeometryScenarios(input: {
  lengthMetres: number;
  widthMetres: number;
  estimatedDepthMetres: number;
  sideAllowanceMetres?: number;
  terrainAdjustment: "available_separate" | "unavailable";
}): ExcavationGeometryScenarios {
  const parsed = excavationGeometryInputSchema.safeParse({
    ...input,
    sideAllowanceMetres:
      input.sideAllowanceMetres ?? EXCAVATION_SIDE_ALLOWANCE_METRES,
  });
  if (!parsed.success) throw new ExcavationGeometryInputError();
  const values = calculateValues(parsed.data, parsed.data.sideAllowanceMetres);
  return excavationGeometryScenariosSchema.parse({
    version: 2,
    assumptionId: EXCAVATION_GEOMETRY_ASSUMPTION_ID,
    inputs: {
      lengthMetres: parsed.data.lengthMetres,
      widthMetres: parsed.data.widthMetres,
      estimatedDepthMetres: parsed.data.estimatedDepthMetres,
    },
    sideAllowanceMetres: parsed.data.sideAllowanceMetres,
    selectionSource:
      parsed.data.sideAllowanceMetres === EXCAVATION_SIDE_ALLOWANCE_METRES
        ? "default_300mm"
        : "user_adjusted",
    ...values,
    rounding: {
      decimalPlaces: EXCAVATION_GEOMETRY_DECIMAL_PLACES,
      method: "half_up",
    },
    terrainAdjustment: parsed.data.terrainAdjustment,
  });
}

function calculateValues(
  input: {
    lengthMetres: number;
    widthMetres: number;
    estimatedDepthMetres: number;
  },
  sideAllowanceMetres: number,
) {
  const sideExpansionMetres = sideAllowanceMetres * 2;
  return {
    poolOutlineCubicMetres: roundCubicMetres(
      input.lengthMetres * input.widthMetres * input.estimatedDepthMetres,
    ),
    sideAllowanceCubicMetres: roundCubicMetres(
      (input.lengthMetres + sideExpansionMetres) *
        (input.widthMetres + sideExpansionMetres) *
        input.estimatedDepthMetres,
    ),
    specialistDepthWarning: input.estimatedDepthMetres > 1.8,
  };
}

function roundCubicMetres(value: number): number {
  const shiftedValue = shiftDecimal(value, EXCAVATION_GEOMETRY_DECIMAL_PLACES);
  const roundedValue = Math.floor(shiftedValue + 0.5);

  return shiftDecimal(roundedValue, -EXCAVATION_GEOMETRY_DECIMAL_PLACES);
}

function shiftDecimal(value: number, decimalPlaces: number): number {
  const [coefficient, exponent = "0"] = value.toString().split("e");
  return Number(`${coefficient}e${Number(exponent) + decimalPlaces}`);
}

export class ExcavationGeometryInputError extends Error {
  constructor() {
    super("INVALID_EXCAVATION_GEOMETRY_INPUT");
  }
}
