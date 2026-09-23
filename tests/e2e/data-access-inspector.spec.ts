import { expect, test } from "@playwright/test";

const address = "42A Bahari Drive, Ranui, Auckland";

test("selecting an address suggestion opens the fast property view without a fetch button", async ({
  page,
}) => {
  const submittedBodies: unknown[] = [];

  await page.route("**/api/public/address-suggestions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        suggestions: [
          {
            addressId: "2359811",
            fullAddress: address,
            fullAddressNumber: "42A",
            unit: null,
            territorialAuthority: "Auckland",
            coordinates: [174.6082, -36.8603],
          },
        ],
      }),
    });
  });
  await page.route("**/api/public/property-check", async (route) => {
    submittedBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "server-issued-initial-snapshot",
        data: {
          requestedAddress: address,
          resolvedAddress: {
            addressId: "2359811",
            fullAddress: address,
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
          firstUsableViewStartedAt: "2026-07-31T00:00:00.000Z",
          fastPathDurationMs: 120,
        },
      }),
    });
  });
  await page.route("**/api/public/property-check/stages", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Deferred stage unavailable" },
      }),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Auckland property address")
    .fill("Bahari Drive, Ranui, Auckland");
  await page.getByRole("option", { name: address }).click();

  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fetch property data" }),
  ).toHaveCount(0);
  expect(submittedBodies).toEqual([
    {
      address,
      selectedAddressId: "2359811",
    },
  ]);
});

test("one signed session separates automatic stages and constraints, then respects a denied retry interval", async ({
  page,
}) => {
  const stageModes: Array<string | undefined> = [];

  await page.route("**/api/public/address-suggestions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        suggestions: [
          {
            addressId: "2359811",
            fullAddress: address,
            fullAddressNumber: "42A",
            unit: null,
            territorialAuthority: "Auckland",
            coordinates: [174.6082, -36.8603],
          },
        ],
      }),
    });
  });
  const fastResult = {
    requestedAddress: address,
    resolvedAddress: {
      addressId: "2359811",
      fullAddress: address,
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
    firstUsableViewStartedAt: "2026-07-31T00:00:00.000Z",
    fastPathDurationMs: 120,
  };
  await page.route("**/api/public/property-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "signed-initial-snapshot",
        data: fastResult,
      }),
    });
  });
  await page.route("**/api/public/property-check/stages", async (route) => {
    const body = route.request().postDataJSON() as { mode?: string };
    stageModes.push(body.mode);
    if (!body.mode) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assessmentSnapshot: "signed-automatic-snapshot",
          data: {
            boundary: fastResult.boundary,
            aerial: fastResult.aerial,
            progress: fastResult.progress,
            fastPathDurationMs: 140,
          },
        }),
      });
      return;
    }
    const isRetry = stageModes.filter((mode) => mode === "detailed").length > 1;
    if (isRetry) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store", "Retry-After": "75" },
        body: JSON.stringify({
          error: { code: "RATE_LIMITED", message: "Please try again shortly." },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "signed-retryable-snapshot",
        data: {
          status: "partial",
          constraints: {
            status: "retryable",
            retryableLayerKeys: ["stormwater_pipes"],
            unavailableLayerKeys: ["stormwater_pipes"],
          },
          layers: [],
          retrievedAt: "2026-09-15T00:00:00.000Z",
          durationMs: 20,
          region: "Auckland",
          limitations: [],
          terrain: { status: "needs_checking", reasons: ["No DEM coverage."] },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("option", { name: address }).click();
  await page.getByRole("radio", { name: "My property" }).check();
  await page.getByRole("button", { name: "Check for constraints" }).click();
  await expect(
    page.getByRole("button", { name: "Retry unavailable constraints" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry unavailable constraints" })
    .click();
  await expect(
    page.getByText("Please try again in 1 minute 15 seconds."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry unavailable constraints" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Search a different address" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  expect(stageModes).toEqual([undefined, "detailed", "detailed"]);
});
