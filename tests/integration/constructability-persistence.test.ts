import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  getSavedPreliminaryReportById,
  saveHomeownerAssessment,
} from "@/db/repositories/homeowner-assessment-repository";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { buildTestPersistedAssessmentSubmission } from "../fixtures/preliminary-report";

const databaseUrl = process.env.RG336_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)(
  "constructability JSONB persistence",
  { timeout: 30_000 },
  () => {
    it("round-trips a specialist depth in the saved versioned report", async () => {
      const db = drizzle(neon(databaseUrl!), { schema });
      const submission = buildTestPersistedAssessmentSubmission(
        `rg-340-depth-${randomUUID()}`,
      );
      submission.report.reportData.constructability =
        buildConstructabilitySnapshot({
          answers: {
            version: 1,
            estimatedDepthMetres: 1.9,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
          },
          excavation: {
            dimensions: { lengthMetres: 6, widthMetres: 3 },
            terrainAdjustment: "unavailable",
          },
        });
      let savedId: string | undefined;
      try {
        const saved = await saveHomeownerAssessment(db, submission);
        savedId = saved.assessment.id;
        const report = await getSavedPreliminaryReportById(db, savedId);
        expect(report?.constructability).toMatchObject({
          version: 1,
          estimatedDepthMetres: 1.9,
          excavationGeometry: {
            assumptionId: "firth-masonry-side-300mm-v1",
            poolOutlineCubicMetres: 34.2,
            sideAllowanceCubicMetres: 45.14,
          },
        });
      } finally {
        if (savedId) {
          const deleted = await db
            .delete(schema.homeownerAssessments)
            .where(eq(schema.homeownerAssessments.id, savedId))
            .returning({ id: schema.homeownerAssessments.id });
          expect(deleted).toHaveLength(1);
        }
      }
    });

    it("reconstructs one coherent saved report after concurrent duplicate submissions", async () => {
      const db = drizzle(neon(databaseUrl!), { schema });
      const idempotencyKey = `rg-336-integration-${randomUUID()}`;
      const makeSubmission = (
        depth: number,
        feature: "fences" | "none_of_these",
      ) => {
        const submission =
          buildTestPersistedAssessmentSubmission(idempotencyKey);
        submission.report.reportData.constructability =
          buildConstructabilitySnapshot({
            answers: {
              version: 1,
              estimatedDepthMetres: depth,
              route: { provenance: "uncertain", geometry: null },
              accessConditions: ["none_of_these"],
              nearbyFeatures: [feature],
            },
          });
        return submission;
      };
      const left = makeSubmission(1.5, "fences");
      const right = makeSubmission(1.8, "none_of_these");
      let savedId: string | undefined;
      try {
        const [first, second] = await Promise.all([
          saveHomeownerAssessment(db, left),
          saveHomeownerAssessment(db, right),
        ]);
        savedId = first.assessment.id;
        expect(second.assessment.id).toBe(savedId);
        expect([first.created, second.created].sort()).toEqual([false, true]);

        left.report.reportData.constructability!.mappedEvidence.push({
          id: "later-provider-change",
          category: "terrain_ground",
          status: "concern",
          provider: "later-map",
          dataset: "changed-data",
        });
        const report = await getSavedPreliminaryReportById(db, savedId);
        expect(report?.constructability).toMatchObject(
          first.created
            ? { estimatedDepthMetres: 1.5, nearbyFeatures: ["fences"] }
            : { estimatedDepthMetres: 1.8, nearbyFeatures: ["none_of_these"] },
        );
        expect(report?.constructability).not.toMatchObject({
          mappedEvidence: [
            expect.objectContaining({ id: "later-provider-change" }),
          ],
        });
      } finally {
        if (savedId) {
          const deleted = await db
            .delete(schema.homeownerAssessments)
            .where(eq(schema.homeownerAssessments.id, savedId))
            .returning({ id: schema.homeownerAssessments.id });
          expect(deleted).toHaveLength(1);
        }
      }
    });
  },
);
