import { expect, test } from "@playwright/test";
import sharp from "sharp";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

for (const input of ["mouse", "touch"] as const) {
  test(`rotate overlay stays visible through ${input} dragging and snapshot captures`, async ({
    page,
  }) => {
    await page.route("**/api/public/property-check", (route) =>
      route.fulfill({
        json: { data: fastResult, assessmentSnapshot: "test-snapshot" },
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Not now" }).click();
    await page
      .getByLabel("Auckland property address")
      .fill(fastResult.requestedAddress);
    await page.keyboard.press("Enter");
    const control = page.getByTestId("pool-rotate-control");
    await expect(control).toBeVisible();
    await control.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const before = await control.boundingBox();
    expect(before).not.toBeNull();
    await page.evaluate(() => {
      const state = { hiddenFrames: 0, frames: 0, running: true };
      (
        window as Window & {
          __rotateFrames?: {
            hiddenFrames: number;
            frames: number;
            running: boolean;
          };
        }
      ).__rotateFrames = state;
      const sample = () => {
        const control = document.querySelector(
          '[data-testid="pool-rotate-control"]',
        );
        if (
          !control ||
          getComputedStyle(control).display === "none" ||
          getComputedStyle(control).visibility === "hidden"
        )
          state.hiddenFrames++;
        state.frames++;
        if (state.running) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    if (input === "mouse") {
      await page.mouse.move(before!.x + 22, before!.y + 22);
      await page.mouse.down();
      await page.mouse.move(before!.x + 70, before!.y - 15, { steps: 16 });
      await page.mouse.up();
    } else {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: before!.x + 22, y: before!.y + 22 }],
      });
      for (let step = 1; step <= 16; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: before!.x + 22 + (48 * step) / 16,
              y: before!.y + 22 - (37 * step) / 16,
            },
          ],
        });
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await session.detach();
    }
    await page.waitForTimeout(700);
    await expect
      .poll(async () =>
        Number(await control.getAttribute("data-rotation-degrees")),
      )
      .not.toBe(0);
    const after = await control.boundingBox();
    expect(
      Math.hypot(after!.x - before!.x, after!.y - before!.y),
    ).toBeGreaterThan(8);
    await page
      .getByRole("checkbox", { name: "Show pool-shell clearances" })
      .click();
    await page.waitForTimeout(500);
    const frames = await page.evaluate(() => {
      const state = (
        window as Window & {
          __rotateFrames?: {
            hiddenFrames: number;
            frames: number;
            running: boolean;
          };
        }
      ).__rotateFrames!;
      state.running = false;
      return state;
    });
    expect(frames.frames).toBeGreaterThan(10);
    expect(frames.hiddenFrames).toBe(0);
    await page.screenshot({ path: "test-results/pool-rotation.png" });
  });
}

test("report image excludes the rotate button while the live map keeps it visible", async ({
  page,
}) => {
  await page.route("**/api/public/property-check", (route) =>
    route.fulfill({
      json: { data: fastResult, assessmentSnapshot: "test-snapshot" },
    }),
  );
  await page.route("**/api/public/property-check/stages", (route) =>
    route.fulfill({
      json: { data: fastResult, assessmentSnapshot: "test-stage-snapshot" },
    }),
  );
  await page.route("**/api/public/assessments", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Test intercepted report request" } },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Not now" }).click();
  await page
    .getByLabel("Auckland property address")
    .fill(fastResult.requestedAddress);
  await page.keyboard.press("Enter");
  const control = page.getByTestId("pool-rotate-control");
  await expect(control).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Show pool-shell clearances" })
    .uncheck();
  await control.scrollIntoViewIfNeeded();
  const map = page.locator("canvas.maplibregl-canvas");
  const canvasBounds = (await map.boundingBox())!;
  const buttonBounds = (await control.boundingBox())!;
  const liveButton = await control.screenshot();
  expect(await whiteFraction(liveButton)).toBeGreaterThan(0.4);

  const form = page.getByRole("form", {
    name: "Your details for the preliminary report",
  });
  await form.getByLabel("Name", { exact: true }).fill("Test Homeowner");
  await form.getByLabel("Phone").fill("021 555 1234");
  await form.getByLabel("Email").fill("test@example.com");
  await form.getByRole("checkbox", { name: /I consent to PoolReady/i }).check();
  const requestPending = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/public/assessments") &&
      request.method() === "POST",
  );
  await form.getByRole("button", { name: "Save and show my report" }).click();
  const submission = (await requestPending).postDataJSON() as {
    mapImageDataUrl: string;
  };
  expect(submission.mapImageDataUrl).toMatch(/^data:image\/png;base64,/);
  const savedImage = Buffer.from(
    submission.mapImageDataUrl.split(",")[1],
    "base64",
  );
  const metadata = await sharp(savedImage).metadata();
  const scale = metadata.width! / canvasBounds.width;
  const savedButtonRegion = await sharp(savedImage)
    .extract({
      left: Math.round((buttonBounds.x - canvasBounds.x) * scale),
      top: Math.round((buttonBounds.y - canvasBounds.y) * scale),
      width: Math.round(buttonBounds.width * scale),
      height: Math.round(buttonBounds.height * scale),
    })
    .png()
    .toBuffer();
  // The fixture has no white map features here: a leaked white button is detectable.
  expect(await whiteFraction(savedButtonRegion)).toBeLessThan(0.05);
  await expect(
    page.getByText("Test intercepted report request", { exact: true }),
  ).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
});

async function whiteFraction(png: Buffer) {
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset] > 240 && data[offset + 1] > 240 && data[offset + 2] > 240)
      white++;
  }
  return white / (info.width * info.height);
}

const fastResult = {
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
    state: "confirmed",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [174.608, -36.8604],
          [174.6084, -36.8604],
          [174.6084, -36.8601],
          [174.608, -36.8601],
          [174.608, -36.8604],
        ],
      ],
    },
    areaSquareMetres: 246,
    parcelId: "parcel-1",
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
    boundary: "found",
    aerial: "unavailable",
    detailedChecks: "complete",
  },
  firstUsableViewStartedAt: "2026-07-28T00:00:00.000Z",
  fastPathDurationMs: 120,
  detailedChecks: {
    status: "complete",
    retrievedAt: "2026-07-28T00:00:01.000Z",
    durationMs: 30,
    region: "Auckland",
    limitations: [],
    layers: [
      {
        key: "wastewater_assets",
        state: "returned",
        evidence: { dataset: "Wastewater Pipes", provider: "Watercare" },
        geometry: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [174.608, -36.8604],
                  [174.6084, -36.8601],
                ],
              },
            },
          ],
        },
        message: "Returned 1 mapped feature.",
      },
    ],
  },
} as unknown as FastPropertyViewResult;
