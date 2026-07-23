import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import providerFixtures from "../fixtures/providers/official-property-layers.json";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { issueSessionReportToken } from "@/modules/reporting/report-token";
import { assessFeasibility } from "@/modules/scoring/assess-feasibility";
import type { PoolScenarioComparison } from "@/modules/spatial/analyze-pool-scenarios";

const address = "42A Bahari Drive, Ranui, Auckland";
const secondAddress = "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland";

test("supports manual placement controls, validation, rotation, and conflict states", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult }),
    });
  });
  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(
    page.getByRole("heading", { name: "Manual pool placement" }),
  ).toBeVisible();
  await expect(page.getByText("Pool shell", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Advisory aerial imagery conflict review"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Custom size" }).click();
  await page.getByLabel("Length (m)").fill("31");
  await page.getByLabel("Width (m)").fill("4");
  await expect(
    page.getByText("Enter length and width between 0.1 m and 30 m", {
      exact: false,
    }),
  ).toBeVisible();

  await page.getByLabel("Length (m)").fill("8");
  await expect(page.getByText("Selected shell: 8 m × 4 m.")).toBeVisible();
  await page.getByRole("button", { name: "Rotate 15°" }).click();
  await expect(page.getByText(/Rotation: 15°/)).toBeVisible();
});

test("shows three ranked assisted placement options for a custom size", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    const empty = { type: "FeatureCollection", features: [] };
    const available = [
      "building_footprints",
      "planning_zone",
      "planning_overlays",
      "flood_prone_areas",
      "flood_plains",
      "overland_flow_paths",
      "wastewater_assets",
      "public_water_assets",
      "public_stormwater_assets",
    ];
    const datasets = { ...dataAccessResult.datasets } as Record<
      string,
      Record<string, unknown>
    >;
    for (const key of available) {
      datasets[key as keyof typeof datasets] = {
        ...datasets[key as keyof typeof datasets],
        status: "success",
        geometry: empty,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...dataAccessResult, datasets } }),
    });
  });
  await page.route("**/api/internal/aerial-conflicts", async (route) => {
    const request = route.request().postDataJSON() as {
      candidate: { id: string };
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "provider",
        candidateId: request.candidate.id,
        findings: [
          {
            type: "vegetation_obstruction",
            confidence: "low",
            explanation: "Visible vegetation requires onsite inspection.",
            evidenceStatus: "possible",
            inspectionRequirement: "required",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();
  await page.getByRole("button", { name: "Custom size" }).click();
  await page.getByLabel("Length (m)").fill("6");
  await page.getByLabel("Width (m)").fill("3");
  await page
    .getByRole("button", { name: "Find best available position" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Assisted placement options" }),
  ).toBeVisible();
  await expect(page.getByText("Option 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Option 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Option 3", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show this option on map" }),
  ).toHaveCount(3);
  await expect(
    page.getByText("Advisory imagery finding: onsite inspection required.", {
      exact: true,
    }),
  ).toHaveCount(3);
});

test("keeps assisted search inspection-required for an unconfirmed parcel", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...dataAccessResult,
          parcelMatch: {
            status: "containing_parcel_requires_confirmation",
            reasons: [
              "The containing parcel has not been confirmed for this address.",
            ],
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(
    page.getByText(
      "Placement controls are unavailable until the legal parcel is confirmed.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Find best available position" }),
  ).toHaveCount(0);
});

test("shows no-clear assisted placement when every tested shell overlaps a building", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    const datasets = { ...dataAccessResult.datasets } as Record<
      string,
      Record<string, unknown>
    >;
    datasets.building_footprints = {
      ...datasets.building_footprints,
      status: "success",
      geometry: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: dataAccessResult.parcel.geometry,
          },
        ],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...dataAccessResult, datasets } }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();
  await page.getByRole("button", { name: "Custom size" }).click();
  await page.getByLabel("Length (m)").fill("6");
  await page.getByLabel("Width (m)").fill("3");
  await page
    .getByRole("button", { name: "Find best available position" })
    .click();

  await expect(
    page.getByText(
      "No clear candidate is available for this size and evidence set.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
});

test("shows explicit provider failure after deterministic candidates are found", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    const empty = { type: "FeatureCollection", features: [] };
    const datasets = { ...dataAccessResult.datasets } as Record<
      string,
      Record<string, unknown>
    >;
    for (const key of [
      "building_footprints",
      "planning_zone",
      "planning_overlays",
      "flood_prone_areas",
      "flood_plains",
      "overland_flow_paths",
      "wastewater_assets",
      "public_water_assets",
      "public_stormwater_assets",
    ]) {
      datasets[key] = { ...datasets[key], status: "success", geometry: empty };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...dataAccessResult, datasets } }),
    });
  });
  await page.route("**/api/internal/aerial-conflicts", (route) =>
    route.abort("failed"),
  );

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();
  await page.getByRole("button", { name: "Custom size" }).click();
  await page.getByLabel("Length (m)").fill("6");
  await page.getByLabel("Width (m)").fill("3");
  await page
    .getByRole("button", { name: "Find best available position" })
    .click();

  await expect(
    page.getByText(
      "Clear GIS candidates were found, but the advisory imagery provider failed; onsite inspection is required.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("shows the controlled AI-enabled explanation without changing deterministic findings", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...dataAccessResult,
          assessmentExplanation: {
            source: "ai",
            heading: "Constrained AI explanation",
            paragraphs: [
              "Deterministic confidence is high at 85 out of 100.",
              "The screened pool shell range runs from 5 m by 3 m to 9 m by 4 m.",
            ],
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(
    page.getByRole("heading", { name: "Constrained AI explanation" }),
  ).toBeVisible();
  await expect(page.getByText("Constrained AI narrative")).toBeVisible();
  await expect(
    page.getByText(
      "AI does not calculate or change the deterministic score, confidence, critical flags, geometry, rankings, or size range.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feasibility assessment" }),
  ).toBeVisible();
  await expect(page.getByText("82 / 100")).toBeVisible();
});

test("shows deterministic fallback when the narrative provider is unavailable", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...dataAccessResult,
          assessmentExplanation: {
            source: "deterministic_fallback",
            heading: "Deterministic assessment explanation",
            paragraphs: [
              dataAccessResult.feasibilityAssessment.finalRecommendation,
              "Deterministic confidence is high at 85 out of 100.",
            ],
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(page.getByText("Deterministic fallback")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Deterministic assessment explanation",
    }),
  ).toBeVisible();
  await expect(page.getByText("Constrained AI narrative")).not.toBeVisible();
  await expect(
    page
      .getByText(dataAccessResult.feasibilityAssessment.finalRecommendation)
      .first(),
  ).toBeVisible();
});

test("shows, downloads, and then clears the sourced session assessment", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: dataAccessResult,
        reportToken: "controlled-report-token",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(
    page.getByRole("heading", { name: "Session assessment" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Based on available mapped information, the property appears to have potential for a residential swimming pool, subject to onsite investigation, detailed design, utility locating, title review, and applicable approvals.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Legal interests and site conditions remain unverified",
    }),
  ).toBeVisible();
  for (const phase of [
    "Before concept design",
    "Before quotations",
    "Before consent or construction",
  ]) {
    await expect(page.getByRole("heading", { name: phase })).toBeVisible();
  }
  await expect(page.getByText("Flood plains — Error")).toBeVisible();
  await expect(
    page.getByText(
      "This result exists only in the current browser session and disappears after refresh or restart. No database or durable report history exists.",
    ),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Assessment data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("session-assessment-2359811.json");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const artifactText = await readFile(downloadPath!, "utf8");
  const artifact = JSON.parse(artifactText);
  expect(artifact).toMatchObject({
    recommendation: dataAccessResult.feasibilityAssessment.finalRecommendation,
    feasibilityAssessment: dataAccessResult.feasibilityAssessment,
    scenarioComparison: {
      version: dataAccessResult.scenarioComparison.version,
      preferences: dataAccessResult.scenarioComparison.preferences,
      rankedScenarioIds: dataAccessResult.scenarioComparison.rankedScenarioIds,
      successfulShells: dataAccessResult.scenarioComparison.successfulShells,
      shellRange: dataAccessResult.scenarioComparison.shellRange,
    },
    assessmentExplanation: null,
    session: { persistence: "none" },
  });
  expect(artifact.scenarioComparison.scenarios).toHaveLength(
    dataAccessResult.scenarioComparison.scenarios.length,
  );
  expect(artifact.risks[0]).toMatchObject({
    category: "Legal and site due diligence",
    specialistReviewRequired: true,
  });
  expect(artifact.provenance.datasets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "flood_plains",
        status: "error",
      }),
    ]),
  );
  expect(artifactText).not.toMatch(
    /"(?:coordinates|geometry|attributesUsed|durationMs|apiKey)"\s*:/i,
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Session assessment" }),
  ).not.toBeVisible();
});

test("keeps pool scenario status badges on one line", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: dataAccessResult,
        reportToken: "controlled-report-token",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  const badges = page.getByText("Possible fit — site checks needed", {
    exact: true,
  });
  await expect(badges.first()).toBeVisible();
  for (const badge of await badges.all()) {
    const lineCount = await badge.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    });
    expect(lineCount).toBe(1);
  }
});

test("previews all three report pages and downloads the generated PDF", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: dataAccessResult,
        reportToken: "controlled-report-token",
      }),
    });
  });
  await page.route("**/api/internal/report/pdf", async (route) => {
    const request = route.request().postDataJSON() as {
      reportToken: string;
      mapImageDataUrl: string;
    };
    expect(request.reportToken).toBe("controlled-report-token");
    expect(request.mapImageDataUrl).toMatch(/^data:image\/png;base64,/);
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition":
          'attachment; filename="pool-feasibility-2359811.pdf"',
      },
      body: Buffer.from("%PDF-controlled"),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await expect(page.getByText("Imagery verified")).toBeVisible();
  await page.getByRole("button", { name: "Preview PDF report" }).click();

  await expect(
    page.getByRole("heading", { name: "PDF report preview" }),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 3 · A4")).toBeVisible();
  await page.getByRole("button", { name: "2" }).click();
  await expect(
    page.getByRole("heading", { name: "Mapped property evidence" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3" }).click();
  await expect(
    page.getByRole("heading", { name: "What needs attention next" }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pool-feasibility-2359811.pdf");
});

test("prints all three preview pages when server PDF generation is unavailable", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: dataAccessResult,
        reportToken: "controlled-report-token",
      }),
    });
  });
  await page.route("**/api/internal/report/pdf", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "REPORT_GENERATION_FAILED",
          message: "The PDF could not be generated.",
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await expect(page.getByText("Imagery verified")).toBeVisible();
  await page.getByRole("button", { name: "Preview PDF report" }).click();
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Use Print / save PDF instead.",
  );

  expect(await page.locator("#browser-print-report article").count()).toBe(3);
  await page.emulateMedia({ media: "print" });
  const browserPdf = await page.pdf({ format: "A4", printBackground: true });
  expect(
    browserPdf.toString("latin1").match(/\/Type\s*\/Page\b/g),
  ).toHaveLength(3);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => {
    Object.defineProperty(window, "print", {
      configurable: true,
      value: () => document.body.setAttribute("data-print-called", "true"),
    });
  });
  await page.getByRole("button", { name: "Print / save PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-called",
    "true",
  );
});

test("downloads the PDF with an API-issued token and browser-captured map", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const reportToken = issueSessionReportToken(
    buildSessionAssessment(
      dataAccessResult as unknown as DataAccessSpikeResult,
    ),
  );
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult, reportToken }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await expect(page.getByText("Imagery verified")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Preview PDF report" }).click();

  const responsePromise = page.waitForResponse("**/api/internal/report/pdf");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pool-feasibility-2359811.pdf");
});

test("keeps the expandable assessment and A4 preview usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await expect(
    page.getByText("Preliminary recommendation", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse all" }).click();
  await page.getByText("Limits and unknowns").click();
  await expect(
    page.getByText("Preliminary desktop assessment only"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview PDF report" }).click();
  await page.getByRole("button", { name: "3" }).click();
  await expect(
    page.getByRole("heading", { name: "What needs attention next" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("selects the exact address, prevents duplicate work, maps the parcel, and downloads the result", async ({
  page,
}) => {
  await stubAerialTiles(page);
  const submittedBodies: unknown[] = [];
  await page.route("**/api/internal/data-access", async (route) => {
    const body = route.request().postDataJSON();
    submittedBodies.push(body);
    if (!body.selectedAddressId) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "ADDRESS_AMBIGUOUS",
            message: "Select the correct Auckland address to continue.",
            options: [
              {
                addressId: "969138",
                fullAddress: "42 Bahari Drive, Ranui, Auckland",
              },
              { addressId: "2359811", fullAddress: address },
            ],
          },
        }),
      });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult }),
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Inspect official property data before assessing pool feasibility.",
    }),
  ).toBeVisible();

  await page
    .getByLabel("Auckland property address")
    .fill("Bahari Drive, Ranui, Auckland");
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: address }).click();

  await expect(
    page.getByRole("button", { name: "Fetching official data…" }),
  ).toBeDisabled();
  await expect(page.getByText("1. Resolving address")).toBeVisible();
  await expect(page.getByText("3. Loading aerial imagery")).toBeVisible();

  const resultHeading = page.getByRole("heading", { name: address });
  await expect(resultHeading).toBeVisible();
  await expect(resultHeading).toBeFocused();
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.getByText("Parcel 8545868", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("table").getByText("NZ Addresses", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: `Aerial map for ${address}` }),
  ).toBeVisible();
  await expect(page.getByText("Official map layers")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Pool size screening",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feasibility assessment" }),
  ).toBeVisible();
  await expect(page.getByText("82 / 100")).toBeVisible();
  await expect(
    page.getByText("Likely feasible with normal investigations", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("High data confidence")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Likely feasible with normal onsite and specialist investigations.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Large · 9m × 4m")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compact", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Standard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Large", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Screening evidence only - no candidate is an approved design or pool position.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "NZ Building Outlines" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Wastewater Pipes" }),
  ).toBeChecked();
  for (const dataset of requiredMappedDatasetNames) {
    await expect(
      page.getByRole("checkbox", { name: dataset, exact: true }),
    ).toBeChecked();
  }
  await expect(
    page.getByText("Dataset vintage: not published").first(),
  ).toBeVisible();
  await expect(page.getByText("Internal reference only").first()).toBeVisible();
  await page.getByRole("checkbox", { name: "NZ Building Outlines" }).click();
  await expect(
    page.getByRole("checkbox", { name: "NZ Building Outlines" }),
  ).not.toBeChecked();
  await expect(
    page.getByText("Flood Plains: provider timed out"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "© CC BY 4.0 LINZ" }).first(),
  ).toBeVisible();
  expect(submittedBodies).toEqual([
    { address: "Bahari Drive, Ranui, Auckland" },
    {
      address: "Bahari Drive, Ranui, Auckland",
      selectedAddressId: "2359811",
    },
  ]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Assessment data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("session-assessment-2359811.json");
});

test("completes the controlled journey for a second Auckland address", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: secondAddressDataAccessResult }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(secondAddress);
  await page.getByRole("button", { name: "Fetch property data" }).click();

  const resultHeading = page.getByRole("heading", { name: secondAddress });
  await expect(resultHeading).toBeFocused();
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.getByText("Parcel 4789010", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: `Aerial map for ${secondAddress}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /CC BY 4\.0 LINZ/ }).first(),
  ).toBeVisible();
  await expect(page.getByText("Large · 9m × 4m")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feasibility assessment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Deterministic assessment explanation",
    }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Assessment data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("session-assessment-2453674.json");
});

test("recommends a screened size without collecting size or location preferences", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | undefined;
  await page.route("**/api/internal/data-access", async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: dataAccessResult,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByLabel("Preferred pool size")).toHaveCount(0);
  await expect(page.getByLabel("Preferred pool location")).toHaveCount(0);
  await expect(page.getByLabel("Front boundary direction")).toHaveCount(0);
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  const comparison = page.getByRole("region", {
    name: "Pool size screening",
  });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByText("Large · 9m × 4m")).toBeVisible();
  await expect(
    comparison.getByText("Possible fit — site checks needed"),
  ).toHaveCount(1);
  await expect(
    comparison.getByText("Possible fit — specialist review needed"),
  ).toHaveCount(1);
  await expect(comparison.getByText("Named anchor")).toHaveCount(0);
  await expect(comparison.getByText("Configured intermediate")).toHaveCount(0);
  expect(submittedBody).toEqual({
    address,
  });
});

test("retries after a controlled provider failure", async ({ page }) => {
  await stubAerialTiles(page);
  let attempts = 0;
  await page.route("**/api/internal/data-access", async (route) => {
    attempts += 1;
    await route.fulfill({
      status: attempts === 1 ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1
          ? {
              error: {
                code: "DATA_PROVIDER_ERROR",
                message:
                  "An official data provider could not complete the request. Try again shortly.",
              },
            }
          : { data: dataAccessResult },
      ),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  expect(attempts).toBe(2);
});

test("shows the honest no-clear-candidate wording for a controlled screening result", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...dataAccessResult,
          scenarioComparison: {
            ...dataAccessResult.scenarioComparison,
            scenarios: dataAccessResult.scenarioComparison.scenarios.map(
              (scenario) => ({
                ...scenario,
                status: "no_clear_candidate",
                candidates: [],
              }),
            ),
            successfulShells: [],
            shellRange: null,
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(page.getByText("No clear fit for any size")).toBeVisible();
  await expect(
    page.getByText(
      "No clear pool position was found using the available property information.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/pool impossible/i)).toHaveCount(0);
});

test("revokes verified imagery and retries when a LINZ tile fails", async ({
  page,
}) => {
  await page.route("**/api/internal/aerial/tiles/**", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "AERIAL_PROVIDER_ERROR",
          message: "LINZ aerial imagery could not complete the request.",
        },
      }),
    });
  });
  let attempts = 0;
  await page.route("**/api/internal/data-access", async (route) => {
    attempts += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  await expect(page.getByText("Imagery unavailable")).toBeVisible();
  const retry = page.getByRole("button", { name: "Try imagery again" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(() => attempts).toBe(2);
});

async function stubAerialTiles(page: import("@playwright/test").Page) {
  await page.route("**/api/internal/aerial/tiles/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
}

const requiredMappedDatasetNames = [
  "NZ Building Outlines",
  "Contours 2016 - 0.25 metre contours",
  "Unitary Plan Base Zone",
  "Significant Ecological Areas Overlay (representative overlay spike)",
  "Flood Prone Areas",
  "Overland Flow Paths",
  "Stormwater Pipe",
  "Stormwater Manhole and Chamber",
  "Stormwater Catchpit",
  "Stormwater Watercourse",
  "Wastewater Pipes",
  "Water Pipes",
  "Wastewater Manholes",
  "Water Fittings",
  "Wastewater Fittings",
] as const;

type ProviderFixtureKey = keyof typeof providerFixtures;

function mappedFixtureEvidence(input: {
  key: ProviderFixtureKey;
  provider: "LINZ" | "Auckland Council" | "Watercare";
  dataset: string;
  datasetDate?: string;
}) {
  const evidenceUse =
    input.provider === "LINZ"
      ? "report_allowed"
      : input.provider === "Watercare"
        ? "internal_reference"
        : "spike_only";
  const attribution =
    input.provider === "LINZ"
      ? {
          text: "Land Information New Zealand (LINZ), CC BY 4.0",
          url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data",
        }
      : input.provider === "Watercare"
        ? {
            text: "Watercare Services Limited, CC BY-NC-ND 3.0 NZ",
            url: "https://www.watercare.co.nz/builders-and-developers/tools-fees-and-resources/gis-maps",
          }
        : {
            text: "Auckland Council geospatial data",
            url: "https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx",
          };
  const geometry = providerFixtures[input.key];

  return {
    provider: input.provider,
    dataset: input.dataset,
    status: "success",
    licenceStatus: input.provider === "LINZ" ? "permitted" : "conditional",
    evidenceUse,
    featureCount: geometry.features.length,
    datasetDate: input.datasetDate ?? null,
    attribution,
    geometry,
  };
}

const mappedFixtureDatasets = {
  building_footprints: mappedFixtureEvidence({
    key: "building_footprints",
    provider: "LINZ",
    dataset: "NZ Building Outlines",
    datasetDate: "2026-06",
  }),
  contours: mappedFixtureEvidence({
    key: "contours",
    provider: "Auckland Council",
    dataset: "Contours 2016 - 0.25 metre contours",
    datasetDate: "2016",
  }),
  planning_zone: mappedFixtureEvidence({
    key: "planning_zone",
    provider: "Auckland Council",
    dataset: "Unitary Plan Base Zone",
  }),
  planning_overlays: mappedFixtureEvidence({
    key: "planning_overlays",
    provider: "Auckland Council",
    dataset:
      "Significant Ecological Areas Overlay (representative overlay spike)",
  }),
  flood_prone_areas: mappedFixtureEvidence({
    key: "flood_prone_areas",
    provider: "Auckland Council",
    dataset: "Flood Prone Areas",
  }),
  overland_flow_paths: mappedFixtureEvidence({
    key: "overland_flow_paths",
    provider: "Auckland Council",
    dataset: "Overland Flow Paths",
  }),
  public_stormwater_assets: mappedFixtureEvidence({
    key: "public_stormwater_assets",
    provider: "Auckland Council",
    dataset: "Stormwater Pipe",
  }),
  manholes: mappedFixtureEvidence({
    key: "manholes",
    provider: "Auckland Council",
    dataset: "Stormwater Manhole and Chamber",
  }),
  catchpits: mappedFixtureEvidence({
    key: "catchpits",
    provider: "Auckland Council",
    dataset: "Stormwater Catchpit",
  }),
  watercourses: mappedFixtureEvidence({
    key: "watercourses",
    provider: "Auckland Council",
    dataset: "Stormwater Watercourse",
  }),
  wastewater_assets: mappedFixtureEvidence({
    key: "wastewater_assets",
    provider: "Watercare",
    dataset: "Wastewater Pipes",
  }),
  public_water_assets: mappedFixtureEvidence({
    key: "public_water_assets",
    provider: "Watercare",
    dataset: "Water Pipes",
  }),
  wastewater_manholes: mappedFixtureEvidence({
    key: "wastewater_manholes",
    provider: "Watercare",
    dataset: "Wastewater Manholes",
  }),
  water_fittings: mappedFixtureEvidence({
    key: "water_fittings",
    provider: "Watercare",
    dataset: "Water Fittings",
  }),
  wastewater_fittings: mappedFixtureEvidence({
    key: "wastewater_fittings",
    provider: "Watercare",
    dataset: "Wastewater Fittings",
  }),
};

const dataAccessResult = {
  requestedAddress: address,
  resolvedAddress: {
    addressId: "2359811",
    fullAddress: address,
    fullAddressNumber: "42A",
    unit: null,
    coordinates: [174.607906917203, -36.8602038189915],
  },
  addressAlternatives: [],
  parcel: {
    parcelId: "8545868",
    appellation: "Lot 1 DP 576345",
    parcelIntent: "Fee Simple Title",
    landDistrict: "North Auckland",
    titles: ["1060427"],
    surveyAreaSquareMetres: 245,
    calculatedAreaSquareMetres: 246,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [174.6078, -36.8603],
          [174.608, -36.8603],
          [174.608, -36.8601],
          [174.6078, -36.8601],
          [174.6078, -36.8603],
        ],
      ],
    },
  },
  parcelMatch: { status: "mapped_primary_parcel", reasons: [] },
  comparisonParcels: [],
  identityCheck: {
    exactAddressMatched: true,
    distinctFromAlternatives: true,
    duplicateParcelRowsRemoved: 1,
  },
  datasets: {
    ...mappedFixtureDatasets,
    address_resolution: {
      provider: "LINZ",
      dataset: "NZ Addresses",
      status: "success",
      licenceStatus: "permitted",
      evidenceUse: "report_allowed",
      featureCount: 1,
    },
    aerial_imagery: {
      provider: "LINZ",
      dataset: "LINZ Basemaps Aerial",
      status: "available",
      licenceStatus: "permitted",
      evidenceUse: "spike_only",
      durationMs: 10,
      attribution: {
        text: "© CC BY 4.0 LINZ",
        url: "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
      },
    },
    flood_plains: {
      provider: "Auckland Council",
      dataset: "Flood Plains",
      status: "error",
      licenceStatus: "conditional",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      errorCode: "PROVIDER_TIMEOUT",
      attribution: {
        text: "Auckland Council geospatial data",
        url: "https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx",
      },
    },
  },
  successfulDatasets: [
    "address_resolution",
    ...Object.keys(mappedFixtureDatasets),
  ],
  unavailableDatasets: ["flood_plains"],
  reportEligibleDatasets: ["address_resolution", "building_footprints"],
  spikeOnlyDatasets: [
    "aerial_imagery",
    "contours",
    "planning_zone",
    "planning_overlays",
    "flood_prone_areas",
    "overland_flow_paths",
    "public_stormwater_assets",
    "manholes",
    "catchpits",
    "watercourses",
  ],
  internalReferenceDatasets: [
    "wastewater_assets",
    "public_water_assets",
    "wastewater_manholes",
    "water_fittings",
    "wastewater_fittings",
  ],
  providerErrors: [{ dataset: "flood_plains", code: "PROVIDER_TIMEOUT" }],
  scenarioComparison: comparisonFixture(),
  feasibilityAssessment: assessmentFixture(),
  generatedAt: "2026-07-16T00:00:00.000Z",
  blockers: [
    "Watercare geometry is internal reference data only and must be independently verified before action",
  ],
};

const secondAddressDataAccessResult = {
  ...dataAccessResult,
  requestedAddress: secondAddress,
  resolvedAddress: {
    addressId: "2453674",
    fullAddress: secondAddress,
    fullAddressNumber: "2/49",
    unit: "2",
    coordinates: [174.899769829008, -36.8868090715903],
  },
  parcel: {
    parcelId: "4789010",
    appellation: "Lot 87 DP 67795",
    parcelIntent: "DCDB",
    landDistrict: "North Auckland",
    titles: ["NA33D/17", "NA33D/18", "NA33D/19"],
    surveyAreaSquareMetres: 675,
    calculatedAreaSquareMetres: 676,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [174.899623566708, -36.8868922823903],
          [174.899672000008, -36.8867208490903],
          [174.900030100008, -36.8867861157903],
          [174.900051033308, -36.8867899157903],
          [174.900046283307, -36.8868066990903],
          [174.900002600007, -36.8869613657903],
          [174.899623566708, -36.8868922823903],
        ],
      ],
    },
  },
  identityCheck: {
    exactAddressMatched: true,
    distinctFromAlternatives: true,
    duplicateParcelRowsRemoved: 0,
  },
  assessmentExplanation: {
    source: "deterministic_fallback",
    heading: "Deterministic assessment explanation",
    paragraphs: [
      dataAccessResult.feasibilityAssessment.finalRecommendation,
      "Deterministic confidence is high at 85 out of 100.",
    ],
  },
};

function assessmentFixture() {
  const provider = (id: string) => ({
    id,
    required: true,
    status: "available" as const,
    retrievedAt: "2026-07-16T00:00:00.000Z",
    datasetDate: "2026-07-01T00:00:00.000Z",
    confidence: "high" as const,
  });
  return assessFeasibility({
    scenarioComparison: comparisonFixture() as PoolScenarioComparison,
    address: { status: "confirmed", exactMatch: true },
    parcel: {
      status: "confirmed",
      titleEvidence: "available",
      easementEvidence: "unavailable",
    },
    providers: [
      provider("address_resolution"),
      provider("legal_parcel"),
      provider("building_footprints"),
      provider("contours"),
      provider("wastewater_assets"),
    ],
    screening: {
      infrastructure: "clear",
      flood: "unknown",
      flowPath: "clear",
      terrain: "unknown",
      restrictedOverlay: "clear",
      constructionAccess: "unknown",
    },
    assessedAt: "2026-07-16T00:00:00.000Z",
  });
}

function comparisonFixture() {
  const definitions = [
    ["compact", "Compact", "anchor", 5, 3],
    ["compact-plus", "Compact Plus", "intermediate", 6, 3.25],
    ["standard", "Standard", "anchor", 7, 3.5],
    ["standard-plus", "Standard Plus", "intermediate", 8, 3.75],
    ["large", "Large", "anchor", 9, 4],
  ] as const;
  const scenarios = definitions.map(
    ([id, label, kind, shellLengthMetres, shellWidthMetres], index) => {
      const candidate = {
        ...compactCandidate(
          1,
          [174.607955 - index * 0.00001, -36.86013 - index * 0.000005],
          index % 2 === 0 ? 0 : 90,
          2.4 + index,
        ),
        id: `${id}-1`,
      };
      return {
        scenario: {
          id,
          label,
          kind,
          version: "pool-scenario-comparison-v1",
          shellLengthMetres,
          shellWidthMetres,
          constructionAllowanceMetres: 1,
          rotationsDegrees: [0, 45, 90, 135],
          placementSpacingMetres: 0.5,
          maximumTestedPlacements: 4_000,
          maximumCandidates: 3,
        },
        status:
          index === 4
            ? "specialist_review_required"
            : "possible_with_constraints",
        resultWording: `${label} was tested against controlled mapped geometry.`,
        testedPlacementCount: 84,
        testedRotationsDegrees: [0, 45, 90, 135],
        usableAreaSquareMetres: 118.6,
        analysisEvidence: {
          parcel: fixtureSpatialEvidence(
            "legal_parcel",
            "NZ Primary Parcels",
            "LINZ",
          ),
          buildings: fixtureSpatialEvidence(
            "building_footprints",
            "NZ Building Outlines",
            "LINZ",
          ),
        },
        constraintScreening: [],
        constraintGroupScreening: [],
        candidates: [candidate],
        missingRequiredEvidence: [],
      };
    },
  );
  const successfulShells = scenarios.map((analysis) => ({
    scenarioId: analysis.scenario.id,
    label: analysis.scenario.label,
    lengthMetres: analysis.scenario.shellLengthMetres,
    widthMetres: analysis.scenario.shellWidthMetres,
    candidateId: analysis.candidates[0].id,
  }));
  return {
    version: "pool-scenario-comparison-v1",
    preferences: {
      frontageDirection: null,
      preferredLocation: "any",
      preferredSize: null,
    },
    scenarios,
    rankedScenarioIds: definitions.map(([id]) => id),
    successfulShells,
    recommendedShell: {
      scenarioId: "large",
      label: "Large",
      lengthMetres: 9,
      widthMetres: 4,
      candidateId: "large-1",
      status: "possible_with_constraints",
      rationale:
        "Largest successfully placed shell within the best-supported feasibility status.",
    },
    shellRange: {
      minimum: {
        scenarioId: "compact",
        lengthMetres: 5,
        widthMetres: 3,
        candidateId: "compact-1",
      },
      maximum: {
        scenarioId: "large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: "large-1",
      },
    },
  };
}

function compactCandidate(
  rank: number,
  centre: [number, number],
  rotationDegrees: number,
  nearestServiceMetres: number,
) {
  return {
    id: `compact-${rank}`,
    rank,
    centre,
    rotationDegrees,
    shell: fixtureRectangle(centre, 0.000028, 0.0000135),
    envelope: fixtureRectangle(centre, 0.000039, 0.0000225),
    placementEvidence: {
      parcel: fixtureSpatialEvidence(
        "legal_parcel",
        "NZ Primary Parcels",
        "LINZ",
      ),
      buildings: fixtureSpatialEvidence(
        "building_footprints",
        "NZ Building Outlines",
        "LINZ",
      ),
    },
    constraintIntersections: [
      {
        evidence: fixtureSpatialEvidence(
          "flood_prone_areas",
          "Flood Prone Areas",
          "Auckland Council",
        ),
        status: "measured",
        intersects: false,
        affectedEnvelopePercent: null,
      },
    ],
    mappedServiceDistances: [
      {
        evidence: fixtureSpatialEvidence(
          "wastewater_assets",
          "Wastewater Pipes",
          "Watercare",
        ),
        status: "measured",
        distanceMetres: nearestServiceMetres,
      },
    ],
    rankingEvidence: [
      "Entire indicative construction envelope is inside the mapped parcel.",
      "Envelope does not intersect a known LINZ building footprint.",
      `Nearest mapped service is approximately ${nearestServiceMetres.toFixed(1)} m from the indicative construction envelope.`,
    ],
  };
}

function fixtureSpatialEvidence(id: string, label: string, provider: string) {
  return {
    id,
    label,
    status: "available",
    provenance: {
      provider,
      dataset: label,
      datasetIdentifier: `fixture:${id}`,
      retrievedAt: "2026-07-16T00:00:00.000Z",
      datasetDate: null,
      licence: "Controlled test fixture",
      attribution: null,
      geometryUsed: "controlled fixture geometry",
      attributesUsed: [],
      evidenceType: "controlled_fixture",
      confidence: "high",
    },
  };
}

function fixtureRectangle(
  [longitude, latitude]: [number, number],
  halfLongitude: number,
  halfLatitude: number,
) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [longitude - halfLongitude, latitude - halfLatitude],
          [longitude + halfLongitude, latitude - halfLatitude],
          [longitude + halfLongitude, latitude + halfLatitude],
          [longitude - halfLongitude, latitude + halfLatitude],
          [longitude - halfLongitude, latitude - halfLatitude],
        ],
      ],
    },
  };
}
