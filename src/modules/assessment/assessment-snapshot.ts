import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { FastPropertyDetails } from "@/modules/data-access-spike/execute-fast-property-details";
import type {
  FastPropertyViewResult,
  FastPropertyViewStage,
} from "@/modules/data-access-spike/fast-property-view";
import {
  trustedConstructabilitySubmissionSchema,
  type TrustedConstructabilitySubmission,
} from "./constructability-evidence";
import { estimatedPoolDepthSchema } from "./estimated-pool-depth";
import { reportAudienceSchema, type ReportAudience } from "./report-audience";
import {
  namedPoolLayoutSchema,
  type NamedPoolLayout,
} from "./pool-layout-schema";

const ASSESSMENT_SNAPSHOT_TTL_MS = 15 * 60 * 1_000;
const snapshotGlobal = globalThis as typeof globalThis & {
  __poolFeasibilityAssessmentSigningKey?: string;
};
let defaultSnapshotService:
  ReturnType<typeof createAssessmentSnapshotService> | undefined;

export type TrustedAssessmentSnapshot = {
  submissionId: string;
  fastResult: FastPropertyViewResult;
  expiresAt: number;
  constructability?: TrustedConstructabilitySubmission;
  lockedEstimatedDepthMetres?: number;
  reportAudience?: ReportAudience;
  poolLayout?: NamedPoolLayout;
};

export function issueAssessmentSnapshot(
  fastResult: FastPropertyViewResult,
  constructability?: TrustedConstructabilitySubmission,
): string {
  return configuredSnapshotService().issue(fastResult, constructability);
}

export function refreshAssessmentSnapshot(
  snapshot: TrustedAssessmentSnapshot,
  patch: FastPropertyViewStage | { detailedChecks: FastPropertyDetails },
): string {
  return configuredSnapshotService().refresh(snapshot, patch);
}

export function attachConstructabilityAnswers(
  snapshot: TrustedAssessmentSnapshot,
  constructability: TrustedConstructabilitySubmission,
): string {
  return configuredSnapshotService().attachConstructability(
    snapshot,
    constructability,
  );
}

export function attachReportAudience(
  snapshot: TrustedAssessmentSnapshot,
  reportAudience: ReportAudience,
  poolLayout?: NamedPoolLayout,
): string {
  return configuredSnapshotService().attachReportAudience(
    snapshot,
    reportAudience,
    poolLayout,
  );
}

export function verifyAssessmentSnapshot(
  token: string,
): TrustedAssessmentSnapshot {
  return configuredSnapshotService().verify(token);
}

export function assertSnapshotAddressMatches(
  snapshot: TrustedAssessmentSnapshot,
  addressId: string,
  coordinates: [number, number],
): void {
  const trusted = snapshot.fastResult.resolvedAddress;
  if (
    trusted.addressId !== addressId ||
    trusted.coordinates[0] !== coordinates[0] ||
    trusted.coordinates[1] !== coordinates[1]
  ) {
    throw new AssessmentSnapshotValidationError();
  }
}

export class AssessmentSnapshotValidationError extends Error {
  constructor() {
    super("INVALID_ASSESSMENT_SNAPSHOT");
  }
}

export function createAssessmentSnapshotService(
  signingKey: string,
  now: () => number = Date.now,
) {
  if (Buffer.byteLength(signingKey, "utf8") < 32) {
    throw new Error("ASSESSMENT_SNAPSHOT_SIGNING_KEY_TOO_SHORT");
  }

  return {
    issue(
      fastResult: FastPropertyViewResult,
      constructability?: TrustedConstructabilitySubmission,
    ): string {
      return encodeAndSign(
        {
          submissionId: randomUUID(),
          fastResult,
          expiresAt: now() + ASSESSMENT_SNAPSHOT_TTL_MS,
          ...(constructability
            ? {
                constructability:
                  trustedConstructabilitySubmissionSchema.parse(
                    constructability,
                  ),
              }
            : {}),
        },
        signingKey,
      );
    },
    refresh(
      snapshot: TrustedAssessmentSnapshot,
      patch: FastPropertyViewStage | { detailedChecks: FastPropertyDetails },
    ): string {
      if (snapshot.expiresAt <= now())
        throw new AssessmentSnapshotValidationError();
      return encodeAndSign(
        {
          ...snapshot,
          fastResult: { ...snapshot.fastResult, ...patch },
        },
        signingKey,
      );
    },
    attachConstructability(
      snapshot: TrustedAssessmentSnapshot,
      constructability: TrustedConstructabilitySubmission,
    ): string {
      if (snapshot.expiresAt <= now())
        throw new AssessmentSnapshotValidationError();
      return encodeAndSign(
        {
          ...snapshot,
          constructability:
            trustedConstructabilitySubmissionSchema.parse(constructability),
        },
        signingKey,
      );
    },
    attachReportAudience(
      snapshot: TrustedAssessmentSnapshot,
      reportAudience: ReportAudience,
      poolLayout?: NamedPoolLayout,
    ): string {
      if (snapshot.expiresAt <= now())
        throw new AssessmentSnapshotValidationError();
      if (
        snapshot.reportAudience !== undefined &&
        snapshot.reportAudience !== reportAudience
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      const parsedPoolLayout = poolLayout
        ? namedPoolLayoutSchema.parse(poolLayout)
        : undefined;
      if (
        snapshot.poolLayout !== undefined &&
        (!parsedPoolLayout ||
          !isDeepStrictEqual(snapshot.poolLayout, parsedPoolLayout))
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      return encodeAndSign(
        {
          ...snapshot,
          reportAudience: reportAudienceSchema.parse(reportAudience),
          ...(parsedPoolLayout ? { poolLayout: parsedPoolLayout } : {}),
        },
        signingKey,
      );
    },
    verify(token: string): TrustedAssessmentSnapshot {
      const [payload, signature, extra] = token.split(".");
      const expectedSignature = payload ? sign(payload, signingKey) : "";
      if (
        !payload ||
        !signature ||
        extra !== undefined ||
        signature.length !== expectedSignature.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      let snapshot: TrustedAssessmentSnapshot;
      try {
        snapshot = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8"),
        ) as TrustedAssessmentSnapshot;
      } catch {
        throw new AssessmentSnapshotValidationError();
      }
      if (
        !isTrustedSnapshot(snapshot) ||
        !Number.isFinite(snapshot.expiresAt) ||
        snapshot.expiresAt <= now()
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      if (
        snapshot.constructability !== undefined &&
        !trustedConstructabilitySubmissionSchema.safeParse(
          snapshot.constructability,
        ).success
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      if (
        snapshot.lockedEstimatedDepthMetres !== undefined &&
        !estimatedPoolDepthSchema.safeParse(snapshot.lockedEstimatedDepthMetres)
          .success
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      if (
        snapshot.reportAudience !== undefined &&
        !reportAudienceSchema.safeParse(snapshot.reportAudience).success
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      if (
        snapshot.poolLayout !== undefined &&
        !namedPoolLayoutSchema.safeParse(snapshot.poolLayout).success
      ) {
        throw new AssessmentSnapshotValidationError();
      }
      return snapshot;
    },
  };
}

function configuredSnapshotService() {
  return (defaultSnapshotService ??=
    createAssessmentSnapshotService(resolveSigningKey()));
}

function resolveSigningKey(): string {
  if (process.env.INTERNAL_REPORT_SIGNING_SECRET) {
    return process.env.INTERNAL_REPORT_SIGNING_SECRET;
  }
  if (process.env.NODE_ENV === "test") {
    return (snapshotGlobal.__poolFeasibilityAssessmentSigningKey ??=
      "test-assessment-snapshot-signing-key-32-bytes");
  }
  throw new Error("INTERNAL_REPORT_SIGNING_SECRET_REQUIRED");
}

function encodeAndSign(
  snapshot: TrustedAssessmentSnapshot,
  signingKey: string,
): string {
  const payload = Buffer.from(JSON.stringify(snapshot), "utf8").toString(
    "base64url",
  );
  return `${payload}.${sign(payload, signingKey)}`;
}

function sign(payload: string, signingKey: string): string {
  return createHmac("sha256", signingKey).update(payload).digest("base64url");
}

function isTrustedSnapshot(value: unknown): value is TrustedAssessmentSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<TrustedAssessmentSnapshot>;
  const result = snapshot.fastResult;
  return (
    typeof snapshot.submissionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      snapshot.submissionId,
    ) &&
    Boolean(result) &&
    typeof result === "object" &&
    Boolean(result.resolvedAddress) &&
    Array.isArray(result.resolvedAddress.coordinates) &&
    result.resolvedAddress.coordinates.length === 2 &&
    typeof result.resolvedAddress.coordinates[0] === "number" &&
    typeof result.resolvedAddress.coordinates[1] === "number" &&
    typeof result.resolvedAddress.addressId === "string" &&
    typeof result.resolvedAddress.fullAddress === "string" &&
    Boolean(result.boundary) &&
    typeof result.boundary === "object"
  );
}
