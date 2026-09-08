import { z } from "zod";
import {
  contactText,
  contactEmailSchema,
} from "@/shared/validation/contact-text";

const contactFields = {
  name: contactText(120).pipe(z.string().min(1)),
  email: contactEmailSchema,
  idempotencyKey: z.uuid(),
  website: contactText(2_000).optional(),
};

export const contactRequestSchema = z.union([
  z
    .object({
      ...contactFields,
      purpose: z.literal("general").optional(),
      message: contactText(2_000, true).pipe(z.string().min(10)),
    })
    .strict(),
  z
    .object({
      ...contactFields,
      purpose: z.literal("partnership"),
      company: contactText(160).pipe(z.string().min(1)),
      message: contactText(2_000, true).default(""),
    })
    .strict(),
]);

export type ContactRequest = z.infer<typeof contactRequestSchema>;
