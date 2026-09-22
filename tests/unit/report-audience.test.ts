import { describe, expect, it } from "vitest";
import {
  reportAudienceSchema,
  resolveLegacyReportAudience,
} from "@/modules/assessment/report-audience";
import { buildSavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { buildTestPersistedAssessmentSubmission } from "../fixtures/preliminary-report";

describe("report audience", () => {
  it.each(["homeowner", "pool_builder"] as const)(
    "accepts the canonical %s audience",
    (audience) => {
      expect(reportAudienceSchema.parse(audience)).toBe(audience);
    },
  );

  it.each([
    ["homeowner", "homeowner"],
    ["pool_builder", "pool_builder"],
    ["other", "homeowner"],
    [null, "homeowner"],
    [undefined, "homeowner"],
  ] as const)(
    "resolves legacy visitor type %s to %s",
    (visitorType, expected) => {
      expect(resolveLegacyReportAudience(visitorType)).toBe(expected);
    },
  );

  it("exposes the persisted audience on a saved report", () => {
    const submission = buildTestPersistedAssessmentSubmission(
      "report-audience-1234567890",
    );
    submission.report.reportData.reportAudience = "pool_builder";

    expect(
      buildSavedPreliminaryReport({
        submission,
        reference: "GF-2026-000348",
        createdAt: "2026-09-23T00:00:00.000Z",
      }).reportAudience,
    ).toBe("pool_builder");
  });

  it.each([
    ["pool_builder", "pool_builder"],
    ["homeowner", "homeowner"],
    ["other", "homeowner"],
    [null, "homeowner"],
  ] as const)(
    "uses the documented fallback for legacy saved visitor type %s",
    (legacyVisitorType, expected) => {
      const submission = buildTestPersistedAssessmentSubmission(
        "legacy-audience-1234567890",
      );
      expect(
        buildSavedPreliminaryReport({
          submission,
          reference: "GF-2026-000347",
          createdAt: "2026-09-23T00:00:00.000Z",
          legacyVisitorType,
        }).reportAudience,
      ).toBe(expected);
    },
  );
});
