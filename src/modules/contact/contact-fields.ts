import { z } from "zod";
import {
  contactText,
  contactEmailSchema,
  conversationalText,
} from "@/shared/validation/contact-text";
import { personName } from "./person-name";

const contactFields = {
  name: personName(120),
  email: contactEmailSchema,
  idempotencyKey: z.uuid(),
  website: contactText(2_000).optional(),
};

export const contactSchemas = {
  general: z
    .object({
      ...contactFields,
      purpose: z.literal("general").optional(),
      message: conversationalText(2_000, true).pipe(
        z.string().min(10, "Please enter at least 10 characters."),
      ),
    })
    .strict(),
  partnership: z
    .object({
      ...contactFields,
      purpose: z.literal("partnership"),
      company: conversationalText(160).pipe(
        z.string().min(1, "Please enter your company name."),
      ),
      message: conversationalText(2_000, true).default(""),
    })
    .strict(),
};
export const contactRequestSchema = z.union([
  contactSchemas.general,
  contactSchemas.partnership,
]);

export type ContactRequest = z.infer<typeof contactRequestSchema>;
