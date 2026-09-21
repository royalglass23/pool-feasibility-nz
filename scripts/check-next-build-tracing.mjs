import { readFile } from "node:fs/promises";
import path from "node:path";

const buildDirectory = path.resolve(process.argv[2] ?? ".next");
const chromiumBinaryPattern = /@sparticuz[\\/]chromium[\\/]bin[\\/]/;

const routeExpectations = [
  {
    route: "/api/public/assessments/report/delivery/status",
    trace:
      "server/app/api/public/assessments/report/delivery/status/route.js.nft.json",
    includesChromium: false,
  },
  {
    route: "/api/public/assessments/report/delivery",
    trace:
      "server/app/api/public/assessments/report/delivery/route.js.nft.json",
    includesChromium: true,
  },
  {
    route: "/api/internal/report/pdf",
    trace: "server/app/api/internal/report/pdf/route.js.nft.json",
    includesChromium: true,
  },
  {
    route: "/api/public/report/pdf",
    trace: "server/app/api/public/report/pdf/route.js.nft.json",
    includesChromium: true,
  },
  {
    route: "/api/public/assessments/report/pdf",
    trace: "server/app/api/public/assessments/report/pdf/route.js.nft.json",
    includesChromium: true,
  },
];

const failures = [];

for (const expectation of routeExpectations) {
  const tracePath = path.join(buildDirectory, ...expectation.trace.split("/"));
  let trace;

  try {
    trace = JSON.parse(await readFile(tracePath, "utf8"));
  } catch (error) {
    failures.push(
      `${expectation.route}: could not read ${tracePath} (${error.message})`,
    );
    continue;
  }

  const chromiumFiles = trace.files.filter((file) =>
    chromiumBinaryPattern.test(file),
  );
  const includesChromium = chromiumFiles.length > 0;

  if (includesChromium !== expectation.includesChromium) {
    failures.push(
      `${expectation.route}: expected Chromium binaries ${
        expectation.includesChromium ? "to be present" : "to be absent"
      }, found ${chromiumFiles.length}`,
    );
  }
}

if (failures.length > 0) {
  console.error("Next.js build tracing regression check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    "Next.js build tracing regression check passed: delivery/status excludes Chromium and PDF-producing routes retain it.",
  );
}
