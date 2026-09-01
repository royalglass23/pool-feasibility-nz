import { expect, test } from "@playwright/test";

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

test("shows Needs Checking before detailed evidence, then No Warning after a clean check", async ({
  page,
}) => {
  await openFastView(page);
  await expect(
    page.getByRole("heading", { name: "Needs Checking", exact: true }),
  ).toBeVisible();

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
  await page
    .getByRole("button", { name: "Load detailed official checks" })
    .click();
  await expect(page.getByRole("heading", { name: "No Warning" })).toBeVisible();
});

test("shows Blocked while leaving the pool warning and recommendation visible", async ({
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
  await page
    .getByRole("button", { name: "Load detailed official checks" })
    .click();
  await expect(page.getByRole("heading", { name: "Blocked" })).toBeVisible();
  await expect(
    page.getByText(
      "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Pool catalogue" }),
  ).toBeVisible();
});
