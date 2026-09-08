import { z } from "zod";
import { contactText } from "@/shared/validation/contact-text";
export { contactText } from "@/shared/validation/contact-text";
export const homeownerNameSchema = contactText(160).pipe(z.string().min(1));
export const additionalInfoSchema = contactText(4_000, true).optional();
