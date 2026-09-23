import { z } from "zod";
import { homeownerNameSchema, additionalInfoSchema } from "./contact-text";
import { nzPhoneSchema } from "./nz-phone";
import { contactEmailSchema } from "@/shared/validation/contact-text";
import { visitorContextFields, requireOtherDetails } from "./visitor-context";
import { conversationalText } from "@/shared/validation/contact-text";

const builderCompanyNameSchema = conversationalText(160)
  .nullable()
  .optional()
  .transform((value) => value || null);

export const homeownerContactFields = {
  name: homeownerNameSchema,
  phone: nzPhoneSchema,
  email: contactEmailSchema,
  builderCompanyName: builderCompanyNameSchema,
  ...visitorContextFields,
  additionalInfo: additionalInfoSchema,
  consentGiven: z.literal(true, {
    error: "Please confirm your consent before saving your report.",
  }),
};

export const homeownerContactSchema = z
  .object(homeownerContactFields)
  .superRefine(refineHomeownerContactContext)
  .strict();

export function refineHomeownerContactContext(
  contact: {
    visitorType: "homeowner" | "pool_builder" | "other";
    visitorTypeOtherDetail?: string;
    desiredTiming: "asap" | "3_months" | "6_months" | "12_months" | "other";
    desiredTimingOtherDetail?: string;
    builderCompanyName: string | null;
  },
  context: z.RefinementCtx,
) {
  requireOtherDetails(contact, context);
  if (
    contact.visitorType !== "pool_builder" &&
    contact.builderCompanyName !== null
  ) {
    context.addIssue({
      code: "custom",
      path: ["builderCompanyName"],
      message: "A company name is only accepted for Pool Builder reports.",
    });
  }
}
