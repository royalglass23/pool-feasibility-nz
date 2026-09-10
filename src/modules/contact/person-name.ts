import { z } from "zod";
import { contactText } from "@/shared/validation/contact-text";

export function personName(maxLength: number) {
  return contactText(maxLength).pipe(
    z
      .string()
      .min(1, "Please enter your name.")
      .regex(
        /^[\p{L}\p{M} .’'\-]+$/u,
        "Please use letters, spaces, apostrophes or hyphens for your name.",
      )
      .refine((value) => /\p{L}/u.test(value), "Please enter your name."),
  );
}
