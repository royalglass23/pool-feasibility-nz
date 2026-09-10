import { expect, test } from "@playwright/test";

test("partner can submit the programme enquiry through the synthetic contact sink", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.81" });
  await page.goto("/partners");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Build PoolReady with us.",
  );
  await page
    .getByRole("link", { name: "Let's discuss the partnership" })
    .click();
  await page.getByLabel("Your name").fill("Casey Partner");
  const company = page.getByLabel("Company", { exact: true });
  const email = page.getByLabel("Work email");
  const details = page.getByLabel("Tell us about your business (optional)");
  await company.fill("Example[Pools");
  await email.fill("[sql]@email.test");
  await details.fill("SELECT * FROM businesses;");
  await page.getByRole("button", { name: "Register your interest" }).click();
  await expect(company).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(details).toHaveAttribute("aria-invalid", "true");
  await expect(company).toHaveAccessibleDescription(
    "Please use plain text and common punctuation only.",
  );
  await expect(email).toHaveAccessibleDescription(
    "Please enter a valid email address, such as name@example.com.",
  );
  await company.fill("Example Pools");
  await email.fill("casey@example.test");
  await details.fill("We build family pools in Auckland.");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/contact") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Register your interest" }).click();
  const response = await responsePromise;
  expect(response.request().postDataJSON()).toMatchObject({
    purpose: "partnership",
    company: "Example Pools",
    message: "We build family pools in Auckland.",
  });
  expect(response.status()).toBe(202);
  await expect(page.getByRole("status")).toHaveText(
    "Thanks — your partnership enquiry has been sent.",
  );
});

test("mobile public pages retain the brand and programme links without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    "/",
    "/partners",
    "/privacy",
    "/auckland-pool-planning-for-builders",
    "/can-my-auckland-property-suit-a-pool",
  ]) {
    await page.goto(path);
    const navigation = page.getByRole("navigation", {
      name: "Primary",
      exact: true,
    });
    await expect(
      navigation.getByRole("link", { name: /BlueHaven/ }),
    ).toHaveAttribute("href", "https://www.bluehaven.nz/");
    await expect(
      navigation.getByRole("link", { name: "PoolReady home" }),
    ).toHaveAttribute("href", "/");
    await expect(
      page
        .getByRole("navigation", { name: "Footer navigation" })
        .getByRole("link", { name: "Partnership Program" }),
    ).toHaveAttribute("href", "/partners");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("the partnership form shows delivery errors without losing the company", async ({
  page,
}) => {
  await page.route("**/api/public/contact", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Please try again shortly." } }),
    }),
  );
  await page.goto("/partners");
  await page.getByLabel("Your name").fill("Casey Partner");
  await page.getByLabel("Company", { exact: true }).fill("Example Pools");
  await page.getByLabel("Work email").fill("casey@example.test");
  await page.getByRole("button", { name: "Register your interest" }).click();
  await expect(
    page.locator("#partner-interest").getByRole("alert"),
  ).toContainText("Please try again shortly.");
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Example Pools",
  );
});

test("partner submissions share the contact rate limit and cannot override delivery", async ({
  request,
}) => {
  const headers = { "x-forwarded-for": "198.51.100.82" };
  const body = {
    name: "Casey",
    email: "casey@example.test",
    company: "Example Pools",
    purpose: "partnership",
    message: "",
    website: "",
  };
  for (let i = 0; i < 3; i++) {
    const response = await request.post("/api/public/contact", {
      headers,
      data: {
        ...body,
        idempotencyKey: crypto.randomUUID(),
        ...(i === 0 ? { to: "other@example.test" } : {}),
      },
    });
    expect(response.status()).toBe(i === 0 ? 400 : 202);
  }
  const response = await request.post("/api/public/contact", {
    headers,
    data: { ...body, idempotencyKey: crypto.randomUUID() },
  });
  expect(response.status()).toBe(429);
});
