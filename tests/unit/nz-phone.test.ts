import { describe, expect, it } from "vitest";
import { nzPhoneSchema } from "@/modules/assessment/nz-phone";

describe("local NZ phone formats", () => {
  it.each([
    "021 555 1234",
    "0271234567",
    "022 123 4567",
    "020 1234 5678",
    "09 555 1234",
    "03 555 1234",
    "04 555 1234",
    "06 555 1234",
    "07 555 1234",
    "(09) 555-1234",
  ])("accepts %s", (phone) => {
    expect(nzPhoneSchema.parse(`  ${phone}  `)).toBe(phone);
  });

  it.each([
    "",
    "   ",
    "abcdefg",
    "0000000",
    "123",
    "021callme",
    "+61 412 345 678",
    "+64 21 555 1234",
    "+64 9 555 1234",
    "6495551234",
    "0064 9 555 1234",
    "21 555 1234",
    "9 555 1234",
    "021123456789012345",
    "021/555/1234",
    "021\n5551234",
    "021\t5551234",
    "0215551234\u0000",
    "0215551234<script>alert(1)</script>",
    "0215551234' OR 1=1--",
  ])("rejects %s", (phone) => {
    expect(nzPhoneSchema.safeParse(phone).success).toBe(false);
  });
});
