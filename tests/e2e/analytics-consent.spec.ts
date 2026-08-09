import { expect, test } from "@playwright/test";

test("keeps the test site noindex and GA4 behind reversible consent", async ({
  page,
}) => {
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.abort(),
  );

  const response = await page.goto("/");
  expect(response?.headers()["x-robots-tag"]).toBe(
    "noindex, nofollow, noarchive",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
  await expect(
    page.getByRole("heading", { name: "Analytics cookies" }),
  ).toBeVisible();
  await expect(gaScript).toHaveCount(0);

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(gaScript).toHaveCount(0);

  await page.getByRole("button", { name: "Analytics settings" }).click();
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page.reload();
  await expect(gaScript).toHaveCount(0);

  await page.getByRole("button", { name: "Analytics settings" }).click();
  await page.getByRole("button", { name: "Allow analytics" }).click();
  await expect(gaScript).toHaveCount(1);

  await page.getByRole("button", { name: "Analytics settings" }).click();
  await page.getByRole("button", { name: "Turn analytics off" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as Record<string, unknown>)[
            "ga-disable-G-TEST123"
          ],
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("rg_analytics_consent_v1"),
    ),
  ).toBe("denied");
});
