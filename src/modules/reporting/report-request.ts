import type { ReportAssessmentSnapshot } from "@/modules/reporting/report-assessment-snapshot";
import { SessionReportValidationError } from "@/modules/reporting/report-errors";
import { isValidPngMapImageDataUrl } from "@/modules/reporting/map-image";
import { verifySessionReportToken } from "@/modules/reporting/report-token";

export interface SessionReportRequest {
  assessment: ReportAssessmentSnapshot;
  mapImageDataUrl: string;
}

export function parseSessionReportRequest(
  value: unknown,
): SessionReportRequest {
  if (!value || typeof value !== "object") {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    typeof input.reportToken !== "string" ||
    typeof input.mapImageDataUrl !== "string"
  ) {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  if (!isValidPngMapImageDataUrl(input.mapImageDataUrl)) {
    throw new SessionReportValidationError("INVALID_MAP_IMAGE");
  }
  return {
    assessment: verifySessionReportToken(input.reportToken),
    mapImageDataUrl: input.mapImageDataUrl,
  };
}

export { SessionReportValidationError } from "@/modules/reporting/report-errors";
