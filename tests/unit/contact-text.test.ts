import { expect, it } from "vitest";
import {
  homeownerNameSchema,
  additionalInfoSchema,
} from "@/modules/assessment/contact-text";

it("preserves legitimate Unicode and punctuation as plain text", () => {
  expect(homeownerNameSchema.parse("  Hēmi O’Connor-Smith  ")).toBe(
    "Hēmi O’Connor-Smith",
  );
  expect(
    additionalInfoSchema.parse("First line\nSecond line\t3m & 4m"),
  ).toContain("\n");
});

it.each([
  "Jane\u0000Smith",
  "Jane\r\nBcc:other@example.com",
  "Jane\u007f",
  "Jane\u0085",
])("rejects control characters in names", (name) => {
  expect(homeownerNameSchema.safeParse(name).success).toBe(false);
});

it("rejects oversized input and hidden controls in notes", () => {
  expect(homeownerNameSchema.safeParse("a".repeat(161)).success).toBe(false);
  expect(additionalInfoSchema.safeParse("a".repeat(4001)).success).toBe(false);
  expect(additionalInfoSchema.safeParse("text\u0000").success).toBe(false);
});
