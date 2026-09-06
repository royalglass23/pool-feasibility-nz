import { expect, test } from "@playwright/test";

for (const initialOutcome of ["complete", "partial", "error"] as const) {
  test(`loads detailed mapping evidence after ${initialOutcome} response`, async ({
    page,
  }) => {
    await page.route("**/api/public/property-check", async (route) => {
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
    let detailedStageRequests = 0;
    await page.route("**/api/public/property-check/stages", async (route) => {
      const request = route.request().postDataJSON() as { mode?: string };
      if (request.mode !== "detailed") return route.continue();

      detailedStageRequests += 1;
      if (initialOutcome === "error" && detailedStageRequests === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Temporarily unavailable" },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assessmentSnapshot: "server-issued-detailed-snapshot",
          data: {
            status:
              initialOutcome === "partial" && detailedStageRequests === 1
                ? "partial"
                : "complete",
            retrievedAt: "2026-07-28T00:00:01.000Z",
            durationMs: 20,
            region: "Auckland",
            limitations: [],
            layers: [
              {
                key: "wastewater_assets",
                state: "returned",
                evidence: {
                  dataset: "Wastewater pipes",
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
                          [174.608, -36.8604],
                          [174.6084, -36.8601],
                        ],
                      },
                    },
                  ],
                },
                message: "Returned 1 mapped feature.",
              },
            ],
          },
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Not now" }).click();
    await page
      .getByLabel("Auckland property address")
      .fill("42A Bahari Drive, Ranui, Auckland");
    await page.keyboard.press("Enter");

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
    const legend = page.getByLabel("Map layers");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText(
      "Select “Check for constraints” to see terrain contours and mapped services.",
    );
    await expect(
      page.getByRole("button", { name: "Check for constraints" }),
    ).toBeVisible();
    const detailedChecksPanel = page
      .locator("details")
      .filter({ hasText: "Detailed official checks" });
    await expect(detailedChecksPanel).toHaveCount(0);
    await page.getByRole("button", { name: "Check for constraints" }).click();
    await expect.poll(() => detailedStageRequests).toBe(1);
    if (initialOutcome !== "complete") {
      const retry = page.getByRole("button", {
        name:
          initialOutcome === "partial"
            ? "Retry missing checks"
            : "Check for constraints",
        exact: true,
      });
      await expect(retry).toBeEnabled();
      await retry.click();
      await expect.poll(() => detailedStageRequests).toBe(2);
    }
    await expect(
      page.getByRole("button", { name: "Map checks loaded", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Start again", exact: true }),
    ).toBeEnabled();
    const mapBounds = await page
      .getByLabel("Fast aerial map for 42A Bahari Drive, Ranui, Auckland")
      .boundingBox();
    const actionBounds = await page
      .getByRole("button", { name: "Map checks loaded", exact: true })
      .boundingBox();
    expect(actionBounds!.y).toBeGreaterThanOrEqual(
      mapBounds!.y + mapBounds!.height,
    );
    await expect(
      legend.getByRole("checkbox", { name: "Wastewater" }),
    ).toBeChecked();
    await expect(detailedChecksPanel).toHaveCount(0);
  });
}

test("supports the pool catalogue and bounded custom input", async ({
  page,
}) => {
  await page.route("**/api/public/property-check", async (route) => {
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
  await page.keyboard.press("Enter");
  const catalogue = page.getByRole("group", { name: "Pool catalogue" });
  await expect(catalogue).toBeVisible();
  await expect(catalogue).toHaveClass(/sm:grid-cols-3/);
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
  await expect(page.getByRole("button", { name: /Rotate/ })).toHaveCount(0);
  await expect(page.getByText(/^Rotation:/)).toHaveCount(0);
});
