import { expect, test } from "@playwright/test";

test("adjusts a credible access route by keyboard and signs the changed line", async ({
  page,
}) => {
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
        assessmentSnapshot: "initial-route-token",
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
              assessmentSnapshot: "detailed-route-token",
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
              assessmentSnapshot: "boundary-route-token",
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
  await page.route(
    "**/api/public/assessment-snapshot/site-answers",
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posted = body;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assessmentSnapshot: "signed-route-token",
          answers: {
            version: 1,
            estimatedDepthMetres: 1.5,
            route: {
              provenance: "user-supplied",
              geometry: body.adjustedRoute,
            },
            accessConditions: body.accessConditions,
            nearbyFeatures: body.nearbyFeatures,
          },
        }),
      });
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill("1 Test Street, Auckland");
  await page.keyboard.press("Enter");
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
});
