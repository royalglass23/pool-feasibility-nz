import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^GF-\d{4}-\d{6}$/;

export type ReportRecipientVerification = {
  assessmentId: string;
  reference: string;
};

export class ReportRecipientVerificationTokenError extends Error {
  constructor() {
    super("INVALID_REPORT_RECIPIENT_VERIFICATION_TOKEN");
    this.name = "ReportRecipientVerificationTokenError";
  }
}

let configuredService:
  ReturnType<typeof createReportRecipientVerificationTokenService> | undefined;

export function issueReportRecipientVerificationToken(
  input: ReportRecipientVerification,
): string {
  return defaultService().issue(input);
}

export function verifyReportRecipientVerificationToken(
  token: string,
): ReportRecipientVerification {
  return defaultService().verify(token);
}

export function createReportRecipientVerificationTokenService(
  signingKey: string,
  now: () => number = Date.now,
) {
  if (Buffer.byteLength(signingKey, "utf8") < 32) {
    throw new Error("INTERNAL_REPORT_SIGNING_SECRET_REQUIRED");
  }

  return {
    issue(input: ReportRecipientVerification): string {
      if (!validVerification(input)) {
        throw new ReportRecipientVerificationTokenError();
      }
      const payload = Buffer.from(
        JSON.stringify({
          ...input,
          purpose: "report_recipient_verification",
          expiresAt: now() + TOKEN_TTL_MS,
        }),
        "utf8",
      ).toString("base64url");
      return `${payload}.${sign(payload, signingKey)}`;
    },
    verify(token: string): ReportRecipientVerification {
      const [payload, signature, extra] = token.split(".");
      const expected = payload ? sign(payload, signingKey) : "";
      const suppliedBytes = Buffer.from(signature ?? "", "utf8");
      const expectedBytes = Buffer.from(expected, "utf8");
      if (
        !payload ||
        !signature ||
        extra !== undefined ||
        suppliedBytes.byteLength !== expectedBytes.byteLength ||
        !timingSafeEqual(suppliedBytes, expectedBytes)
      ) {
        throw new ReportRecipientVerificationTokenError();
      }

      let decoded: ReportRecipientVerification & {
        purpose: string;
        expiresAt: number;
      };
      try {
        decoded = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8"),
        ) as ReportRecipientVerification & {
          purpose: string;
          expiresAt: number;
        };
      } catch {
        throw new ReportRecipientVerificationTokenError();
      }
      if (
        !validVerification(decoded) ||
        decoded.purpose !== "report_recipient_verification" ||
        !Number.isFinite(decoded.expiresAt) ||
        decoded.expiresAt <= now()
      ) {
        throw new ReportRecipientVerificationTokenError();
      }
      return {
        assessmentId: decoded.assessmentId,
        reference: decoded.reference,
      };
    },
  };
}

function defaultService() {
  if (!configuredService) {
    configuredService = createReportRecipientVerificationTokenService(
      process.env.INTERNAL_REPORT_SIGNING_SECRET ?? "",
    );
  }
  return configuredService;
}

function validVerification(
  input: Partial<ReportRecipientVerification>,
): input is ReportRecipientVerification {
  return (
    typeof input.assessmentId === "string" &&
    UUID_PATTERN.test(input.assessmentId) &&
    typeof input.reference === "string" &&
    REFERENCE_PATTERN.test(input.reference)
  );
}

function sign(payload: string, signingKey: string): string {
  return createHmac("sha256", signingKey)
    .update("royal-glass/report-recipient-verification/v1\0", "utf8")
    .update(payload, "utf8")
    .digest("base64url");
}
