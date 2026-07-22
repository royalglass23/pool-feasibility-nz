import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SessionAssessment } from "@/modules/assessment/build-session-assessment";
import { SessionReportValidationError } from "@/modules/reporting/report-errors";
import {
  buildReportAssessmentSnapshot,
  parseReportAssessmentSnapshot,
  type ReportAssessmentSnapshot,
} from "@/modules/reporting/report-assessment-snapshot";

const MAX_SESSION_REPORT_BYTES = 64 * 1_024;
const SESSION_REPORT_TTL_MS = 15 * 60 * 1_000;
const tokenGlobal = globalThis as typeof globalThis & {
  __poolFeasibilityReportSigningKey?: string;
};
const defaultTokenService = createSessionReportTokenService(
  resolveDefaultSigningKey(),
);

function resolveDefaultSigningKey(): string {
  if (process.env.INTERNAL_REPORT_SIGNING_SECRET) {
    return process.env.INTERNAL_REPORT_SIGNING_SECRET;
  }
  if (process.env.NODE_ENV === "test") {
    return (tokenGlobal.__poolFeasibilityReportSigningKey ??=
      randomBytes(32).toString("base64url"));
  }
  throw new Error("INTERNAL_REPORT_SIGNING_SECRET_REQUIRED");
}

export function issueSessionReportToken(assessment: SessionAssessment): string {
  return defaultTokenService.issue(assessment);
}

export function verifySessionReportToken(
  token: string,
): ReportAssessmentSnapshot {
  return defaultTokenService.verify(token);
}

export function createSessionReportTokenService(
  signingKey: string,
  now: () => number = Date.now,
) {
  if (Buffer.byteLength(signingKey, "utf8") < 32) {
    throw new Error("REPORT_SIGNING_KEY_TOO_SHORT");
  }

  return {
    issue(assessment: SessionAssessment): string {
      const payload = encodeReportTokenPayload({
        assessment,
        expiresAt: now() + SESSION_REPORT_TTL_MS,
      });
      return `${payload}.${signReportTokenPayload(payload, signingKey)}`;
    },
    verify(token: string): ReportAssessmentSnapshot {
      return verifyReportTokenWithKey(token, signingKey, now());
    },
  };
}

function encodeReportTokenPayload(value: {
  assessment: SessionAssessment;
  expiresAt: number;
}): string {
  let assessment: ReportAssessmentSnapshot;
  try {
    assessment = buildReportAssessmentSnapshot(value.assessment);
  } catch {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  if (
    Buffer.byteLength(JSON.stringify(assessment), "utf8") >
    MAX_SESSION_REPORT_BYTES
  ) {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  return Buffer.from(
    JSON.stringify({ assessment, expiresAt: value.expiresAt }),
    "utf8",
  ).toString("base64url");
}

function verifyReportTokenWithKey(
  token: string,
  signingKey: string,
  now: number,
): ReportAssessmentSnapshot {
  const [payload, signature, extra] = token.split(".");
  const expectedSignature = payload
    ? signReportTokenPayload(payload, signingKey)
    : "";
  if (
    !payload ||
    !signature ||
    extra !== undefined ||
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  let report: { assessment: unknown; expiresAt: number };
  try {
    report = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      assessment: unknown;
      expiresAt: number;
    };
  } catch {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  if (!Number.isFinite(report.expiresAt) || report.expiresAt <= now) {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  try {
    return parseReportAssessmentSnapshot(report.assessment);
  } catch {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
}

function signReportTokenPayload(payload: string, signingKey: string): string {
  return createHmac("sha256", signingKey).update(payload).digest("base64url");
}
