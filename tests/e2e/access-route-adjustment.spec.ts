import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { getSavedPreliminaryReportById } from "@/db/repositories/homeowner-assessment-repository";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";

const databaseUrl = process.env.DATABASE_URL_DEV;
const signingKey =
  process.env.INTERNAL_REPORT_SIGNING_SECRET ??
  "playwright-report-signing-secret-2026-07-22-at-least-32-bytes";

test("adjusts a credible access route by keyboard and signs the changed line", async ({
  page,
}) => {
  test.skip(!databaseUrl, "DATABASE_URL_DEV is required for persistence E2E.");
  test.setTimeout(90_000);
  const db = drizzle(neon(databaseUrl!), { schema });
  const parcel = {
    type: "Polygon",
    coordinates: [
      [
        [174.76, -36.8501],
        [174.7603, -36.8501],
        [174.7603, -36.8497],
        [174.76, -36.8497],
        [174.76, -36.8501],
      ],
    ],
  };
  const base = {
    requestedAddress: "1 Test Street, Auckland",
    resolvedAddress: {
      addressId: "test-route-1",
      fullAddress: "1 Test Street, Auckland",
      fullAddressNumber: "1",
      unit: null,
      territorialAuthority: "Auckland",
      coordinates: [174.76, -36.8499],
    },
    boundary: {
      state: "confirmed",
      geometry: parcel,
      areaSquareMetres: 1000,
      parcelId: "test-parcel",
    },
    aerial: { state: "unavailable", durationMs: null, attribution: null },
    datasets: {
      address_resolution: officialDatasetEvidence(
        "address_resolution",
        "2026-09-18T00:00:00.000Z",
      ),
      legal_parcel: officialDatasetEvidence(
        "legal_parcel",
        "2026-09-18T00:00:00.000Z",
      ),
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
      boundary: "found",
      aerial: "unavailable",
      detailedChecks: "not_loaded",
    },
    firstUsableViewStartedAt: "2026-09-18T00:00:00.000Z",
    fastPathDurationMs: 10,
  };
  await page.route("**/api/public/property-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: signedSnapshot(base),
        data: base,
      }),
    }),
  );
  await page.route("**/api/public/property-check/stages", (route) => {
    const request = route.request().postDataJSON() as { mode?: string };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        request.mode === "detailed"
          ? {
              assessmentSnapshot: signedSnapshot(
                {
                  ...base,
                  detailedChecks: {
                    status: "complete",
                    layers: syntheticLayers("2026-09-18T00:00:01.000Z"),
                    terrain: {
                      status: "measured",
                      upperSlopeDegrees: 2,
                      averageSlopeDegrees: 1,
                      estimatedFallMetres: 0.1,
                      source: { evidenceUse: "report_allowed" },
                    },
                    retrievedAt: "2026-09-18T00:00:01.000Z",
                    durationMs: 1,
                    region: "Auckland",
                    limitations: [],
                  },
                },
                1.5,
              ),
              data: {
                status: "complete",
                layers: [
                  {
                    key: "building_footprints",
                    state: "verified_empty",
                    geometry: null,
                  },
                ],
                terrain: {
                  status: "measured",
                  upperSlopeDegrees: 2,
                  averageSlopeDegrees: 1,
                  estimatedFallMetres: 0.1,
                  source: { evidenceUse: "report_allowed" },
                },
                retrievedAt: "2026-09-18T00:00:01.000Z",
                durationMs: 1,
                region: "Auckland",
                limitations: [],
              },
            }
          : {
              assessmentSnapshot: signedSnapshot(base),
              data: {
                boundary: base.boundary,
                aerial: base.aerial,
                datasets: {},
                progress: base.progress,
                fastPathDurationMs: 10,
              },
            },
      ),
    });
  });
  let posted: Record<string, unknown> | null = null;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/public/assessment-snapshot/site-answers")
    ) {
      posted = request.postDataJSON() as Record<string, unknown>;
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill("1 Test Street, Auckland");
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: "My property" }).check();
  await page.getByRole("button", { name: "Check for constraints" }).click();
  const routeQuestion = page.getByRole("group", {
    name: "Suggested access route",
  });
  await expect(
    routeQuestion.getByRole("radio", { name: "Confirm route" }),
  ).toBeVisible();
  await routeQuestion
    .getByRole("button", { name: "Add turning point" })
    .click();
  const marker = page.getByRole("button", {
    name: /Access route turning point 1/,
  });
  await expect(marker).toBeVisible();
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  const bounds = await marker.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2 + 12,
    bounds!.y + bounds!.height / 2 + 8,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(routeQuestion.getByText("Approximate length")).toBeVisible();
  await routeQuestion
    .getByRole("button", { name: "Add turning point" })
    .click();
  await expect(
    routeQuestion.getByRole("button", { name: "Add turning point" }),
  ).toBeDisabled();
  await page
    .getByRole("group", {
      name: "Are there any visible conditions that could affect construction access or excavation?",
    })
    .getByRole("checkbox", { name: "None of these" })
    .check();
  await page
    .getByRole("group", {
      name: "Which existing features are close to the proposed pool area?",
    })
    .getByRole("checkbox", { name: "None of these" })
    .check();
  await page.getByRole("button", { name: "Continue to your details" }).click();
  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({
    routeResponse: "adjust",
    adjustedRoute: { type: "LineString", coordinates: expect.any(Array) },
  });
  expect(
    (posted!.adjustedRoute as { coordinates: unknown[] }).coordinates,
  ).toHaveLength(4);

  const form = page.locator(
    'form[aria-labelledby="homeowner-details-heading"]',
  );
  await form.getByLabel("Name").fill("Synthetic Route Evidence");
  await form.getByLabel("Phone").fill("021 555 0345");
  await form.getByLabel("Email").fill("rg345-route@example.test");
  await form.getByRole("checkbox", { name: /I consent to PoolReady/i }).check();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/assessments") &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Save and show my report" }).click();
  const response = await responsePromise;
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(201);
  const assessmentId = body.assessment.id as string;
  try {
    const persisted = await getSavedPreliminaryReportById(db, assessmentId);
    expect(persisted?.constructability).toMatchObject({
      version: 1,
      route: {
        provenance: "user-supplied",
        geometry: { type: "LineString", coordinates: expect.any(Array) },
      },
      routeFacts: expect.objectContaining({ valid: true }),
    });
    expect(
      (
        persisted!.constructability as {
          route: { geometry: { coordinates: unknown[] } };
        }
      ).route.geometry.coordinates,
    ).toHaveLength(4);
  } finally {
    await db
      .delete(schema.homeownerAssessments)
      .where(eq(schema.homeownerAssessments.id, assessmentId));
  }
});

function signedSnapshot(
  fastResult: unknown,
  lockedEstimatedDepthMetres?: number,
) {
  const snapshot = {
    submissionId: randomUUID(),
    fastResult,
    expiresAt: Date.now() + 15 * 60_000,
    ...(lockedEstimatedDepthMetres === undefined
      ? {}
      : { lockedEstimatedDepthMetres }),
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
