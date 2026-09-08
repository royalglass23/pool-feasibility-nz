import { z } from "zod";

// Based on cost-calculator-WP, restricted to local format with a leading zero.
const NZ_PHONE = /^(\(?0[2-9]\d?\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4})$/;

export const NZ_PHONE_ERROR =
  "Enter a valid NZ mobile or landline number starting with 0.";

export function isValidNzPhone(value: string): boolean {
  if (!/^[0-9 ().-]+$/.test(value)) return false;
  const trimmed = value.trim();
  return trimmed.length <= 40 && NZ_PHONE.test(trimmed.replace(/\s/g, ""));
}

export const nzPhoneSchema = z
  .string()
  .trim()
  .refine(isValidNzPhone, NZ_PHONE_ERROR);
