import { test, expect } from "@playwright/test";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";

const contact = {
  purpose: "general",
  name: "Hēmi O’Connor",
  email: "security@example.com",
  message: "Please help with our 3m & 4m pool.",
  idempotencyKey: "fe6f6d0b-2fb4-4abf-ad83-43a849b47dd1",
};
const homeowner = {
  name: contact.name,
  email: contact.email,
  phone: "0211234567",
  visitorType: "homeowner",
  desiredTiming: "asap",
  consentGiven: true,
};
function reportInput() {
  const payload = Buffer.from(
    JSON.stringify({
      submissionId: randomUUID(),
      expiresAt: Date.now() + 900_000,
      fastResult: {
        resolvedAddress: {
          addressId: "test-only",
          fullAddress: "1 Synthetic Street, Auckland",
          coordinates: [174.76, -36.85],
        },
        boundary: { state: "provisional" },
      },
    }),
  ).toString("base64url");
  const signature = createHmac(
    "sha256",
    "local-input-security-signing-secret-2026-at-least-32-bytes",
  )
    .update(payload)
    .digest("base64url");
  return {
    assessmentSnapshot: `${payload}.${signature}`,
    mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    homeowner,
    poolLayout: {
      lengthMetres: 6.5,
      widthMetres: 3,
      rotationDegrees: 0,
      position: [174.76, -36.85],
    },
  };
}

test.beforeEach(async ({ context }, info) => {
  const bytes = createHash("sha256").update(info.title).digest();
  await context.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": `10.${bytes[0]}.${bytes[1]}.${bytes[2]}`,
  });
});

test("partner browser rejects hidden controls then sends corrected Unicode details", async ({
  page,
}) => {
  await page.goto("/partners");
  await page.getByLabel("Your name", { exact: true }).fill("Hēmi\u0000Smith");
  await page.getByLabel("Company", { exact: true }).fill("O’Connor & Sons");
  await page.getByLabel("Work email", { exact: true }).fill(contact.email);
  await page.getByRole("button", { name: "Register your interest" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "hidden control characters",
  );
  await page.getByLabel("Your name", { exact: true }).fill(contact.name);
  const sent = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/contact") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Register your interest" }).click();
  expect((await sent).status()).toBe(202);
  await expect(page.getByRole("status")).toContainText(
    "partnership enquiry has been sent",
  );
});

test("general browser enquiry keeps script-shaped text inert in email output", async ({
  page,
}) => {
  const payload = '<img src=x onerror="alert(1)">';
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto("/#contact");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill(contact.name);
  await dialog.getByLabel("Email", { exact: true }).fill(contact.email);
  await dialog.getByLabel("How can we help?", { exact: true }).fill(payload);
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(dialog.getByText(/Thanks.*message has been sent/)).toBeVisible();
  expect(dialogs).toEqual([]);
  const emails = (await readFile("tmp/input-security/emails.jsonl", "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const email = emails.find((entry) => entry.text.includes(payload));
  expect(email).toBeTruthy();
  expect(email.html).not.toContain(payload);
  expect(email.html).toContain(
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
  expect(page.url()).not.toContain(contact.email);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    contact.email,
  );
});

for (const field of ["name", "email", "company", "message", "website"]) {
  test(`contact API rejects controls in ${field}`, async ({ context }) => {
    const response = await context.request.post("/api/public/contact", {
      data: {
        ...contact,
        purpose: "partnership",
        company: "Test Pools",
        [field]: "bad\u0000value",
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
}

for (const [field, value] of Object.entries({
  name: "bad\u0000name",
  email: "test@example.com\r\nBcc:other@example.com",
  phone: "0215551234<script>",
  additionalInfo: "bad\u0000notes",
  visitorTypeOtherDetail: "bad\u0000detail",
  desiredTimingOtherDetail: "bad\u0000detail",
  visitorType: "admin",
  desiredTiming: "injected",
  consentGiven: false,
})) {
  test(`report API rejects invalid ${field}`, async ({ context }) => {
    const response = await context.request.post("/api/public/assessments", {
      data: { ...reportInput(), homeowner: { ...homeowner, [field]: value } },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
}

test("valid report passes validation and reports unavailable persistence safely", async ({
  context,
}) => {
  const response = await context.request.post("/api/public/assessments", {
    data: reportInput(),
  });
  expect(response.status()).toBe(500);
  const body = await response.text();
  expect(body).toContain("ASSESSMENT_SAVE_FAILED");
  expect(body).not.toContain("DATABASE_URL");
  expect(body).not.toContain(contact.email);
});

test("APIs reject unknown fields malformed JSON and oversized requests", async ({
  context,
}) => {
  const unknown = await context.request.post("/api/public/contact", {
    data: { ...contact, admin: true },
  });
  expect(unknown.status()).toBe(400);
  const malformed = await context.request.post("/api/public/contact", {
    data: "{broken",
    headers: { "content-type": "application/json" },
  });
  expect(malformed.status()).toBe(400);
  const oversized = await context.request.post("/api/public/assessments", {
    data: "x".repeat(6_500_001),
  });
  expect(oversized.status()).toBe(413);
});

test("address search rejects hidden controls before provider access", async ({
  context,
}) => {
  const response = await context.request.post(
    "/api/public/address-suggestions",
    { data: { query: "1 Test\u0000Street" } },
  );
  expect(response.status()).toBe(400);
});

test("contact rate limit denies the fourth attempt", async ({ context }) => {
  for (let i = 0; i < 3; i++) {
    const response = await context.request.post("/api/public/contact", {
      data: { ...contact, website: "honeypot" },
    });
    expect(response.status()).toBe(202);
  }
  const response = await context.request.post("/api/public/contact", {
    data: contact,
  });
  expect(response.status()).toBe(429);
  expect(response.headers()["retry-after"]).toBeTruthy();
});

test("anonymous staff API access stays denied", async ({ context }) => {
  const response = await context.request.get("/api/internal/assessments");
  expect([401, 403, 503]).toContain(response.status());
  expect(await response.text()).not.toContain("homeownerEmail");
});
