import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { generatePreliminaryReportPdf } from "../src/modules/reporting/report-renderer";
import { buildTestPreliminaryReport } from "../tests/fixtures/preliminary-report";

// Component probe: real local Chromium and filesystem, no database or emails.
// It measures one Node process, not a deployed multi-instance service.
async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = join(process.cwd(), "output", "load-tests", runId);
  await mkdir(directory, { recursive: true });
  const probe = async (index: number, phase: string) => {
    const started = performance.now();
    try {
      const pdf = await generatePreliminaryReportPdf(
        buildTestPreliminaryReport(),
      );
      const renderedMs = performance.now() - started;
      const path = join(directory, `${phase}-${index}.pdf`);
      await writeFile(path, pdf);
      const saved = await readFile(path);
      if (
        !saved.equals(pdf) ||
        saved.subarray(0, 5).toString() !== "%PDF-" ||
        !saved.subarray(-1024).toString().includes("%%EOF")
      ) {
        throw new Error("PDF_FILE_VERIFICATION_FAILED");
      }
      return {
        index,
        phase,
        ok: true,
        renderedMs,
        totalMs: performance.now() - started,
        bytes: saved.length,
        path,
      };
    } catch (error) {
      return {
        index,
        phase,
        ok: false,
        totalMs: performance.now() - started,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      };
    }
  };
  const baseline = await probe(0, "baseline");
  console.log(JSON.stringify({ baseline }));
  const burst = baseline.ok
    ? await Promise.all(
        Array.from({ length: 100 }, (_, index) => probe(index, "burst")),
      )
    : [];
  const evidence = {
    runId,
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    environment:
      "Local Windows; one Node process; installed Chromium; synthetic fixture",
    limitations: [
      "No HTTP download, database, provider traffic or deployment scaling exercised",
      "Fixture contains a small synthetic map; timings do not represent full real-world reports",
    ],
    baseline,
    attempted: burst.length,
    succeeded: burst.filter((r) => r.ok).length,
    failed: burst.filter((r) => !r.ok).length,
    burst,
  };
  await writeFile(
    join(directory, "pdf-component-results.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      directory,
      attempted: evidence.attempted,
      succeeded: evidence.succeeded,
      failed: evidence.failed,
      successes: burst.filter((r) => r.ok),
      errorCounts: Object.fromEntries(
        [...new Set(burst.filter((r) => !r.ok).map((r) => r.error))].map(
          (error) => [
            error,
            burst.filter((r) => !r.ok && r.error === error).length,
          ],
        ),
      ),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
