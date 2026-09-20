import { z } from "zod";

export const EXCAVATION_GEOMETRY_ASSUMPTION_ID =
  "firth-masonry-side-300mm-v1" as const;
export const EXCAVATION_SIDE_ALLOWANCE_METRES = 0.3;
export const EXCAVATION_GEOMETRY_DECIMAL_PLACES = 2;

const excavationGeometryInputSchema = z
  .object({
    lengthMetres: z.number().finite().positive(),
    widthMetres: z.number().finite().positive(),
    estimatedDepthMetres: z.number().finite().positive().max(2),
    terrainAdjustment: z.enum(["available_separate", "unavailable"]),
  })
  .strict();

export const excavationGeometryScenariosSchema = z
  .object({
    version: z.literal(1),
    assumptionId: z.literal(EXCAVATION_GEOMETRY_ASSUMPTION_ID),
    inputs: excavationGeometryInputSchema.omit({
      terrainAdjustment: true,
    }),
    sideAllowanceMetres: z.literal(EXCAVATION_SIDE_ALLOWANCE_METRES),
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
  })
  .strict()
  .superRefine((scenario, context) => {
    const expected = calculateValues(scenario.inputs);
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
  });

export type ExcavationGeometryScenarios = z.infer<
  typeof excavationGeometryScenariosSchema
>;

export function calculateExcavationGeometryScenarios(input: {
  lengthMetres: number;
  widthMetres: number;
  estimatedDepthMetres: number;
  terrainAdjustment: "available_separate" | "unavailable";
}): ExcavationGeometryScenarios {
  const parsed = excavationGeometryInputSchema.safeParse(input);
  if (!parsed.success) throw new ExcavationGeometryInputError();
  const values = calculateValues(parsed.data);
  return excavationGeometryScenariosSchema.parse({
    version: 1,
    assumptionId: EXCAVATION_GEOMETRY_ASSUMPTION_ID,
    inputs: {
      lengthMetres: parsed.data.lengthMetres,
      widthMetres: parsed.data.widthMetres,
      estimatedDepthMetres: parsed.data.estimatedDepthMetres,
    },
    sideAllowanceMetres: EXCAVATION_SIDE_ALLOWANCE_METRES,
    ...values,
    rounding: {
      decimalPlaces: EXCAVATION_GEOMETRY_DECIMAL_PLACES,
      method: "half_up",
    },
    terrainAdjustment: parsed.data.terrainAdjustment,
  });
}

function calculateValues(input: {
  lengthMetres: number;
  widthMetres: number;
  estimatedDepthMetres: number;
}) {
  const sideExpansionMetres = EXCAVATION_SIDE_ALLOWANCE_METRES * 2;
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
