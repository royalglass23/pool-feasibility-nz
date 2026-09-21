import { expect, type Page } from "@playwright/test";

export async function mockSiteAnswerSigning(page: Page) {
  await page.route(
    "**/api/public/assessment-snapshot/site-answers",
    async (route) => {
      const request = route.request().postDataJSON() as {
        assessmentSnapshot: string;
        accessConditions: string[];
        nearbyFeatures: string[];
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assessmentSnapshot: `site-signed-${request.assessmentSnapshot}`,
          answers: {
            version: 1,
            estimatedDepthMetres: 1.5,
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
    accessCondition?: "None of these" | "Gate or narrow passage";
  } = {},
) {
  const access = page.getByRole("group", {
    name: "Are there any visible conditions that could affect construction access or excavation?",
  });
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
  if (options.accessCondition === "Gate or narrow passage") {
    await expect(
      access.getByRole("checkbox", { name: "None of these" }),
    ).not.toBeChecked();
  }
  await nearby.getByRole("checkbox", { name: "None of these" }).check();
  await page.getByRole("button", { name: "Continue to your details" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your details for the preliminary report",
    }),
  ).toBeVisible();
}
