import { describe, expect, it } from "vitest";
import { reportWarningLabel } from "@/modules/reporting/preliminary-report-presentation";

describe("reportWarningLabel", () => {
  it("uses homeowner-safe wording for a position that needs review", () => {
    expect(reportWarningLabel("blocked")).toBe(
      "This pool position needs review",
    );
  });
});
