import { expect, test } from "@playwright/test";

const validContact = {
  name: "Taylor Visitor",
  email: "taylor@example.test",
  message: "Could you help me understand the next step?",
};

function body(idempotencyKey: string, overrides = {}) {
  return { ...validContact, idempotencyKey, website: "", ...overrides };
}

test("allows an anonymous visitor to send a contact enquiry through the local synthetic sink", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Contact us" }).click();
  await page.getByLabel("Name").fill(validContact.name);
  await page.getByLabel("Email").fill(validContact.email);
  await page.getByLabel("How can we help?").fill(validContact.message);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/contact") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(202);
  await expect(page.getByRole("status")).toHaveText(
    "Thanks — your message has been sent.",
  );
});

test("rejects malformed and injection-shaped contact requests without reflecting visitor data", async ({
  request,
}) => {
  const malformed = await request.post("/api/public/contact", {
    headers: { "x-forwarded-for": "198.51.100.10" },
    data: body("dfeea4f7-8df1-4468-a388-5a7b3c109cd1", {
      email: "not-an-email",
    }),
  });
  expect(malformed.status()).toBe(400);
  await expect(malformed.json()).resolves.toMatchObject({
    error: { code: "INVALID_REQUEST" },
  });

  const injection = "<script>alert('contact')</script> Please help with this.";
  const shaped = await request.post("/api/public/contact", {
    headers: { "x-forwarded-for": "198.51.100.11" },
    data: body("b554b60f-88bf-455d-9e71-7c9da830d46d", { message: injection }),
  });
  expect(shaped.status()).toBe(202);
  expect(await shaped.text()).not.toContain(injection);
});

test("rate limits a fourth public contact request from the same client", async ({
  request,
}) => {
  const headers = { "x-forwarded-for": "198.51.100.42" };
  for (const idempotencyKey of [
    "bb80e851-a16e-4563-a3c5-d7c906fdfbc7",
    "d976215d-9b5f-4a0b-b8cd-5c0ca67b7817",
    "2dc04d3e-ce67-43de-812f-c0320406f919",
  ]) {
    const response = await request.post("/api/public/contact", {
      headers,
      data: body(idempotencyKey),
    });
    expect(response.status()).toBe(202);
  }

  const limited = await request.post("/api/public/contact", {
    headers,
    data: body("83915aa9-4c23-4f00-a27e-b80c8db4a37b"),
  });
  expect(limited.status()).toBe(429);
  await expect(limited.json()).resolves.toMatchObject({
    error: { code: "RATE_LIMITED" },
  });
});

test("does not expose the delivery inbox or submitted details in the public dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Contact us" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).not.toContainText("support@royalglass.co.nz");
  await expect(dialog).not.toContainText("Royal Glass");
  await expect(
    dialog.getByRole("link", { name: "privacy notice" }),
  ).toHaveAttribute("target", "_blank");
});
