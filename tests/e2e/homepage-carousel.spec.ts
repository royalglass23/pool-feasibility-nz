import { expect, test } from "@playwright/test";

test("keeps the full workflow visual visible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#how-it-works");

  const explainer = page.locator("#how-it-works");
  const steps = [
    ["Find your property", "PoolReady example: find your property"],
    ["Select a pool size", "PoolReady example: select a pool size"],
    ["Position your pool", "PoolReady example: position your pool"],
    ["Check mapped information", "PoolReady example: check mapped information"],
    [
      "Understand your next steps",
      "PoolReady example: understand your next steps",
    ],
  ] as const;

  for (const [buttonName, imageName] of steps) {
    await explainer.getByRole("button", { name: buttonName }).click();

    const image = explainer.getByRole("img", { name: imageName });
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        image.evaluate(
          (element) => (element as HTMLImageElement).naturalHeight,
        ),
      )
      .toBeGreaterThan(0);

    const presentation = await image.evaluate((element) => {
      const imageElement = element as HTMLImageElement;
      const frame = imageElement.parentElement?.getBoundingClientRect();
      if (!frame) throw new Error("Workflow visual frame is missing.");

      return {
        frameRatio: frame.width / frame.height,
        naturalRatio: imageElement.naturalWidth / imageElement.naturalHeight,
        objectFit: getComputedStyle(imageElement).objectFit,
      };
    });

    expect(Number.isFinite(presentation.frameRatio)).toBe(true);
    expect(Number.isFinite(presentation.naturalRatio)).toBe(true);

    const cropsImage =
      presentation.objectFit === "cover" &&
      Math.abs(presentation.naturalRatio - presentation.frameRatio) > 0.05;

    expect(cropsImage).toBe(false);
  }
});
