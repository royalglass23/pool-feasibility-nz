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
  await expect(page.getByText("Fast property view")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fetch property data" }),
  ).toHaveCount(0);
  expect(submittedBodies).toEqual([
    {
      address: "Bahari Drive, Ranui, Auckland",
      selectedAddressId: "2359811",
    },
  ]);
});
