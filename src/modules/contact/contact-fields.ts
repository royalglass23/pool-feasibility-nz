import { z } from "zod";
import {
  contactText,
  contactEmailSchema,
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
      message: contactText(2_000, true).pipe(z.string().min(10)),
    })
    .strict(),
  partnership: z
    .object({
      ...contactFields,
      purpose: z.literal("partnership"),
      company: contactText(160).pipe(z.string().min(1)),
      message: contactText(2_000, true).default(""),
    })
    .strict(),
};
export const contactRequestSchema = z.union([
  contactSchemas.general,
  contactSchemas.partnership,
]);

export type ContactRequest = z.infer<typeof contactRequestSchema>;
