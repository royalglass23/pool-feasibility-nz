import { expect, type Page } from "@playwright/test";

export async function mockSiteAnswerSigning(page: Page) {
  await page.route(
    "**/api/public/assessment-snapshot/site-answers",
    async (route) => {
      const request = route.request().postDataJSON() as {
        assessmentSnapshot: string;
        accessConditions: string[];
        nearbyFeatures: string[];
        sideClearanceMillimetres: number;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assessmentSnapshot: `site-signed-${request.assessmentSnapshot}`,
          answers: {
            version: 1,
            estimatedDepthMetres: 1.5,
            excavationSideAllowanceMetres:
              request.sideClearanceMillimetres / 1_000,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: request.accessConditions,
            nearbyFeatures: request.nearbyFeatures,
          },
        }),
      });
    },
  );
}

export async function answerSiteQuestions(
  page: Page,
  options: {
    accessCondition?:
      "None of these" | "Restricted gate or narrow access" | "I’m not sure";
    sideClearanceMillimetres?: number;
  } = {},
) {
  const clearance = page.getByRole("slider", {
    name: "Indicative excavation side clearance",
  });
  await expect(clearance).toHaveValue("300");
  if (options.sideClearanceMillimetres !== undefined) {
    await clearance.fill(String(options.sideClearanceMillimetres));
    await expect(clearance).toHaveValue(
      String(options.sideClearanceMillimetres),
    );
  }
  if ((options.sideClearanceMillimetres ?? 300) < 300) {
    await expect(
      page.getByText(/below the provisional 300 mm starting point/i),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Access and excavation conditions" })
    .click();
  const access = page.getByRole("group", {
    name: "Which visible site conditions could affect plant access or excavation?",
  });
  await page.getByRole("button", { name: "Nearby features" }).click();
  const nearby = page.getByRole("group", {
    name: "Which existing features are close to the proposed pool area?",
  });
  await expect(access).toBeVisible();
  await expect(nearby).toBeVisible();
  await access
    .getByRole("checkbox", {
      name: options.accessCondition ?? "None of these",
    })
    .check();
  if (options.accessCondition && options.accessCondition !== "None of these") {
    await expect(
      access.getByRole("checkbox", { name: "None of these" }),
    ).not.toBeChecked();
  }
  await nearby.getByRole("checkbox", { name: "None of these" }).check();
  const signingResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/public/assessment-snapshot/site-answers") &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Check this property" }).click();
  const response = await signingResponse;
  expect(response.status(), await response.text()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name: "Your details for the preliminary report",
    }),
  ).toBeVisible({ timeout: 30_000 });
}
