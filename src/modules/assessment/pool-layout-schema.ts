import { z } from "zod";
import {
  CUSTOM_POOL_DIMENSION_LIMITS,
  POOL_LAYOUT_CATALOGUE,
  validateCustomPoolDimensions,
} from "./pool-layout-contract";

const poolLayoutIds = POOL_LAYOUT_CATALOGUE.map((layout) => layout.id) as [
  "plunge",
  "compact",
  "slimline",
  "family",
  "large",
  "custom",
];

export const poolLayoutIdSchema = z.enum(poolLayoutIds);

export const namedPoolLayoutSchema = z
  .object({
    layoutId: poolLayoutIdSchema,
    layoutName: z.string().min(1).max(80),
    lengthMetres: z.number().finite(),
    widthMetres: z.number().finite(),
  })
  .strict()
  .superRefine((layout, context) => {
    const contract = POOL_LAYOUT_CATALOGUE.find(
      (candidate) => candidate.id === layout.layoutId,
    )!;
    const dimensionsMatch =
      layout.layoutId === "custom"
        ? validateCustomPoolDimensions(
            layout.lengthMetres,
            layout.widthMetres,
          ) !== null
        : layout.lengthMetres === contract.lengthMetres &&
          layout.widthMetres === contract.widthMetres;
    if (layout.layoutName !== contract.name || !dimensionsMatch) {
      context.addIssue({
        code: "custom",
        message: "Pool layout identity, name, and dimensions are incompatible.",
      });
    }
  });

export type NamedPoolLayout = z.infer<typeof namedPoolLayoutSchema>;

export const poolLayoutSchema = z
  .object({
    layoutId: poolLayoutIdSchema,
    layoutName: z.string().min(1).max(80),
    lengthMetres: z
      .number()
      .finite()
      .min(CUSTOM_POOL_DIMENSION_LIMITS.length.min)
      .max(CUSTOM_POOL_DIMENSION_LIMITS.length.max),
    widthMetres: z
      .number()
      .finite()
      .min(CUSTOM_POOL_DIMENSION_LIMITS.width.min)
      .max(CUSTOM_POOL_DIMENSION_LIMITS.width.max),
    rotationDegrees: z.number().finite().min(-360).max(360),
    position: z.tuple([
      z.number().finite().min(160).max(180),
      z.number().finite().min(-48).max(-33),
    ]),
  })
  .strict()
  .superRefine((layout, context) => {
    const result = namedPoolLayoutSchema.safeParse({
      layoutId: layout.layoutId,
      layoutName: layout.layoutName,
      lengthMetres: layout.lengthMetres,
      widthMetres: layout.widthMetres,
    });
    if (!result.success) {
      context.addIssue({
        code: "custom",
        message: "Pool layout identity, name, and dimensions are incompatible.",
      });
    }
  });
