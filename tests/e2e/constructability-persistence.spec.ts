import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { getSavedPreliminaryReportById } from "@/db/repositories/homeowner-assessment-repository";
import type {
  ConstructabilityAnswers,
  TrustedConstructabilityEvidence,
} from "@/modules/assessment/constructability-evidence";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";

const databaseUrl = process.env.DATABASE_URL_DEV;
const signingKey =
  process.env.INTERNAL_REPORT_SIGNING_SECRET ??
  "playwright-report-signing-secret-2026-07-22-at-least-32-bytes";

test("persists mapped, user, conflicting, and audience-equivalent constructability evidence", async ({
  request,
}) => {
  test.skip(!databaseUrl, "DATABASE_URL_DEV is required for persistence E2E.");
  test.setTimeout(90_000);
  const db = drizzle(neon(databaseUrl!), { schema });
  const assessmentIds: string[] = [];

  try {
    const mapped = await saveScenario(request, {
      visitorType: "homeowner",
      verifyAudienceSecurity: true,
      verifyRetry: true,
      answers: answers(["none_of_these"]),
      evidence: evidence([
        {
          id: "mapped-retaining-wall",
          category: "barrier",
          status: "concern",
          provider: "Synthetic Council GIS",
          dataset: "Retaining walls",
        },
      ]),
    });
    assessmentIds.push(mapped.id);
    const mappedReport = await getSavedPreliminaryReportById(db, mapped.id);
    expect(mappedReport?.constructability).toMatchObject({
      version: 1,
      overallStatus: "needs_checking",
      mappedEvidence: expect.arrayContaining([
        expect.objectContaining({
          id: "mapped-retaining-wall",
          status: "concern",
        }),
      ]),
      findings: expect.arrayContaining([
        expect.objectContaining({
          source: "mapped",
          evidenceId: "mapped-retaining-wall",
        }),
      ]),
    });
    expect(mappedReport?.reportAudience).toBe("homeowner");

    const conflict = await saveScenario(request, {
      visitorType: "homeowner",
      answers: answers(["gate_or_narrow_passage"]),
      evidence: evidence([
        {
          id: "mapped-access-clear",
          category: "access_excavation",
          status: "no_concern",
          provider: "Synthetic Council GIS",
          dataset: "Mapped access",
        },
      ]),
    });
    assessmentIds.push(conflict.id);
    const conflictReport = await getSavedPreliminaryReportById(db, conflict.id);
    expect(conflictReport?.constructability).toMatchObject({
      version: 1,
      overallStatus: "needs_checking",
      mappedEvidence: expect.arrayContaining([
        expect.objectContaining({
          id: "mapped-access-clear",
          status: "no_concern",
        }),
      ]),
      userEvidence: expect.arrayContaining([
        { category: "access_excavation", condition: "gate_or_narrow_passage" },
      ]),
      findings: expect.arrayContaining([
        expect.objectContaining({
          source: "user",
          evidenceId: "gate_or_narrow_passage",
        }),
      ]),
    });

    const commonAnswers = answers(["gate_or_narrow_passage"]);
    const homeowner = await saveScenario(request, {
      visitorType: "homeowner",
      answers: commonAnswers,
      evidence: evidence([]),
    });
    const builder = await saveScenario(request, {
      visitorType: "pool_builder",
      answers: commonAnswers,
      evidence: evidence([]),
    });
    assessmentIds.push(homeowner.id, builder.id);
    const homeownerReport = await getSavedPreliminaryReportById(
      db,
      homeowner.id,
    );
    const builderReport = await getSavedPreliminaryReportById(db, builder.id);
    expect(homeownerReport?.constructability).toEqual(
      builderReport?.constructability,
    );
    expect(homeownerReport?.reportAudience).toBe("homeowner");
    expect(builderReport?.reportAudience).toBe("pool_builder");
    expect(homeownerReport?.constructability).toMatchObject({
      version: 1,
      overallStatus: "needs_checking",
      userEvidence: expect.arrayContaining([
        { category: "access_excavation", condition: "gate_or_narrow_passage" },
      ]),
    });
  } finally {
    for (const id of assessmentIds) {
      await db
        .delete(schema.homeownerAssessments)
        .where(eq(schema.homeownerAssessments.id, id));
    }
  }
});

function answers(
  accessConditions: ConstructabilityAnswers["accessConditions"],
): ConstructabilityAnswers {
  return {
    version: 1,
    estimatedDepthMetres: 1.5,
    route: { provenance: "uncertain", geometry: null },
    accessConditions,
    nearbyFeatures: ["none_of_these"],
  };
}

function evidence(
  mappedEvidence: TrustedConstructabilityEvidence["mappedEvidence"],
): TrustedConstructabilityEvidence {
  return {
    suggestedRoute: null,
    mappedEvidence,
    providerAvailability: [
      {
        category: "terrain_ground",
        provider: "Synthetic terrain",
        dataset: "Terrain",
        status: "available",
      },
      {
        category: "barrier",
        provider: "Synthetic mapping",
        dataset: "Barriers",
        status: "available",
      },
      {
        category: "access_excavation",
        provider: "Synthetic mapping",
        dataset: "Access",
        status: "available",
      },
    ],
    assumptions: ["Synthetic RG-345 persistence evidence."],
  };
}

async function saveScenario(
  request: APIRequestContext,
  input: {
    visitorType: "homeowner" | "pool_builder";
    verifyAudienceSecurity?: boolean;
    verifyRetry?: boolean;
    answers: ConstructabilityAnswers;
    evidence: TrustedConstructabilityEvidence;
  },
) {
  const poolLayout = {
    layoutId: "compact" as const,
    layoutName: "Compact" as const,
    lengthMetres: 6.5,
    widthMetres: 3,
  };
  const snapshot = signedSnapshot(input.answers, input.evidence);
  const siteAnswersResponse = await request.post(
    "/api/public/assessment-snapshot/site-answers",
    {
      data: {
        assessmentSnapshot: snapshot,
        accessConditions: input.answers.accessConditions,
        nearbyFeatures: input.answers.nearbyFeatures,
      },
    },
  );
  const siteAnswersBody = await siteAnswersResponse.json();
  expect(siteAnswersResponse.status(), JSON.stringify(siteAnswersBody)).toBe(
    200,
  );
  const audienceResponse = await request.post(
    "/api/public/assessment-snapshot/audience",
    {
      data: {
        assessmentSnapshot: siteAnswersBody.assessmentSnapshot,
        reportAudience: input.visitorType,
        poolLayout,
      },
    },
  );
  const audienceBody = await audienceResponse.json();
  expect(audienceResponse.status(), JSON.stringify(audienceBody)).toBe(200);

  if (input.verifyAudienceSecurity) {
    const conflictingAudienceResponse = await request.post(
      "/api/public/assessment-snapshot/audience",
      {
        data: {
          assessmentSnapshot: audienceBody.assessmentSnapshot,
          reportAudience: "pool_builder",
          poolLayout,
        },
      },
    );
    expect(conflictingAudienceResponse.status()).toBe(400);
  }

  const submissionData = {
    assessmentSnapshot: audienceBody.assessmentSnapshot,
    constructability: siteAnswersBody.answers,
    mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    mapVisibleLayerKeys: [],
    poolLayout: {
      ...poolLayout,
      rotationDegrees: 0,
      position: [174.6082, -36.8603],
      clearancesVisible: true,
    },
    homeowner: {
      name: "Synthetic Release Evidence",
      phone: "021 555 0345",
      email: "rg345-evidence@example.test",
      visitorType: input.visitorType,
      desiredTiming: "asap",
      consentGiven: true,
    },
  };

  if (input.verifyAudienceSecurity) {
    const tamperedResponse = await request.post("/api/public/assessments", {
      data: {
        ...submissionData,
        homeowner: {
          ...submissionData.homeowner,
          visitorType: "pool_builder",
        },
      },
    });
    expect(tamperedResponse.status()).toBe(400);
  }

  const response = await request.post("/api/public/assessments", {
    data: submissionData,
  });
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(201);
  expect(body.assessment.report.constructability).toMatchObject({
    estimatedDepthMetres: input.answers.estimatedDepthMetres,
  });
  expect(body.assessment.report.reportAudience).toBe(input.visitorType);

  if (input.verifyRetry) {
    const retryResponse = await request.post("/api/public/assessments", {
      data: submissionData,
    });
    const retryBody = await retryResponse.json();
    expect(retryResponse.status(), JSON.stringify(retryBody)).toBe(200);
    expect(retryBody.assessment.id).toBe(body.assessment.id);
    expect(retryBody.assessment.report.reportAudience).toBe(input.visitorType);
  }
  return { id: body.assessment.id as string };
}

function signedSnapshot(
  constructability: ConstructabilityAnswers,
  evidence: TrustedConstructabilityEvidence,
) {
  const detailedChecks = {
    status: "complete",
    layers: [...queryableDatasetKeys, "culverts"].map((key) => ({
      key,
      state: "verified_empty",
      geometry: null,
      message: "Synthetic empty result",
      evidence: {
        provider: "Synthetic Council GIS",
        dataset: key,
        datasetIdentifier: key,
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "report_allowed",
        retrievedAt: new Date().toISOString(),
        datasetDate: null,
        licence: "Synthetic test licence",
        attribution: null,
        geometryUsed: "bounded query",
        attributesUsed: [],
        evidenceType: "vector",
        confidence: "limited",
        featureCount: 0,
      },
    })),
    retrievedAt: new Date().toISOString(),
    durationMs: 1,
    region: "Auckland",
    limitations: ["Synthetic RG-345 persistence evidence."],
  };
  const snapshot = {
    submissionId: randomUUID(),
    expiresAt: Date.now() + 15 * 60_000,
    lockedEstimatedDepthMetres: constructability.estimatedDepthMetres,
    fastResult: {
      requestedAddress: "345 Release Evidence Road, Auckland",
      resolvedAddress: {
        addressId: `rg345-${randomUUID()}`,
        fullAddress: "345 Release Evidence Road, Auckland",
        fullAddressNumber: "345",
        unit: null,
        territorialAuthority: "Auckland",
        coordinates: [174.6082, -36.8603],
      },
      boundary: {
        state: "provisional",
        geometry: null,
        areaSquareMetres: null,
        parcelId: null,
      },
      aerial: { state: "unavailable", durationMs: null, attribution: null },
      datasets: {
        address_resolution: officialDatasetEvidence(
          "address_resolution",
          detailedChecks.retrievedAt,
        ),
        legal_parcel: null,
        aerial_imagery: null,
      },
      defaultPool: {
        id: "compact",
        label: "Compact",
        lengthMetres: 6.5,
        widthMetres: 3,
      },
      progress: {
        address: "found",
        boundary: "provisional",
        aerial: "unavailable",
        detailedChecks: "loaded",
      },
      firstUsableViewStartedAt: new Date().toISOString(),
      fastPathDurationMs: 1,
      detailedChecks,
    },
    constructability: { answers: constructability, evidence },
  };
  const payload = Buffer.from(JSON.stringify(snapshot), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", signingKey)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
