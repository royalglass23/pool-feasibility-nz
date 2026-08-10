import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^GF-\d{4}-\d{6}$/;

export type SavedReportAccess = {
  assessmentId: string;
  reference: string;
};

export class SavedReportAccessTokenError extends Error {
  constructor() {
    super("INVALID_SAVED_REPORT_ACCESS_TOKEN");
    this.name = "SavedReportAccessTokenError";
  }
}

let configuredService:
  ReturnType<typeof createSavedReportAccessTokenService> | undefined;

export function issueSavedReportAccessToken(input: SavedReportAccess): string {
  return defaultService().issue(input);
}

export function verifySavedReportAccessToken(token: string): SavedReportAccess {
  return defaultService().verify(token);
}

export function createSavedReportAccessTokenService(
  signingKey: string,
  now: () => number = Date.now,
) {
  if (Buffer.byteLength(signingKey, "utf8") < 32) {
    throw new Error("SAVED_REPORT_SIGNING_KEY_TOO_SHORT");
  }

  return {
    issue(input: SavedReportAccess): string {
      if (!validAccess(input)) throw new SavedReportAccessTokenError();
      const payload = Buffer.from(
        JSON.stringify({ ...input, expiresAt: now() + TOKEN_TTL_MS }),
        "utf8",
      ).toString("base64url");
      return `${payload}.${sign(payload, signingKey)}`;
    },
    verify(token: string): SavedReportAccess {
      const [payload, signature, extra] = token.split(".");
      const expected = payload ? sign(payload, signingKey) : "";
      if (
        !payload ||
        !signature ||
        extra !== undefined ||
        signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        throw new SavedReportAccessTokenError();
      }

      let decoded: SavedReportAccess & { expiresAt: number };
      try {
        decoded = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8"),
        ) as SavedReportAccess & { expiresAt: number };
      } catch {
        throw new SavedReportAccessTokenError();
      }
      if (
        !validAccess(decoded) ||
        !Number.isFinite(decoded.expiresAt) ||
        decoded.expiresAt <= now()
      ) {
        throw new SavedReportAccessTokenError();
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
    const signingKey = process.env.INTERNAL_REPORT_SIGNING_SECRET;
    if (!signingKey) throw new Error("INTERNAL_REPORT_SIGNING_SECRET_REQUIRED");
    configuredService = createSavedReportAccessTokenService(signingKey);
  }
  return configuredService;
}

function validAccess(
  input: Partial<SavedReportAccess>,
): input is SavedReportAccess {
  return (
    typeof input.assessmentId === "string" &&
    UUID_PATTERN.test(input.assessmentId) &&
    typeof input.reference === "string" &&
    REFERENCE_PATTERN.test(input.reference)
  );
}

function sign(payload: string, signingKey: string): string {
  return createHmac("sha256", signingKey).update(payload).digest("base64url");
}
