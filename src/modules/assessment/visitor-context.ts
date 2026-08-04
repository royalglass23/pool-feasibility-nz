import { z, type RefinementCtx } from "zod";

export const visitorTypeSchema = z.enum(["homeowner", "pool_builder", "other"]);

export const projectTimingSchema = z.enum([
  "asap",
  "3_months",
  "6_months",
  "12_months",
  "other",
]);

const otherDetailSchema = z.string().trim().min(1).max(4_000).optional();

export const visitorContextFields = {
  visitorType: visitorTypeSchema,
  visitorTypeOtherDetail: otherDetailSchema,
  desiredTiming: projectTimingSchema,
  desiredTimingOtherDetail: otherDetailSchema,
};

type VisitorContext = {
  visitorType: z.infer<typeof visitorTypeSchema>;
  visitorTypeOtherDetail?: string;
  desiredTiming: z.infer<typeof projectTimingSchema>;
  desiredTimingOtherDetail?: string;
};

export function requireOtherDetails(
  visitorContext: VisitorContext,
  context: RefinementCtx,
): void {
  if (
    visitorContext.visitorType === "other" &&
    !visitorContext.visitorTypeOtherDetail
  ) {
    context.addIssue({
      code: "custom",
      path: ["visitorTypeOtherDetail"],
      message: "Tell us who you are when you select Other.",
    });
  }
  if (
    visitorContext.desiredTiming === "other" &&
    !visitorContext.desiredTimingOtherDetail
  ) {
    context.addIssue({
      code: "custom",
      path: ["desiredTimingOtherDetail"],
      message: "Tell us when you need it when you select Other.",
    });
  }
}
