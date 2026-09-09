import { test, expect } from "@playwright/test";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";
import { queryableDatasetKeys } from "../../src/modules/data-access-spike/dataset-catalog";
import { officialDatasetEvidence } from "../../src/modules/providers/official-dataset-catalog";

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
function reportInput(persistable = false) {
  const retrievedAt = new Date().toISOString();
  const payload = Buffer.from(
    JSON.stringify({
      submissionId: randomUUID(),
      expiresAt: Date.now() + 900_000,
      fastResult: {
        resolvedAddress: {
          addressId: "test-only",
          fullAddress: "1 Synthetic Street, Auckland",
          fullAddressNumber: "1",
          unit: null,
          territorialAuthority: "Auckland",
          coordinates: [174.76, -36.85],
        },
        boundary: persistable
          ? {
              state: "confirmed",
              parcelId: "security-synthetic-parcel",
              areaSquareMetres: 900,
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [174.75, -36.86],
                    [174.77, -36.86],
                    [174.77, -36.84],
                    [174.75, -36.84],
                    [174.75, -36.86],
                  ],
                ],
              },
            }
          : { state: "provisional" },
        ...(persistable
          ? {
              requestedAddress: "1 Synthetic Street, Auckland",
              aerial: {
                state: "unavailable",
                durationMs: null,
                attribution: null,
              },
              datasets: {
                address_resolution: officialDatasetEvidence(
                  "address_resolution",
                  retrievedAt,
                ),
                legal_parcel: officialDatasetEvidence(
                  "legal_parcel",
                  retrievedAt,
                ),
                aerial_imagery: null,
              },
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
                detailedChecks: "loaded",
              },
              firstUsableViewStartedAt: retrievedAt,
              fastPathDurationMs: 10,
              detailedChecks: {
                status: "complete",
                retrievedAt,
                durationMs: 10,
                region: "Auckland",
                limitations: ["Synthetic security fixture"],
                layers: [...queryableDatasetKeys, "culverts"].map((key) => ({
                  key,
                  state: "verified_empty",
                  geometry: null,
                  message: "Synthetic empty result",
                  evidence: {
                    provider: "Synthetic provider",
                    dataset: key,
                    datasetIdentifier: key,
                    status: "success",
                    licenceStatus: "permitted",
                    evidenceUse: "report_allowed",
                    retrievedAt,
                    datasetDate: null,
                    licence: "Test licence",
                    attribution: null,
                    geometryUsed: "bounded query",
                    attributesUsed: [],
                    evidenceType: "vector",
                    confidence: "limited",
                    featureCount: 0,
                  },
                })),
              },
            }
          : {}),
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

test("dev report persists and an independent context retrieves the same report on resubmission", async ({
  playwright,
  page,
}) => {
  expect(process.env.INPUT_SECURITY_DATABASE).toBe("dev");
  const input = reportInput(true);
  await page.goto("/");
  const first = await page.evaluate(async (data) => {
    const response = await fetch("/api/public/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, input);
  expect(first.status, JSON.stringify(first.body)).toBe(201);
  const saved = first.body.assessment;
  expect(saved.report).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel("Auckland property address")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(homeowner.email);
  expect(await page.locator("body").innerText()).not.toContain(saved.reference);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain(homeowner.email);
  const fresh = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3217",
    extraHTTPHeaders: { "x-vercel-forwarded-for": "10.252.253.254" },
  });
  try {
    const again = await fresh.post("/api/public/assessments", { data: input });
    expect(again.status(), await again.text()).toBe(200);
    const recovered = (await again.json()).assessment;
    expect(recovered.id).toBe(saved.id);
    expect(recovered.created).toBe(false);
    expect(recovered.report).toEqual(saved.report);
  } finally {
    await fresh.dispose();
  }
});

test("partner browser rejects hidden controls then sends corrected Unicode details", async ({
  page,
}) => {
  await page.goto("/partners");
  await page.getByLabel("Your name", { exact: true }).fill("Hēmi\u0000Smith");
  await page.getByLabel("Company", { exact: true }).fill("O’Connor & Sons");
  await page.getByLabel("Work email", { exact: true }).fill(contact.email);
  await page.getByRole("button", { name: "Register your interest" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Name:" }),
  ).toContainText("Please type this again using plain text.");
  await page.screenshot({
    path: "tmp/input-security/friendly-name-desktop.png",
    fullPage: true,
  });
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

test("general browser enquiry rejects HTML with helpful feedback and allows correction", async ({
  page,
}) => {
  const payload = '<img src=x onerror="alert(1)">';
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(dialog.getByRole("alert")).toContainText(
    "Message: Please use plain text without HTML tags.",
  );
  await page.screenshot({
    path: "tmp/input-security/friendly-message-mobile.png",
  });
  const corrected = "Please help with a pool & landscaping.";
  await dialog.getByLabel("How can we help?", { exact: true }).fill(corrected);
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(dialog.getByText(/Thanks.*message has been sent/)).toBeVisible();
  expect(dialogs).toEqual([]);
  const emails = (await readFile("tmp/input-security/emails.jsonl", "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const email = emails.find((entry) => entry.text.includes(corrected));
  expect(email).toBeTruthy();
  expect(email.html).not.toContain(payload);
  expect(email.html).toContain("pool &amp; landscaping");
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
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.text()).not.toContain("homeownerEmail");
});
