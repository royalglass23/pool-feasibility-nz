import { expect, test } from "@playwright/test";

test("shows the fast address-to-property stages before detailed checks", async ({
  page,
}) => {
  await page.route("**/api/internal/fast-property-view", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
            state: "ready",
            durationMs: 120,
            attribution: { text: "LINZ", url: "https://www.linz.govt.nz" },
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
            aerial: "ready",
            detailedChecks: "not_loaded",
          },
          firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
          fastPathDurationMs: 120,
        },
        assessmentSnapshot: "server-issued-initial-snapshot",
      }),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Auckland property address")
    .fill("42A Bahari Drive, Ranui, Auckland");
  await page.getByRole("button", { name: "Fetch property data" }).click();

  await expect(
    page.getByRole("heading", { name: "42A Bahari Drive, Ranui, Auckland" }),
  ).toBeVisible();
  await expect(page.getByText("Fast property view")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Fast view progress" }),
  ).toContainText("Address found");
  await expect(page.getByText("Mapped boundary found")).toHaveCount(0);
  await expect(page.getByText("Aerial image ready")).toHaveCount(0);
  await expect(page.getByText("Detailed checks not loaded")).toHaveCount(0);
  await expect(
    page.getByText("Default pool: Compact (6.5 × 3 m)"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load detailed official checks" }),
  ).toBeVisible();
  await page.route(
    "**/api/internal/fast-property-view/stages",
    async (route) => {
      const requestBody = route.request().postDataJSON();
      if (requestBody?.mode !== "detailed") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            status: "partial",
            retrievedAt: "2026-07-28T00:00:01.000Z",
            durationMs: 210,
            region:
              "New Zealand; provider coverage varies by territorial authority and dataset licence.",
            limitations: ["A verified empty response does not prove absence."],
            layers: [
              {
                key: "building_footprints",
                state: "returned",
                evidence: {
                  dataset: "NZ Building Outlines",
                  provider: "LINZ",
                  attribution: {
                    text: "Land Information New Zealand (LINZ), CC BY 4.0",
                    url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data",
                  },
                },
                geometry: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: {},
                      geometry: {
                        type: "Polygon",
                        coordinates: [
                          [
                            [174.6, -36.86],
                            [174.61, -36.86],
                            [174.61, -36.87],
                            [174.6, -36.86],
                          ],
                        ],
                      },
                    },
                  ],
                },
                message: "Returned 0 mapped features.",
              },
              {
                key: "contours",
                state: "timeout",
                evidence: { dataset: "Contours" },
                geometry: null,
                message:
                  "The provider timed out; no geometry was drawn. Retry is available.",
              },
              {
                key: "wastewater_assets",
                state: "returned",
                evidence: {
                  dataset: "Wastewater Pipes",
                  provider: "Watercare",
                },
                geometry: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: {},
                      geometry: {
                        type: "LineString",
                        coordinates: [
                          [174.6079, -36.8603],
                          [174.6081, -36.8602],
                        ],
                      },
                    },
                  ],
                },
                message: "Returned 1 mapped feature.",
              },
            ],
          },
          assessmentSnapshot: "server-issued-detailed-snapshot",
        }),
      });
    },
  );
  await page
    .getByRole("button", { name: "Load detailed official checks" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Detailed official checks" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Some provider queries remain unknown; this is a partial result.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Land Information New Zealand (LINZ), CC BY 4.0",
    }),
  ).toBeVisible();
  const legend = page.getByLabel("Utility map legend");
  await expect(legend).toBeVisible();
  await expect(legend).toContainText("Wastewater");
  await expect(
    legend.getByRole("checkbox", { name: "Wastewater" }),
  ).toBeChecked();
  const unavailableStormwater = legend.getByRole("checkbox", {
    name: "Stormwater",
  });
  await expect(unavailableStormwater).toBeDisabled();
  await expect(unavailableStormwater).not.toBeChecked();
  await expect(
    legend.getByText("Telecommunications: not available in this preliminary map."),
  ).toBeVisible();
  await expect(
    legend.getByText("Building outlines and contours are excluded from the map."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load detailed official checks" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Detailed official checks" }),
  ).toBeVisible();
});

test("supports the pool catalogue, bounded custom input, and keyboard rotation", async ({
  page,
}) => {
  await page.route("**/api/internal/fast-property-view", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
          firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
          fastPathDurationMs: 120,
        },
      }),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Auckland property address")
    .fill("42A Bahari Drive, Ranui, Auckland");
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await expect(
    page.getByRole("group", { name: "Pool catalogue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Compact \(6.5/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Custom \(6.5/ }).click();
  const length = page.getByLabel("Custom length (m)");
  await length.fill("20.1");
  await expect(length).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("alert").filter({ hasText: "2–20 m" }),
  ).toBeVisible();

  await length.fill("8.0");
  await page.getByLabel("Custom width (m)").fill("3.0");
  await page.getByRole("button", { name: "Rotate right 5°" }).click();
  await expect(page.getByText("Rotation: 5°")).toBeVisible();
});
