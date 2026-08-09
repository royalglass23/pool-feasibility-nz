import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  createAssessmentDeliveryStore,
  saveHomeownerAssessment,
} from "@/db/repositories/homeowner-assessment-repository";
import {
  buildTestPersistedAssessmentSubmission,
  TEST_MAP_IMAGE_DATA_URL,
} from "../fixtures/preliminary-report";

const databaseUrl = process.env.MT249_DATABASE_URL;

describe.skipIf(!databaseUrl)(
  "persisted assessment delivery store",
  { timeout: 30_000 },
  () => {
    it("stores independent claims and retries only failed or abandoned delivery work", async () => {
      const db = drizzle(neon(databaseUrl!), { schema });
      const submission = buildTestPersistedAssessmentSubmission(
        `mt-249-integration-${randomUUID()}`,
      );
      const saved = await saveHomeownerAssessment(db, submission);
      let now = new Date("2026-07-29T03:00:00.000Z");
      const store = createAssessmentDeliveryStore(db, () => now);

      try {
        const homeownerClaim = await store.claim(
          saved.assessment.reference,
          "homeowner",
        );
        expect(homeownerClaim).toMatchObject({
          channel: "homeowner",
          homeownerEmail: submission.homeowner.email,
          report: {
            reference: saved.assessment.reference,
            mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
          },
        });
        await expect(
          store.claim(saved.assessment.reference, "homeowner"),
        ).resolves.toBeNull();

        await store.markFailed(
          saved.assessment.reference,
          "homeowner",
          homeownerClaim!.claimToken,
          "RESEND_TIMEOUT",
        );
        now = new Date("2026-07-29T03:01:00.000Z");
        const retryClaim = await store.claim(
          saved.assessment.reference,
          "homeowner",
        );
        expect(retryClaim?.claimToken).not.toBe(homeownerClaim?.claimToken);
        await store.markSent(
          saved.assessment.reference,
          "homeowner",
          retryClaim!.claimToken,
          "email-homeowner-249",
        );

        const serviceM8Claim = await store.claim(
          saved.assessment.reference,
          "servicem8",
        );
        expect(serviceM8Claim).toMatchObject({
          channel: "servicem8",
          notification: {
            reference: saved.assessment.reference,
            name: submission.homeowner.name,
            phone: submission.homeowner.phone,
            email: submission.homeowner.email,
            checkedAddress: submission.addressEvidence.formattedAddress,
            visitorType: submission.homeowner.visitorType,
            desiredTiming: submission.homeowner.desiredTiming,
          },
        });
        expect(serviceM8Claim).not.toHaveProperty("report");
        await expect(
          store.claim(saved.assessment.reference, "servicem8"),
        ).resolves.toBeNull();
        now = new Date("2026-07-29T03:07:00.000Z");
        const recoveredServiceM8Claim = await store.claim(
          saved.assessment.reference,
          "servicem8",
        );
        expect(recoveredServiceM8Claim?.claimToken).not.toBe(
          serviceM8Claim?.claimToken,
        );
        await expect(
          store.markSent(
            saved.assessment.reference,
            "servicem8",
            serviceM8Claim!.claimToken,
            "email-stale-worker-249",
          ),
        ).rejects.toThrow("ASSESSMENT_DELIVERY_CLAIM_LOST");
        await store.markSent(
          saved.assessment.reference,
          "servicem8",
          recoveredServiceM8Claim!.claimToken,
          "email-servicem8-249",
        );

        const persisted = await db.query.homeownerAssessments.findFirst({
          where: eq(schema.homeownerAssessments.id, saved.assessment.id),
        });
        expect(persisted).toMatchObject({
          emailDeliveryState: "sent",
          emailDeliveryAttemptCount: 2,
          emailDeliveryProviderMessageId: "email-homeowner-249",
          emailDeliveryLastErrorCode: null,
          forwardingState: "sent",
          forwardingAttemptCount: 2,
          forwardingProviderMessageId: "email-servicem8-249",
        });
        await expect(
          store.claim(saved.assessment.reference, "homeowner"),
        ).resolves.toBeNull();
        await expect(
          store.claim(saved.assessment.reference, "servicem8"),
        ).resolves.toBeNull();
      } finally {
        await db
          .delete(schema.homeownerAssessments)
          .where(eq(schema.homeownerAssessments.id, saved.assessment.id));
      }
    });
  },
);
