import { expect, test } from "@playwright/test";

test("keeps the test site noindex and analytics behind reversible consent", async ({
  page,
}) => {
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.abort(),
  );
  await page.route("https://static.hotjar.com/**", (route) => route.abort());
  await page.route("https://eu-assets.i.posthog.com/**", (route) =>
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
  const hotjarScript = page.locator("#hotjar-loader");
  const posthogScript = page.locator("#posthog-loader");
  await expect(
    page.getByRole("heading", { name: "Analytics cookies" }),
  ).toBeVisible();
  await expect(gaScript).toHaveCount(0);
  await expect(hotjarScript).toHaveCount(0);
  await expect(posthogScript).toHaveCount(0);

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(gaScript).toHaveCount(0);
  await expect(posthogScript).toHaveCount(0);

  await page.getByRole("button", { name: "Analytics settings" }).click();
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page.reload();
  await expect(gaScript).toHaveCount(0);
  await expect(posthogScript).toHaveCount(0);

  await page.getByRole("button", { name: "Analytics settings" }).click();
  await page.getByRole("button", { name: "Allow analytics" }).click();
  await expect(gaScript).toHaveCount(1);
  await expect(hotjarScript).toHaveCount(1);
  await expect(posthogScript).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const posthog = (
          window as unknown as {
            posthog?: {
              __SV?: number;
              _i?: Array<[string, { api_host: string }]>;
            };
          }
        ).posthog;
        return (
          posthog?.__SV === 1 &&
          posthog._i?.[0]?.[1]?.api_host === "https://eu.i.posthog.com"
        );
      }),
    )
    .toBe(true);

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
    await page.evaluate(() => localStorage.getItem("rg_analytics_consent_v1")),
  ).toBe("denied");
});

test("does not mount Hotjar or PostHog on staff routes", async ({ page }) => {
  await page.goto("/staff/sign-in");
  await expect(page.locator("#hotjar-loader")).toHaveCount(0);
  await expect(page.locator("#posthog-loader")).toHaveCount(0);
});
