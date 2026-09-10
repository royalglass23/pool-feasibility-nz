import { expect, test } from "@playwright/test";

const MAPLIBRE_WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";
const MAPLIBRE_SHARED_PATH = "/maplibre/maplibre-gl-shared.mjs";

test("loads the app-hosted MapLibre worker graph for the public property check", async ({
  page,
}) => {
  const moduleStatuses = new Map<string, number>();

  await page.route("**/api/public/property-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "server-issued-worker-snapshot",
        data: {
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
            state: "provisional",
            geometry: null,
            areaSquareMetres: null,
            parcelId: null,
          },
          aerial: {
            state: "unavailable",
            durationMs: null,
            attribution: null,
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
        },
      }),
    });
  });

  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      pathname === MAPLIBRE_WORKER_PATH ||
      pathname === MAPLIBRE_SHARED_PATH
    ) {
      moduleStatuses.set(pathname, response.status());
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill("42A Bahari Drive, Ranui, Auckland");
  await page.keyboard.press("Enter");

  await expect(
    page.getByLabel("Fast aerial map for 42A Bahari Drive, Ranui, Auckland"),
  ).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => moduleStatuses.get(MAPLIBRE_WORKER_PATH)).toBe(200);
  await expect.poll(() => moduleStatuses.get(MAPLIBRE_SHARED_PATH)).toBe(200);
});
