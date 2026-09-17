import { expect, test } from "@playwright/test";

test("requires staff sign-in before saved assessments can be opened", async ({
  page,
}) => {
  let assessmentRequests = 0;
  await page.route("**/api/internal/assessments**", async (route) => {
    assessmentRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { assessments: [] } }),
    });
  });

  await page.goto("/staff");

  await expect(page).toHaveURL(/\/staff\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to the workspace" }),
  ).toBeVisible();
  expect(assessmentRequests).toBe(0);

  await page.goto("/staff/assessment-new");
  await expect(page).toHaveURL(/\/staff\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to the workspace" }),
  ).toBeVisible();
  expect(assessmentRequests).toBe(0);
});
