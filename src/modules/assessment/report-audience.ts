import { z } from "zod";

export const reportAudienceSchema = z.enum(["homeowner", "pool_builder"]);

export type ReportAudience = z.infer<typeof reportAudienceSchema>;

/**
 * Historical visitor types predate the trusted report-audience contract.
 * Preserve explicit homeowner/builder intent; use the less technical
 * homeowner projection when the historical value is absent or ambiguous.
 */
export function resolveLegacyReportAudience(
  visitorType: "homeowner" | "pool_builder" | "other" | null | undefined,
): ReportAudience {
  return visitorType === "pool_builder" ? "pool_builder" : "homeowner";
}
