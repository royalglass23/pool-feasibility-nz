import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { getSavedPreliminaryReportById } from "@/db/repositories/homeowner-assessment-repository";
import type { TrustedConstructabilityEvidence } from "@/modules/assessment/constructability-evidence";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";
import { answerSiteQuestions } from "./site-questions-helper";

const databaseUrl = process.env.DATABASE_URL_DEV;
const signingKey =
  process.env.INTERNAL_REPORT_SIGNING_SECRET ??
  "playwright-report-signing-secret-2026-07-22-at-least-32-bytes";

const baseResult = {
  requestedAddress: "42A Bahari Drive, Ranui, Auckland",
  resolvedAddress: {
    addressId: "rg345-public-journey",
    fullAddress: "42A Bahari Drive, Ranui, Auckland",
    fullAddressNumber: "42A",
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
      "2026-07-28T00:00:00.000Z",
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
    detailedChecks: "not_loaded",
  },
  firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
  fastPathDurationMs: 120,
};

test("saves and reproduces the complete public constructability journey through production boundaries", async ({
  page,
}) => {
  test.skip(!databaseUrl, "DATABASE_URL_DEV is required for persistence E2E.");
  test.setTimeout(180_000);
  const db = drizzle(neon(databaseUrl!), { schema });
  const assessmentIds: string[] = [];
  const submittedAudiences: string[] = [];

  await page.route("**/api/public/property-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: signedSnapshot(
          baseResult,
          1.5,
          availableEvidence(),
        ),
        data: baseResult,
      }),
    }),
  );
  await page.route("**/api/public/property-check/stages", async (route) => {
    const request = route.request().postDataJSON() as {
      mode?: string;
      estimatedDepthMetres?: number;
    };
    const depth = request.estimatedDepthMetres ?? 1.5;
    const firstJourney = submittedAudiences.length === 0;
    const detailedChecks = {
      status: "complete",
      layers: syntheticLayers("2026-07-28T00:00:01.000Z"),
      retrievedAt: "2026-07-28T00:00:01.000Z",
      durationMs: 20,
      region: "Auckland",
      limitations: ["Mapped evidence requires onsite verification."],
    };
    const result =
      request.mode === "detailed"
        ? { ...baseResult, detailedChecks }
        : baseResult;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: signedSnapshot(
          result,
          depth,
          firstJourney ? providerFailureEvidence() : availableEvidence(),
        ),
        data:
          request.mode === "detailed"
            ? detailedChecks
            : {
                boundary: baseResult.boundary,
                aerial: baseResult.aerial,
                datasets: {},
                progress: baseResult.progress,
                fastPathDurationMs: 150,
              },
      }),
    });
  });

  let publicPdfRequests = 0;
  await page.route("**/api/public/assessments/report/pdf", async (route) => {
    publicPdfRequests += 1;
    await route.abort();
  });

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await startJourney(page, 1.7, true);
    await answerSiteQuestions(page);
    await assertConsentAndValidation(page);
    const first = await submitAndReadRealResponse(page);
    assessmentIds.push(first.id);
    submittedAudiences.push(first.request.homeowner.visitorType);

    const firstPersisted = await getSavedPreliminaryReportById(db, first.id);
    expect(firstPersisted).not.toBeNull();
    expect(firstPersisted!.reportAudience).toBe("homeowner");
    expect(first.response.report.reportAudience).toBe("homeowner");
    expect(firstPersisted!.constructability).toEqual(
      first.response.report.constructability,
    );
    expect(firstPersisted!.constructability).toMatchObject({
      version: 1,
      estimatedDepthMetres: 1.7,
      overallStatus: "not_fully_assessed",
      providerAvailability: expect.arrayContaining([
        expect.objectContaining({
          category: "terrain_ground",
          status: "error",
        }),
      ]),
    });
    const constructability = page.getByRole("region", {
      name: "Site constructability",
    });
    await expect(constructability).toContainText("1.70 m");
    await expect(constructability).toContainText("Not fully assessed");
    await expect(constructability).toContainText("provider error");
    await expect(page.getByText(first.response.reference)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend report" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        /We will email a summary of this preliminary report shortly/i,
      ),
    ).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 720 });
    await startJourney(page, 1.5);
    await answerSiteQuestions(page, {
      accessCondition: "Gate or narrow passage",
      sideClearanceMillimetres: 200,
    });
    const secondForm = page.locator(
      'form[aria-labelledby="homeowner-details-heading"]',
    );
    await fillValidDetails(secondForm, "pool_builder");
    const second = await submitAndReadRealResponse(page);
    assessmentIds.push(second.id);
    submittedAudiences.push(second.request.homeowner.visitorType);

    const secondPersisted = await getSavedPreliminaryReportById(db, second.id);
    expect(secondPersisted).not.toBeNull();
    expect(secondPersisted!.reportAudience).toBe("pool_builder");
    expect(second.response.report.reportAudience).toBe("pool_builder");
    expect(secondPersisted!.constructability).toEqual(
      second.response.report.constructability,
    );
    expect(secondPersisted!.constructability).toMatchObject({
      version: 1,
      estimatedDepthMetres: 1.5,
      excavationSideAllowanceMetres: 0.2,
      excavationGeometry: {
        version: 2,
        assumptionId: "user-selected-side-clearance-v1",
        sideAllowanceMetres: 0.2,
        selectionSource: "user_adjusted",
      },
      overallStatus: "needs_checking",
      userEvidence: expect.arrayContaining([
        { category: "access_excavation", condition: "gate_or_narrow_passage" },
      ]),
    });
    const secondConstructability = page.getByRole("region", {
      name: "Site constructability",
    });
    await expect(secondConstructability).toContainText("1.50 m");
    await expect(secondConstructability).toContainText("Needs checking");
    await expect(secondConstructability).toContainText(
      "Your Site answer: Gate or narrow passage",
    );
    await expect(
      page
        .getByRole("region", { name: "Saved assessment map" })
        .getByRole("region", { name: "Saved pool-shell clearances" }),
    ).toHaveCount(0);
    expect(submittedAudiences).toEqual(["homeowner", "pool_builder"]);
    expect(publicPdfRequests).toBe(0);
  } finally {
    for (const id of assessmentIds) {
      await db
        .delete(schema.homeownerAssessments)
        .where(eq(schema.homeownerAssessments.id, id));
    }
  }
});

async function startJourney(
  page: Page,
  depth: 1.5 | 1.7,
  rejectAnalytics = false,
) {
  await page.goto("/");
  if (rejectAnalytics) {
    await page.getByRole("button", { name: "Reject analytics" }).click();
  }
  await page
    .getByLabel("Auckland property address")
    .fill("42A Bahari Drive, Ranui, Auckland");
  await page.keyboard.press("Enter");
  const depthInput = page.getByRole("spinbutton", {
    name: "Estimated pool depth (m)",
  });
  await expect(depthInput).toHaveValue("1.5");
  if (depth !== 1.5) await depthInput.fill(String(depth));
  await page.getByRole("button", { name: "Check for constraints" }).click();
  await expect(depthInput).toBeDisabled();
  await page.getByRole("button", { name: /Map layers/ }).click();
  const routeQuestion = page.getByRole("group", {
    name: "Suggested access route",
  });
  await expect(
    routeQuestion.getByRole("radio", { name: "I’m not sure" }),
  ).toBeChecked();
}

async function assertConsentAndValidation(page: Page) {
  const form = page.locator(
    'form[aria-labelledby="homeowner-details-heading"]',
  );
  await expect(
    form.getByRole("link", { name: "privacy notice", exact: true }),
  ).toHaveAttribute("href", "/privacy");
  await fillValidDetails(form, "homeowner");
  const additionalInfo = form.getByLabel("Additional Info (optional)");
  await additionalInfo.fill("[sql] [sql]");
  await form.getByRole("button", { name: "Save and show my report" }).click();
  await expect(additionalInfo).toHaveAccessibleDescription(
    "Please use plain text and common punctuation only.",
  );
  await expect(additionalInfo).toBeFocused();
  await additionalInfo.fill("Please call before visiting.");
}

async function fillValidDetails(
  form: Locator,
  visitorType: "homeowner" | "pool_builder",
) {
  await form.getByLabel("I am a").selectOption(visitorType);
  await form.getByLabel("Name").fill("Synthetic Release Homeowner");
  await form.getByLabel("Phone").fill("021 555 0345");
  await form.getByLabel("Email").fill("rg345-public-e2e@example.test");
  await form.getByRole("checkbox", { name: /I consent to PoolReady/i }).check();
}

async function submitAndReadRealResponse(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/assessments") &&
      response.request().method() === "POST",
  );
  const form = page.locator(
    'form[aria-labelledby="homeowner-details-heading"]',
  );
  await form.getByRole("button", { name: "Save and show my report" }).click();
  await expect(
    page.getByRole("dialog", { name: "Saving your assessment" }),
  ).toBeVisible();
  const response = await responsePromise;
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Preliminary pool feasibility report" }),
  ).toBeVisible();
  return {
    id: body.assessment.id as string,
    response: body.assessment,
    request: response.request().postDataJSON(),
  };
}

function availableEvidence(): TrustedConstructabilityEvidence {
  return {
    suggestedRoute: null,
    mappedEvidence: [],
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
    assumptions: ["Synthetic RG-345 release evidence."],
  };
}

function providerFailureEvidence(): TrustedConstructabilityEvidence {
  const evidence = availableEvidence();
  return {
    ...evidence,
    providerAvailability: evidence.providerAvailability.map((provider) =>
      provider.category === "terrain_ground"
        ? { ...provider, status: "error" as const }
        : provider,
    ),
  };
}

function signedSnapshot(
  fastResult: unknown,
  depth: number,
  evidence: TrustedConstructabilityEvidence,
) {
  const snapshot = {
    submissionId: randomUUID(),
    fastResult,
    expiresAt: Date.now() + 15 * 60_000,
    lockedEstimatedDepthMetres: depth,
    constructability: {
      answers: {
        version: 1,
        estimatedDepthMetres: depth,
        route: { provenance: "uncertain", geometry: null },
        accessConditions: ["none_of_these"],
        nearbyFeatures: ["none_of_these"],
      },
      evidence,
    },
  };
  const payload = Buffer.from(JSON.stringify(snapshot), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", signingKey)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function syntheticLayers(retrievedAt: string) {
  return [...queryableDatasetKeys, "culverts"].map((key) => ({
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
      retrievedAt,
      datasetDate: null,
      licence: "Synthetic test licence",
      attribution: null,
      geometryUsed: "bounded query",
      attributesUsed: [],
      evidenceType: "vector",
      confidence: "limited",
      featureCount: 0,
    },
  }));
}
