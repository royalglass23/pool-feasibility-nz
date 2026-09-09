import { z } from "zod";

// Preserve Unicode names and punctuation. Output encoding and parameterized SQL
// remain required; input validation is not an injection sanitizer.
export function contactText(maxLength: number, multiline = false) {
  return z
    .string()
    .max(maxLength, `Please keep this under ${maxLength + 1} characters.`)
    .refine(
      (value) =>
        value.length <= maxLength &&
        Array.from(value).every((character) => {
          const code = character.codePointAt(0)!;
          if (multiline && (code === 9 || code === 10 || code === 13))
            return true;
          return code >= 32 && !(code >= 127 && code <= 159);
        }),
      "Please type this again using plain text.",
    )
    .refine(
      (value) => !/[<>]/.test(value),
      "Please use plain text without HTML tags.",
    )
    .transform((value) => value.trim());
}

export const contactEmailSchema = contactText(320).pipe(
  z.email("Please enter a valid email address, such as name@example.com."),
);
