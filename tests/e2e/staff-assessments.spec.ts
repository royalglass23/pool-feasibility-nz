import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { saveHomeownerAssessment } from "@/db/repositories/homeowner-assessment-repository";
import { hashStaffSessionToken } from "@/db/repositories/staff-auth-repository";
import { savedConstructabilitySnapshot } from "../fixtures/staff-assessment";
import { buildTestPersistedAssessmentSubmission } from "../fixtures/preliminary-report";

const databaseUrl = process.env.DATABASE_URL_DEV;

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

test("shows an authenticated staff member the saved constructability snapshot as read-only evidence", async ({
  page,
  context,
}) => {
  test.skip(
    !databaseUrl,
    "DATABASE_URL_DEV is required for staff E2E evidence.",
  );
  test.setTimeout(60_000);

  const db = drizzle(neon(databaseUrl!), { schema });
  const runId = randomUUID();
  const sessionToken = `rg345-${runId}`;
  const submission = buildTestPersistedAssessmentSubmission(
    `rg345-staff-e2e-${runId}`,
  );
  submission.homeowner = {
    ...submission.homeowner,
    name: "RG-345 Synthetic Pool Builder",
    phone: "021 000 0345",
    email: "rg345-staff-e2e@example.test",
    address: "345 Release Evidence Road, Auckland",
    visitorType: "pool_builder",
  };
  submission.report.reportData.constructability = savedConstructabilitySnapshot;

  let assessmentId: string | undefined;
  let sessionId: string | undefined;
  let createdAdmin = false;
  try {
    const insertedAdmin = await db
      .insert(schema.staffAdminAccounts)
      .values({
        id: 1,
        username: "rg345-playwright-admin",
        passwordHash: "unused-by-session-backed-e2e",
      })
      .onConflictDoNothing()
      .returning({ id: schema.staffAdminAccounts.id });
    createdAdmin = insertedAdmin.length === 1;

    sessionId = randomUUID();
    await db.insert(schema.staffSessions).values({
      id: sessionId,
      adminAccountId: 1,
      tokenHash: hashStaffSessionToken(sessionToken),
      expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
    });
    const saved = await saveHomeownerAssessment(db, submission);
    assessmentId = saved.assessment.id;

    await context.addCookies([
      {
        name: "rg_staff_session",
        value: sessionToken,
        url: "http://127.0.0.1:3100",
      },
    ]);
    await page.goto(`/staff/${assessmentId}`);

    await expect(page).toHaveURL(new RegExp(`/staff/${assessmentId}$`));
    const evidence = page.getByRole("region", {
      name: "Saved constructability evidence",
    });
    await expect(evidence).toBeVisible();
    await expect(evidence).toContainText("Read-only saved snapshot");
    await expect(evidence).toContainText("1.70 m");
    await expect(evidence).toContainText("Confirmed suggested route");
    await expect(
      evidence.getByText("confirmed", { exact: true }),
    ).toBeVisible();
    await expect(evidence).toContainText("Auckland Council");
    await expect(evidence).toContainText("Auckland DEM");
    await expect(evidence).toContainText(
      "Base geometry estimate only — terrain adjustment unavailable",
    );
    await expect(evidence.getByRole("button")).toHaveCount(0);
    await expect(evidence.getByRole("textbox")).toHaveCount(0);
    await expect(evidence.getByRole("checkbox")).toHaveCount(0);
    await expect(evidence.getByRole("spinbutton")).toHaveCount(0);
  } finally {
    if (sessionId) {
      await db
        .delete(schema.staffSessions)
        .where(eq(schema.staffSessions.id, sessionId));
    }
    if (assessmentId) {
      await db
        .delete(schema.homeownerAssessments)
        .where(eq(schema.homeownerAssessments.id, assessmentId));
    }
    if (createdAdmin) {
      await db
        .delete(schema.staffAdminAccounts)
        .where(
          eq(schema.staffAdminAccounts.username, "rg345-playwright-admin"),
        );
    }
  }
});
