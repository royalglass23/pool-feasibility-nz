import { describe, expect, it } from "vitest";
import {
  reportMapLegend,
  reportWarningLabel,
} from "@/modules/reporting/preliminary-report-presentation";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

describe("captured pool legend", () => {
  it.each(["blocked", "needs_checking", "no_warning"] as const)(
    "matches the blue captured pool when the warning is %s",
    (warningState) => {
      const report = buildTestPreliminaryReport({
        warningState,
        mapImageSource: "fast_property_view_capture",
      });
      expect(
        reportMapLegend(report).entries.find(
          (entry) => entry.id === "selected-pool",
        )?.colour,
      ).toBe("#2563eb");
    },
  );
});

describe("reportWarningLabel", () => {
  it("uses homeowner-safe wording for a position that needs review", () => {
    expect(reportWarningLabel("blocked")).toBe(
      "This pool position needs review",
    );
  });
});
