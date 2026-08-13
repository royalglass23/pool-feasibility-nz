import { expect, test } from "@playwright/test";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

test("keeps the saved preliminary report visible when homeowner email needs retry", async ({
  page,
}) => {
  await page.route("**/api/public/property-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "server-issued-initial-snapshot",
        data: {
          requestedAddress: "42A Bahari Drive, Ranui, Auckland",
          resolvedAddress: {
            addressId: "2359811",
            fullAddress: "42A Bahari Drive, Ranui, Auckland",
            fullAddressNumber: "42A",
            unit: null,
            territorialAuthority: "Auckland",
            coordinates: [174.6082, -36.8603],
          },
          boundary: {
            state: "provisional",
            geometry: null,
            areaSquareMetres: null,
            parcelId: null,
          },
          aerial: { state: "unavailable", durationMs: null, attribution: null },
          defaultPool: {
            id: "compact",
            label: "Compact",
            lengthMetres: 6.5,
            widthMetres: 3,
          },
          progress: {
            address: "found",
            boundary: "provisional",
            aerial: "unavailable",
            detailedChecks: "not_loaded",
          },
          firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
          fastPathDurationMs: 120,
        },
      }),
    });
  });
  await page.route("**/api/public/property-check/stages", async (route) => {
    const request = route.request().postDataJSON() as { mode?: string };
    if (request.mode === "detailed") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assessmentSnapshot: "server-issued-detailed-snapshot",
          data: {
            status: "complete",
            layers: [],
            retrievedAt: "2026-07-28T00:00:01.000Z",
            durationMs: 20,
            region: "Auckland",
            limitations: ["Mapped evidence requires onsite verification."],
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assessmentSnapshot: "server-issued-stage-snapshot",
        data: {
          boundary: {
            state: "confirmed",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [174.6065, -36.8615],
                  [174.61, -36.8615],
                  [174.61, -36.8588],
                  [174.6065, -36.8588],
                  [174.6065, -36.8615],
                ],
              ],
            },
            areaSquareMetres: 90_000,
            parcelId: "NA123/45",
          },
          aerial: {
            state: "unavailable",
            durationMs: null,
            attribution: null,
          },
          datasets: {},
          progress: {
            address: "found",
            boundary: "found",
            aerial: "unavailable",
            detailedChecks: "not_loaded",
          },
          fastPathDurationMs: 150,
        },
      }),
    });
  });
  await page.route("**/api/public/assessments", async (route) => {
    const submission = route.request().postDataJSON();
    expect(submission).toMatchObject({
      assessmentSnapshot: "server-issued-detailed-snapshot",
      poolLayout: { lengthMetres: 6.5, widthMetres: 3 },
    });
    expect(submission.mapImageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(submission).not.toHaveProperty("addressEvidence");
    expect(submission).not.toHaveProperty("warnings");
    expect(submission).not.toHaveProperty("report");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        assessment: {
          id: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
          reference: "GF-2026-000123",
          status: "new_enquiry",
          created: true,
          reportAccessToken: "e2e-saved-report-access-token",
          delivery: {
            homeowner: "failed",
            internal_test_report: "pending",
          },
          report: buildTestPreliminaryReport({
            summary: "Some mapped evidence is unavailable or uncertain.",
            property: {
              address: "42A Bahari Drive, Ranui, Auckland",
              boundaryAreaSquareMetres: 90000,
              parcelIdentifier: null,
            },
            pool: {
              rotationDegrees: 0,
            },
            mapImageDataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGL5//8/AAAA//+rxzhLAAAABklEQVQDAAYOAwJctCtXAAAAAElFTkSuQmCC",
          }),
        },
      }),
    });
  });
  await page.route(
    "**/api/public/assessments/report/delivery",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          delivery: {
            homeowner: "failed",
            internal_test_report: "pending",
          },
        }),
      });
    },
  );
  await page.route("**/api/public/assessments/report/pdf", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      accessToken: "e2e-saved-report-access-token",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition": 'attachment; filename="pool-feasibility.pdf"',
      },
      body: "%PDF-1.4 e2e report",
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Auckland property address")
    .fill("42A Bahari Drive, Ranui, Auckland");
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page
    .getByRole("button", { name: "Load detailed official checks" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your details for the preliminary report",
    }),
  ).toBeVisible({ timeout: 15_000 });
  const privacyNoticeLink = page.getByRole("link", {
    name: "privacy notice",
  });
  await expect(privacyNoticeLink).toBeVisible();
  await expect(privacyNoticeLink).toHaveAttribute("href", "/privacy");

  await page.getByLabel("Name").fill("Jane Homeowner");
  await page.getByLabel("Phone").fill("021 555 1234");
  await page.getByLabel("Email").fill("jane@example.com");
  await page
    .getByRole("checkbox", { name: /I consent to Royal Glass/i })
    .check();
  await page.getByRole("button", { name: "Save and show my report" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Preliminary pool feasibility report",
    }),
  ).toBeVisible();
  await expect(page.getByText("GF-2026-000123")).toBeVisible();
  await expect(
    page.getByText("Report generated successfully. Email delivery failed."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resend report" }),
  ).toBeVisible();
  await expect(page.getByText(/Internal report email/i)).toHaveCount(0);
  const assessmentMap = page.getByRole("region", {
    name: "Interactive assessment map",
  });
  await expect(assessmentMap).toBeVisible();
  await expect(
    assessmentMap.getByRole("checkbox", { name: "Mapped property boundary" }),
  ).toBeChecked();
  const poolToggle = assessmentMap.getByRole("checkbox", {
    name: "Selected pool",
  });
  await expect(poolToggle).toBeChecked();
  await expect(
    assessmentMap.getByRole("checkbox", {
      name: "Indicative investigation buffer",
    }),
  ).toBeChecked();
  await poolToggle.uncheck();
  await expect(assessmentMap.getByText("Selected pool hidden")).toBeVisible();
  const downloadButton = page.getByRole("button", { name: "Download PDF" });
  await expect(downloadButton).toHaveCSS("align-items", "center");
  await expect(downloadButton).toHaveCSS("justify-content", "center");
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "preliminary-pool-feasibility-42a-bahari-drive.pdf",
  );
  await download.delete();
});
