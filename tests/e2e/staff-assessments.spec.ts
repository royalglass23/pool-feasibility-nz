import { expect, test } from "@playwright/test";
import {
  SAVED_MAP_IMAGE_DATA_URL,
  staffAssessmentDetail,
  staffAssessmentSummaries,
} from "../fixtures/staff-assessment";

test("opens the newest assessment from Staff and preserves the saved detail read-only", async ({
  page,
}) => {
  await page.route("**/api/internal/assessments**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/internal/assessments") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { assessments: staffAssessmentSummaries },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { assessment: staffAssessmentDetail } }),
    });
  });

  await page.goto("/staff");

  await expect(
    page.getByRole("heading", { name: "Staff assessment dashboard" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Development-only.*no staff authentication/),
  ).toBeVisible();
  await expect(page.getByRole("listitem").first()).toContainText(
    "Jane Homeowner",
  );

  await page.getByRole("link", { name: "Open GF-2026-000042" }).click();

  await expect(page).toHaveURL(/\/staff\/assessment-new$/);
  await expect(
    page.getByRole("heading", {
      name: "Preliminary pool feasibility report",
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Jane Homeowner" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Saved property and pool map"),
  ).toHaveAttribute("src", SAVED_MAP_IMAGE_DATA_URL);
  await expect(page.getByText("A blocked saved assessment.")).toBeVisible();
  await expect(page.getByText("Mapped wastewater conflict")).toBeVisible();
  await expect(page.getByText("Wastewater assets")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /move|rotate|resize|save|edit/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
