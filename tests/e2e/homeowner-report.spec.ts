import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
const mailCapturePath = resolve("tmp/audience-path-compatibility/emails.jsonl");

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
  test.setTimeout(420_000);
  const db = drizzle(neon(databaseUrl!), { schema });
  const assessmentIds: string[] = [];
  const submittedAudiences: string[] = [];
  let detailedJourneyCount = 0;

  await writeFile(mailCapturePath, "");

  await page.route("**/api/public/property-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: signedSnapshot(baseResult),
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
    if (request.mode === "detailed") detailedJourneyCount += 1;
    const homeownerJourney = detailedJourneyCount <= 2;
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
        assessmentSnapshot:
          request.mode !== "detailed"
            ? signedSnapshot(result)
            : homeownerJourney
              ? signedSnapshot(result, depth)
              : signedSnapshot(result, depth, availableEvidence()),
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
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await startJourney(page, 1.7, {
      rejectAnalytics: true,
      visitorType: "homeowner",
    });
    await assertConsentAndValidation(page);
    const genericHomeowner = await submitAndReadRealResponse(page);
    assessmentIds.push(genericHomeowner.id);
    submittedAudiences.push(genericHomeowner.request.homeowner.visitorType);

    const genericHomeownerPersisted = await getSavedPreliminaryReportById(
      db,
      genericHomeowner.id,
    );
    expect(genericHomeownerPersisted).not.toBeNull();
    expect(genericHomeownerPersisted!.reportAudience).toBe("homeowner");
    expect(genericHomeowner.response.report.reportAudience).toBe("homeowner");
    const homeownerEmailPdf = await assertDeliveredProjection({
      page,
      accessToken: genericHomeowner.response.reportAccessToken,
      reference: genericHomeowner.response.reference,
      expectedAudience: "homeowner",
    });
    const homeownerEndpointPdf = await readSavedPdf(
      page,
      genericHomeowner.response.reportAccessToken,
    );
    expect(homeownerEndpointPdf).toEqual(homeownerEmailPdf);
    expect(genericHomeownerPersisted!.constructability).toMatchObject({
      version: 0,
      status: "not_assessed",
    });
    await expect(
      page.getByRole("region", { name: "Site constructability" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "What your pool builder will confirm",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Arrange an onsite visit with a pool builder."),
    ).toBeVisible();
    await expect(page.getByText("Estimated pool depth")).toHaveCount(0);
    await expect(page.getByText(/Firth masonry guidance/i)).toHaveCount(0);
    await expect(
      page.getByText(/user-selected-side-clearance-v1/i),
    ).toHaveCount(0);
    for (const sectionName of ["At a glance", "Site assessment"]) {
      const section = page.getByRole("region", { name: sectionName });
      await expect(
        section.getByText("Pool safety barrier", { exact: true }),
      ).toHaveCount(0);
      await expect(
        section.getByText("Construction access", { exact: true }),
      ).toHaveCount(0);
    }
    await expect(
      page
        .getByRole("region", { name: "At a glance" })
        .getByText("Not assessed")
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(genericHomeowner.response.reference),
    ).toBeVisible();
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

    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await startJourney(page, 1.5, {
      entry: "builder_landing",
      visitorType: "homeowner",
    });
    const switchedHomeownerForm = page.locator(
      'form[aria-labelledby="homeowner-details-heading"]',
    );
    await expect(switchedHomeownerForm).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: "Estimated pool depth (m)" }),
    ).toHaveCount(0);

    await startJourney(page, 1.5, { visitorType: "pool_builder" });
    await answerSiteQuestions(page, {
      accessCondition: "Restricted gate or narrow access",
      sideClearanceMillimetres: 200,
    });
    const genericBuilderForm = page.locator(
      'form[aria-labelledby="homeowner-details-heading"]',
    );
    await expect(
      genericBuilderForm.getByLabel("Company / trading name (optional)"),
    ).toBeVisible();
    await fillValidDetails(genericBuilderForm);
    await genericBuilderForm
      .getByLabel("Company / trading name (optional)")
      .fill("North Shore Pools Ltd");
    const genericBuilder = await submitAndReadRealResponse(page);
    assessmentIds.push(genericBuilder.id);
    submittedAudiences.push(genericBuilder.request.homeowner.visitorType);

    const genericBuilderPersisted = await getSavedPreliminaryReportById(
      db,
      genericBuilder.id,
    );
    expect(genericBuilderPersisted).not.toBeNull();
    expect(genericBuilderPersisted!.reportAudience).toBe("pool_builder");
    expect(genericBuilder.response.report.reportAudience).toBe("pool_builder");
    const builderEmailPdf = await assertDeliveredProjection({
      page,
      accessToken: genericBuilder.response.reportAccessToken,
      reference: genericBuilder.response.reference,
      expectedAudience: "pool_builder",
    });
    const builderEndpointPdf = await readSavedPdf(
      page,
      genericBuilder.response.reportAccessToken,
    );
    expect(builderEndpointPdf).toEqual(builderEmailPdf);
    expect(builderEndpointPdf).not.toEqual(homeownerEndpointPdf);
    expect(genericBuilder.request.homeowner.builderCompanyName).toBe(
      "North Shore Pools Ltd",
    );
    expect(genericBuilder.response.builderCompanyName).toBe(
      "North Shore Pools Ltd",
    );
    await expect(
      db.query.homeownerAssessments.findFirst({
        columns: { builderCompanyName: true },
        where: eq(schema.homeownerAssessments.id, genericBuilder.id),
      }),
    ).resolves.toEqual({ builderCompanyName: "North Shore Pools Ltd" });
    expect(genericBuilderPersisted!.constructability).toEqual(
      genericBuilder.response.report.constructability,
    );
    expect(genericBuilderPersisted!.constructability).toMatchObject({
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
    const builderConstructability = page.getByRole("region", {
      name: "Site constructability",
    });
    await expect(builderConstructability).toContainText("1.50 m");
    await expect(builderConstructability).toContainText("Needs checking");
    await expect(builderConstructability).toContainText(
      "Your Site answer: Gate or narrow passage",
    );
    await expect(
      page.getByText("Company / trading name: North Shore Pools Ltd"),
    ).toBeVisible();
    await expect(builderConstructability).toContainText(
      "Indicative planning volumes only — not a quote, specification or upper bound.",
    );
    await expect(page.getByText(/Firth masonry guidance/i)).toHaveCount(0);
    await expect(
      page.getByText(/user-selected-side-clearance-v1/i),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Saved assessment map" })
        .getByRole("region", { name: "Saved pool-shell clearances" }),
    ).toContainText("Measurements unavailable");

    await startJourney(page, 1.5, { visitorType: "pool_builder" });
    await answerSiteQuestions(page, { accessCondition: "I’m not sure" });
    await expect(
      page.locator('form[aria-labelledby="homeowner-details-heading"]'),
    ).toBeVisible();

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
  options: {
    entry?: "generic" | "builder_landing";
    rejectAnalytics?: boolean;
    visitorType?: "homeowner" | "pool_builder";
  } = {},
) {
  const {
    entry = "generic",
    rejectAnalytics = false,
    visitorType = "homeowner",
  } = options;
  if (entry === "builder_landing") {
    await page.goto("/auckland-pool-planning-for-builders");
    await page
      .getByRole("link", { name: "Check a property with PoolReady" })
      .click();
    await expect(page).toHaveURL(/audience=pool_builder/);
  } else {
    await page.goto("/");
  }
  if (rejectAnalytics) {
    await page.getByRole("button", { name: "Reject analytics" }).click();
  }
  const pathway = page.getByRole("radiogroup", {
    name: "Who are you checking this property for?",
  });
  const chosenPath = pathway.getByRole("radio", {
    name:
      visitorType === "pool_builder" ? "A customer property" : "My property",
  });
  const builderPath = pathway.getByRole("radio", {
    name: "A customer property",
  });
  if (entry === "builder_landing") {
    await expect(builderPath).toBeChecked();
    if (visitorType === "homeowner") {
      await chosenPath.click();
      await expect(chosenPath).toBeChecked();
    }
  } else {
    await expect(chosenPath).not.toBeChecked();
    await chosenPath.focus();
    await page.keyboard.press("Space");
    await expect(chosenPath).toBeChecked();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill("42A Bahari Drive, Ranui, Auckland");
  await page.keyboard.press("Enter");
  const depthInput = page.getByRole("spinbutton", {
    name: "Estimated pool depth (m)",
  });
  await page.getByRole("button", { name: "Use this pool position" }).click();
  if (visitorType === "homeowner") {
    await expect(depthInput).toHaveCount(0);
    await page.getByRole("button", { name: "Check this property" }).click();
    await expect(
      page.getByRole("heading", { name: "Pool builder site questions" }),
    ).toHaveCount(0);
    await expect(
      page.locator('form[aria-labelledby="homeowner-details-heading"]'),
    ).toBeVisible();
    await expect(
      page.getByLabel("Company / trading name (optional)"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Your details for the preliminary report",
      }),
    ).toBeFocused();
    return;
  }
  await expect(depthInput).toHaveValue("1.5");
  if (depth !== 1.5) await depthInput.fill(String(depth));
  await expect(depthInput).toBeEnabled();
}

async function assertConsentAndValidation(page: Page) {
  const form = page.locator(
    'form[aria-labelledby="homeowner-details-heading"]',
  );
  await expect(
    form.getByRole("link", { name: "privacy notice", exact: true }),
  ).toHaveAttribute("href", "/privacy");
  await fillValidDetails(form);
  await expect(form.getByLabel("I am a")).toHaveCount(0);
  const additionalInfo = form.getByLabel("Additional Info (optional)");
  await additionalInfo.fill("[sql] [sql]");
  await form.getByRole("button", { name: "Save and show my report" }).click();
  await expect(additionalInfo).toHaveAccessibleDescription(
    "Please use plain text and common punctuation only.",
  );
  await expect(additionalInfo).toBeFocused();
  await additionalInfo.fill("Please call before visiting.");
}

async function fillValidDetails(form: Locator) {
  await form
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Synthetic Release Homeowner");
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

async function readSavedPdf(page: Page, accessToken: string) {
  const response = await page.request.post(
    "/api/public/assessments/report/pdf",
    { data: { accessToken } },
  );
  const bytes = await response.body();
  expect(response.status(), bytes.toString("utf8")).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(bytes.subarray(0, 4).toString("ascii")).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(1_000);
  return Uint8Array.from(bytes);
}

async function assertDeliveredProjection({
  page,
  accessToken,
  reference,
  expectedAudience,
}: {
  page: Page;
  accessToken: string;
  reference: string;
  expectedAudience: "homeowner" | "pool_builder";
}) {
  await expect
    .poll(
      async () => {
        const response = await page.request.post(
          "/api/public/assessments/report/delivery/status",
          { data: { accessToken } },
        );
        if (!response.ok()) {
          return {
            httpStatus: response.status(),
            body: await response.text(),
          };
        }
        return (await response.json()).delivery;
      },
      { intervals: [2_000, 5_000, 10_000, 15_000], timeout: 90_000 },
    )
    .toEqual({ homeowner: "sent", internal_test_report: "sent" });

  const captured = (await readFile(mailCapturePath, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          idempotencyKey: string;
          body: {
            to: string[];
            html: string;
            text: string;
            attachments?: Array<{ content: string; filename: string }>;
          };
        },
    );
  const recipient = captured.find(
    (message) =>
      message.idempotencyKey === `assessment-report/${reference}/homeowner`,
  );
  expect(recipient).toBeDefined();
  expect(recipient!.body.to).toEqual(["rg345-public-e2e@example.test"]);
  expect(recipient!.body.attachments).toHaveLength(1);
  expect(
    Buffer.from(recipient!.body.attachments![0].content, "base64")
      .subarray(0, 4)
      .toString("ascii"),
  ).toBe("%PDF");
  const content = `${recipient!.body.html}\n${recipient!.body.text}`;
  if (expectedAudience === "homeowner") {
    expect(content).toContain("What your pool builder will confirm");
    expect(content).not.toContain("Site constructability");
  } else {
    expect(content).toContain("Site constructability");
    expect(content).toContain("Indicative planning volumes only");
  }
  return Uint8Array.from(
    Buffer.from(recipient!.body.attachments![0].content, "base64"),
  );
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

function signedSnapshot(
  fastResult: unknown,
  depth?: number,
  evidence?: TrustedConstructabilityEvidence,
) {
  const snapshot = {
    submissionId: randomUUID(),
    fastResult,
    expiresAt: Date.now() + 15 * 60_000,
    ...(depth !== undefined ? { lockedEstimatedDepthMetres: depth } : {}),
    ...(depth !== undefined && evidence
      ? {
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
        }
      : {}),
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
