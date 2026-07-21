import { describe, expect, it } from "vitest";
import {
  humanizeIdentifier,
  humanizeIdentifierTitleCase,
} from "@/shared/text/humanize-identifier";

describe("humanizeIdentifier", () => {
  it("turns a domain identifier into a staff-facing label", () => {
    expect(humanizeIdentifier("before_consent_or_construction")).toBe(
      "Before consent or construction",
    );
  });

  it("provides one shared title-case formatter for UI labels", () => {
    expect(humanizeIdentifierTitleCase("possible_with-constraints:test")).toBe(
      "Possible With Constraints Test",
    );
  });
});
