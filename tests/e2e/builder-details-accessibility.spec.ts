import { expect, test } from "@playwright/test";

test("operates the compact builder details controls by keyboard with accessible state", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.route("**/api/public/property-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "builder-details-initial-snapshot",
        data: {
          requestedAddress: "1 Test Street, Auckland",
          resolvedAddress: {
            addressId: "builder-details-address",
            fullAddress: "1 Test Street, Auckland",
            fullAddressNumber: "1",
            unit: null,
            territorialAuthority: "Auckland",
            coordinates: [174.76, -36.85],
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
          firstUsableViewStartedAt: "2026-09-25T00:00:00.000Z",
          fastPathDurationMs: 10,
        },
      }),
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page.getByRole("radio", { name: "A customer property" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill("1 Test Street, Auckland");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Use this pool position" }).click();

  const depth = page.getByRole("slider", {
    name: "Estimated pool depth (m)",
  });
  await expect(depth).toHaveValue("1.5");
  await depth.focus();
  await page.keyboard.press("ArrowRight");
  await expect(depth).toHaveValue("1.6");
  await expect(depth).toHaveAttribute("aria-valuetext", "1.6 m");

  const accessButton = page.getByRole("button", {
    name: "Access and excavation conditions",
  });
  await expect(accessButton).toHaveAttribute("aria-expanded", "false");
  await accessButton.focus();
  await page.keyboard.press("Enter");
  await expect(accessButton).toHaveAttribute("aria-expanded", "true");
  await expect(accessButton).toHaveAttribute(
    "aria-controls",
    "site-access-panel",
  );

  const access = page.getByRole("group", {
    name: "Which visible site conditions could affect plant access or excavation?",
  });
  const none = access.getByRole("checkbox", { name: "None of these" });
  await none.focus();
  await page.keyboard.press("Space");
  await expect(none).toBeChecked();
  await accessButton.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remove None of these" }),
  ).toBeVisible();

  const nearbyButton = page.getByRole("button", { name: "Nearby features" });
  await nearbyButton.focus();
  await page.keyboard.press("Space");
  const nearby = page.getByRole("group", {
    name: "Which existing features are close to the proposed pool area?",
  });
  await nearby.getByRole("checkbox", { name: "Fences" }).check();
  await nearby.getByRole("checkbox", { name: "Walls" }).check();
  await nearbyButton.click();
  await page.getByRole("button", { name: "Remove Fences" }).click();
  await expect(page.getByRole("button", { name: "Remove Fences" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Remove Walls" }),
  ).toBeVisible();
});
