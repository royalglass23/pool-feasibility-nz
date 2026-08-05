import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const outputDirectory = "output/pdf/assets";
await mkdir(outputDirectory, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-gpu", "--no-sandbox"],
});

try {
  for (const [name, query] of [["3d-aerial", ""], ["top-down-aerial", "?view=top"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.5 });
    await page.goto(`http://127.0.0.1:8020/prototype-assets/map-preview.html${query}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await page.evaluate(async () => {
      const previewMap = globalThis.__map;
      if (previewMap && !previewMap.loaded()) {
        await new Promise((resolve) => previewMap.once("idle", resolve));
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await page.screenshot({
      path: `${outputDirectory}/135-fiddlers-${name}.png`,
      type: "png",
    });
    await page.close();
  }
} finally {
  await browser.close();
}
