import { expect, test } from "@playwright/test";

test("keeps the builder entry URL through browser back and forward navigation", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/auckland-pool-planning-for-builders");
  await page
    .getByRole("link", { name: "Check a property with PoolReady" })
    .click();
  await expect(page).toHaveURL(/audience=pool_builder/);
  await page.goBack();
  await expect(page).toHaveURL(/auckland-pool-planning-for-builders/);
  await page.goForward();
  await expect(page).toHaveURL(/audience=pool_builder/);
});

for (const initialOutcome of ["complete", "retryable", "error"] as const) {
  test(`loads detailed mapping evidence after ${initialOutcome} response`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
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
              state: "unavailable",
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
      await new Promise((resolve) => setTimeout(resolve, 150));
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
              initialOutcome === "retryable" && detailedStageRequests === 1
                ? "partial"
                : "complete",
            constraints: {
              status:
                initialOutcome === "retryable" && detailedStageRequests === 1
                  ? "retryable"
                  : "complete",
              retryableLayerKeys:
                initialOutcome === "retryable" && detailedStageRequests === 1
                  ? ["wastewater_assets"]
                  : [],
              unavailableLayerKeys: ["culverts"],
            },
            retrievedAt: "2026-07-28T00:00:01.000Z",
            durationMs: 20,
            region: "Auckland",
            limitations: [],
            terrain: {
              status: "needs_checking",
              reasons: ["No valid elevation data covers this property."],
            },
            layers: [
              {
                key: "wastewater_assets",
                state:
                  initialOutcome === "retryable" && detailedStageRequests === 1
                    ? "provider_error"
                    : "returned",
                evidence: {
                  dataset: "Wastewater pipes",
                  provider: "Watercare",
                },
                geometry:
                  initialOutcome === "retryable" && detailedStageRequests === 1
                    ? null
                    : {
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

    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = () => "";
    });
    const builderEntry = initialOutcome === "retryable";
    await page.goto(builderEntry ? "/?audience=pool_builder" : "/");
    await page.getByRole("button", { name: "Not now" }).click();
    await page
      .getByLabel("Auckland property address")
      .fill("42A Bahari Drive, Ranui, Auckland");
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { name: "42A Bahari Drive, Ranui, Auckland" }),
    ).toBeVisible();
    await expect(
      page.getByText("Fast property view", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Fast view progress" }),
    ).toContainText(
      "Address found. Next, choose a pool size, then move and rotate it into your preferred position.",
    );
    await expect(page.getByText("Mapped boundary found")).toHaveCount(0);
    await expect(page.getByText("Aerial image ready")).toHaveCount(0);
    await expect(page.getByText("Detailed checks not loaded")).toHaveCount(0);
    await expect(
      page.getByText("Default pool: Compact (6.5 × 3 m)"),
    ).toBeVisible();
    const legend = page.getByLabel("Map layers");
    await expect(legend).toBeVisible();
    const mapLayersToggle = legend.getByRole("button", {
      name: /Map layers/,
    });
    await expect(mapLayersToggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      legend.getByText(
        "Select “Check for constraints” to see terrain contours and mapped services.",
      ),
    ).toHaveCount(0);
    await mapLayersToggle.click();
    await expect(mapLayersToggle).toHaveAttribute("aria-expanded", "true");
    const homeownerPath = page.getByRole("radio", { name: "My property" });
    const builderPath = page.getByRole("radio", {
      name: "A customer property",
    });
    if (builderEntry) {
      await expect(builderPath).toBeChecked();
      await homeownerPath.click();
      await expect(homeownerPath).toBeChecked();
      await builderPath.click();
    } else {
      await expect(homeownerPath).not.toBeChecked();
      await expect(builderPath).not.toBeChecked();
      await homeownerPath.focus();
      await page.keyboard.press("Space");
      await expect(homeownerPath).toBeChecked();
      await builderPath.click();
      await homeownerPath.click();
    }
    await expect(
      page.getByRole("button", { name: "Check for constraints" }),
    ).toBeVisible();
    const detailedChecksPanel = page
      .locator("details")
      .filter({ hasText: "Detailed official checks" });
    await expect(detailedChecksPanel).toHaveCount(0);
    await page.getByRole("button", { name: "Check for constraints" }).click();
    await expect(
      page.getByRole("button", { name: "Checking constraints…" }),
    ).toBeDisabled();
    await expect.poll(() => detailedStageRequests).toBe(1);
    if (initialOutcome !== "complete") {
      const retry = page.getByRole("button", {
        name:
          initialOutcome === "retryable"
            ? "Retry unavailable constraints"
            : "Check for constraints",
        exact: true,
      });
      await expect(retry).toBeEnabled();
      await retry.click();
      await expect.poll(() => detailedStageRequests).toBe(2);
    }
    await expect(
      page.getByRole("button", {
        name: "All available constraints loaded",
        exact: true,
      }),
    ).toBeDisabled();
    if (initialOutcome === "complete") {
      const clearancesPanel = legend.getByTestId("map-layer-clearances");
      const slopePanel = legend.getByTestId("map-layer-slope");
      const contoursPanel = legend.getByTestId("map-layer-contours");
      const servicesPanel = legend.getByTestId("map-layer-services");
      const desktopPanels = await Promise.all([
        clearancesPanel.boundingBox(),
        slopePanel.boundingBox(),
        contoursPanel.boundingBox(),
        servicesPanel.boundingBox(),
      ]);
      const [
        desktopClearances,
        desktopSlope,
        desktopContours,
        desktopServices,
      ] = desktopPanels;

      expect(desktopClearances).not.toBeNull();
      expect(desktopSlope).not.toBeNull();
      expect(desktopContours).not.toBeNull();
      expect(desktopServices).not.toBeNull();
      expect(
        Math.abs(desktopClearances!.y - desktopSlope!.y),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(desktopClearances!.y - desktopContours!.y),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(desktopClearances!.width - desktopSlope!.width),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(desktopClearances!.width - desktopContours!.width),
      ).toBeLessThanOrEqual(1);
      expect(desktopServices!.y).toBeGreaterThanOrEqual(
        desktopClearances!.y + desktopClearances!.height,
      );

      await page.setViewportSize({ width: 390, height: 844 });
      const mobilePanels = await Promise.all([
        clearancesPanel.boundingBox(),
        slopePanel.boundingBox(),
        contoursPanel.boundingBox(),
        servicesPanel.boundingBox(),
      ]);
      const [mobileClearances, mobileSlope, mobileContours, mobileServices] =
        mobilePanels;

      expect(mobileSlope!.y).toBeGreaterThanOrEqual(
        mobileClearances!.y + mobileClearances!.height,
      );
      expect(mobileContours!.y).toBeGreaterThanOrEqual(
        mobileSlope!.y + mobileSlope!.height,
      );
      expect(mobileServices!.y).toBeGreaterThanOrEqual(
        mobileContours!.y + mobileContours!.height,
      );
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    await expect(
      page.getByText(/No valid elevation data covers this property\./),
    ).toBeVisible();
    if (initialOutcome === "complete") {
      const requestCountBeforePlacementChanges = detailedStageRequests;
      await page.getByRole("button", { name: /Family \(8 × 4 m\)/ }).click();
      await page.getByRole("button", { name: /Custom \(6.5 × 3 m\)/ }).click();
      await page.getByLabel("Custom length (m)").fill("7.2");
      await page.getByLabel("Custom width (m)").fill("3.4");

      const rotateControl = page.getByTestId("pool-rotate-control");
      await expect(rotateControl).toBeVisible();
      const rotateBounds = (await rotateControl.boundingBox())!;
      await page.mouse.move(rotateBounds.x + 22, rotateBounds.y + 22);
      await page.mouse.down();
      await page.mouse.move(rotateBounds.x + 60, rotateBounds.y - 10, {
        steps: 6,
      });
      await page.mouse.up();
      await expect
        .poll(async () =>
          Number(await rotateControl.getAttribute("data-rotation-degrees")),
        )
        .not.toBe(0);

      const canvas = page.locator("canvas.maplibregl-canvas");
      const canvasBounds = (await canvas.boundingBox())!;
      const rotateBoundsBeforeMove = (await rotateControl.boundingBox())!;
      await page.mouse.move(
        canvasBounds.x + canvasBounds.width / 2,
        canvasBounds.y + canvasBounds.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        canvasBounds.x + canvasBounds.width / 2 + 15,
        canvasBounds.y + canvasBounds.height / 2 + 10,
        { steps: 4 },
      );
      await page.mouse.up();
      await expect
        .poll(async () => {
          const current = (await rotateControl.boundingBox())!;
          return Math.hypot(
            current.x - rotateBoundsBeforeMove.x,
            current.y - rotateBoundsBeforeMove.y,
          );
        })
        .toBeGreaterThan(3);

      await expect
        .poll(() => detailedStageRequests)
        .toBe(requestCountBeforePlacementChanges);
    }
    await expect(
      page.getByRole("button", { name: "Retry property check", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Choose a valid pool placement, select/),
    ).toHaveCount(0);

    await expect(
      page.getByRole("button", { name: "Start again", exact: true }),
    ).toBeEnabled();
    const poolLayout = page.getByLabel("Pool catalogue and placement controls");
    const detailedAction = poolLayout.getByRole("button", {
      name: "All available constraints loaded",
      exact: true,
    });
    await expect(
      page
        .getByLabel("Property check notices")
        .getByRole("heading", { name: /Needs Checking|No Warning/ }),
    ).toBeVisible();
    await expect(detailedAction).toBeVisible();
    await expect(
      poolLayout.getByRole("button", { name: "Start again", exact: true }),
    ).toBeEnabled();
    const mapBounds = await page
      .getByLabel("Fast aerial map for 42A Bahari Drive, Ranui, Auckland")
      .boundingBox();
    const noticeBounds = await page
      .getByLabel("Property check notices")
      .boundingBox();
    const poolLayoutBounds = await poolLayout.boundingBox();
    const actionBounds = await detailedAction.boundingBox();
    expect(noticeBounds!.y + noticeBounds!.height).toBeLessThanOrEqual(
      mapBounds!.y,
    );
    expect(noticeBounds!.x).toBeLessThanOrEqual(mapBounds!.x);
    expect(noticeBounds!.x + noticeBounds!.width).toBeGreaterThanOrEqual(
      poolLayoutBounds!.x + poolLayoutBounds!.width,
    );
    expect(actionBounds!.x).toBeGreaterThanOrEqual(
      mapBounds!.x + mapBounds!.width,
    );
    expect(actionBounds!.y).toBeLessThan(mapBounds!.y + mapBounds!.height);
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

  const placementControls = page.getByLabel(
    "Pool catalogue and placement controls",
  );
  const aerialMap = page.getByLabel(
    "Fast aerial map for 42A Bahari Drive, Ranui, Auckland",
  );
  const desktopControls = await placementControls.boundingBox();
  const desktopMap = await aerialMap.boundingBox();
  expect(desktopControls!.x).toBeGreaterThanOrEqual(
    desktopMap!.x + desktopMap!.width,
  );
  expect(Math.abs(desktopControls!.y - desktopMap!.y)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileControls = await placementControls.boundingBox();
  const mobileMap = await aerialMap.boundingBox();
  const mobileLayers = await page.getByLabel("Map layers").boundingBox();
  expect(mobileMap!.y + mobileMap!.height).toBeLessThanOrEqual(
    mobileControls!.y,
  );
  expect(mobileControls!.y + mobileControls!.height).toBeLessThanOrEqual(
    mobileLayers!.y,
  );

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
