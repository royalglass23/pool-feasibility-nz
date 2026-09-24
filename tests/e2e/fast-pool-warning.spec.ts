import { expect, test, type Locator } from "@playwright/test";

const boundary = {
  type: "Polygon",
  coordinates: [
    [
      [174.5, -36.9],
      [174.7, -36.9],
      [174.7, -36.8],
      [174.5, -36.8],
      [174.5, -36.9],
    ],
  ],
};
const assessmentSnapshot = "server-issued-assessment-snapshot";

const baseResult = {
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
    geometry: boundary,
    areaSquareMetres: 1000,
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
};

function detail(layers: unknown[]) {
  return {
    status: "complete",
    retrievedAt: "2026-07-28T00:00:01.000Z",
    durationMs: 10,
    region: "New Zealand",
    limitations: [],
    layers,
  };
}

function emptyLayer() {
  return {
    key: "contours",
    state: "verified_empty",
    evidence: { dataset: "Contours" },
    geometry: null,
    message: "The provider verified an empty result.",
  };
}

function conflictLayer() {
  return {
    key: "wastewater_assets",
    state: "returned",
    evidence: {
      dataset: "Wastewater assets",
      status: "success",
      evidenceUse: "report_allowed",
      confidence: "limited",
    },
    geometry: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: boundary }],
    },
    message: "Returned mapped wastewater infrastructure.",
  };
}

async function openFastView(page: import("@playwright/test").Page) {
  await page.route("**/api/public/property-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: baseResult, assessmentSnapshot }),
    });
  });
  await page.route("**/api/public/property-check/stages", async (route) => {
    if (route.request().postDataJSON()?.mode === "detailed")
      return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          boundary: baseResult.boundary,
          aerial: baseResult.aerial,
          datasets: { legal_parcel: null, aerial_imagery: null },
          progress: baseResult.progress,
          fastPathDurationMs: baseResult.fastPathDurationMs,
        },
        assessmentSnapshot,
      }),
    });
  });
  await page.goto("/");
  await page
    .getByLabel("Auckland property address")
    .fill(baseResult.requestedAddress);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: baseResult.resolvedAddress.fullAddress }),
  ).toBeVisible();
}

async function documentTop(locator: Locator) {
  return locator.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  );
}

test("shows Needs Checking before detailed evidence, then No Warning after a clean check", async ({
  page,
}) => {
  await openFastView(page);
  const aerialMap = page.getByLabel(
    `Fast aerial map for ${baseResult.resolvedAddress.fullAddress}`,
  );
  await expect(
    page.getByRole("heading", { name: "Needs Checking", exact: true }),
  ).toBeVisible();
  const mapTopBeforeCheck = await documentTop(aerialMap);

  await page.route("**/api/public/property-check/stages", async (route) => {
    if (route.request().postDataJSON()?.mode !== "detailed")
      return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: detail([emptyLayer()]),
        assessmentSnapshot,
      }),
    });
  });
  await page.getByRole("radio", { name: "My property" }).check();
  await page.getByRole("button", { name: "Use this pool position" }).click();
  await page.getByRole("button", { name: "Check this property" }).click();
  await expect(page.getByRole("heading", { name: "No Warning" })).toBeVisible();
  const mapTopAfterCheck = await documentTop(aerialMap);
  expect(mapTopAfterCheck).toBeCloseTo(mapTopBeforeCheck, 0);
});

test("keeps the mobile workspace anchored when the live result changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openFastView(page);
  await page.getByRole("button", { name: "Reject analytics" }).click();
  const aerialMap = page.getByLabel(
    `Fast aerial map for ${baseResult.resolvedAddress.fullAddress}`,
  );
  const mapTopBeforeCheck = await documentTop(aerialMap);

  await page.route("**/api/public/property-check/stages", async (route) => {
    if (route.request().postDataJSON()?.mode !== "detailed")
      return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: detail([emptyLayer()]),
        assessmentSnapshot,
      }),
    });
  });
  await page.getByRole("radio", { name: "My property" }).check();
  await page.getByRole("button", { name: "Use this pool position" }).click();
  await page.getByRole("button", { name: "Check this property" }).click();
  await expect(page.getByRole("heading", { name: "No Warning" })).toBeVisible();

  expect(await documentTop(aerialMap)).toBeCloseTo(mapTopBeforeCheck, 0);
});

test("shows friendly position-review guidance while leaving the pool controls available", async ({
  page,
}) => {
  await openFastView(page);
  await page.route("**/api/public/property-check/stages", async (route) => {
    if (route.request().postDataJSON()?.mode !== "detailed")
      return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: detail([conflictLayer()]),
        assessmentSnapshot,
      }),
    });
  });
  await page.getByRole("radio", { name: "My property" }).check();
  await page.getByRole("button", { name: "Use this pool position" }).click();
  await page.getByRole("button", { name: "Check this property" }).click();
  await expect(
    page.getByRole("heading", { name: "This pool position needs review" }),
  ).toBeVisible();
  const notices = page.getByLabel("Property check notices");
  await expect(
    notices.getByText(
      "This pool position overlaps a mapped constraint and needs review.",
    ),
  ).toBeVisible();
  await notices.getByText("View details").click();
  await expect(
    page.getByText(
      "Try a different pool position. If you want to keep this position, confirm the mapped constraint and required clearance with the relevant provider or a qualified pool professional.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Pool catalogue" }),
  ).toBeVisible();
});
