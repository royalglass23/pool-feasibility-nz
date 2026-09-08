import { z } from "zod";
import { homeownerNameSchema, additionalInfoSchema } from "./contact-text";
import { nzPhoneSchema } from "./nz-phone";
import { contactEmailSchema } from "@/shared/validation/contact-text";
import { visitorContextFields, requireOtherDetails } from "./visitor-context";

export const homeownerContactFields = {
  name: homeownerNameSchema,
  phone: nzPhoneSchema,
  email: contactEmailSchema,
  ...visitorContextFields,
  additionalInfo: additionalInfoSchema,
  consentGiven: z.literal(true),
};

export const homeownerContactSchema = z
  .object(homeownerContactFields)
  .superRefine(requireOtherDetails)
  .strict();
