import { expect, test } from "@playwright/test";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

test("keeps public pool placement move-only and keyboard selectable", async ({
  page,
}) => {
  await page.route("**/api/public/property-check", (route) =>
    route.fulfill({
      json: { data: fastResult, assessmentSnapshot: "test-snapshot" },
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Not now" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill(fastResult.requestedAddress);
  await page.keyboard.press("Enter");

  const catalogue = page.getByRole("group", { name: "Pool catalogue" });
  await expect(catalogue).toBeVisible();
  await expect(catalogue.getByRole("button")).toHaveCount(6);
  await expect(page.getByTestId("pool-rotate-control")).toHaveCount(0);
  await expect(page.getByText(/move and rotate|drag the rotate/i)).toHaveCount(
    0,
  );

  const family = page.getByRole("button", { name: "Family (8 × 4 m)" });
  await family.focus();
  await page.keyboard.press("Enter");
  await expect(family).toHaveAttribute("aria-pressed", "true");

  const map = page.locator("canvas.maplibregl-canvas");
  const bounds = (await map.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 15,
    bounds.y + bounds.height / 2 + 10,
    { steps: 4 },
  );
  await page.mouse.up();

  await expect(family).toHaveAttribute("aria-pressed", "true");
  await expect(map).toBeVisible();
  await expect(page.getByTestId("pool-rotate-control")).toHaveCount(0);
});

const fastResult = {
  requestedAddress: "42A Bahari Drive, Ranui, Auckland",
  resolvedAddress: {
    addressId: "2359811",
    fullAddress: "42A Bahari Drive, Ranui, Auckland",
    fullAddressNumber: "42A",
    unit: null,
    territorialAuthority: "Auckland",
    coordinates: [174.6082, -36.8603],
  },
  boundary: {
    state: "confirmed",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [174.608, -36.8604],
          [174.6084, -36.8604],
          [174.6084, -36.8601],
          [174.608, -36.8601],
          [174.608, -36.8604],
        ],
      ],
    },
    areaSquareMetres: 246,
    parcelId: "parcel-1",
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
  firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
  fastPathDurationMs: 120,
} as unknown as FastPropertyViewResult;
