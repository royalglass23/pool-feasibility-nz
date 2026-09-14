// Isolated HTTP PDF burst using only synthetic assessments from our two runs.
// Run with --conditions=react-server --import tsx, then pass evidence directories.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createSavedReportAccessTokenService } from "../src/modules/reporting/saved-report-access-token.ts";
import { validateSavedPdfLoadTestSources } from "./load-test-saved-pdfs-input.ts";

const health = await (await fetch("http://127.0.0.1:3199/health")).json();
const signingKey = await readFile(
  "tmp/local-load-test/signing-key.txt",
  "utf8",
);
const access = createSavedReportAccessTokenService(signingKey);
const sources = [];
for (const source of process.argv.slice(2)) {
  const prior = JSON.parse(
    await readFile(resolve(source, "http-results.json")),
  );
  const verification = JSON.parse(
    await readFile(resolve(source, "persistence-verification.json")),
  );
  sources.push({
    httpResults: prior,
    persistenceVerification: verification,
  });
}
const reports = validateSavedPdfLoadTestSources({ health, sources });
if (reports.length < 100)
  throw new Error("100_DISTINCT_SAVED_TEST_REPORTS_REQUIRED");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const directory = resolve("output/load-tests", runId);
await mkdir(directory, { recursive: true });
const rows = [];
async function request(report, index, phase) {
  const started = performance.now();
  const row = {
    phase,
    index,
    assessmentId: report.id,
    reference: report.reference,
    started,
    ok: false,
  };
  rows.push(row);
  try {
    const response = await fetch(
      "http://127.0.0.1:3100/api/public/assessments/report/pdf",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vercel-forwarded-for": `198.18.${phase === "baseline" ? 4 : 3}.${index + 1}`,
          "x-correlation-id": `load-pdf-${runId}-${phase}-${index}`,
        },
        body: JSON.stringify({
          accessToken: access.issue({
            assessmentId: report.id,
            reference: report.reference,
          }),
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    row.status = response.status;
    const bytes = Buffer.from(await response.arrayBuffer());
    row.downloadMs = performance.now() - started;
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      try {
        code = JSON.parse(bytes.toString()).error?.code ?? code;
      } catch {
        /* preserve code */
      }
      throw new Error(code);
    }
    if (
      !response.headers.get("content-type")?.includes("application/pdf") ||
      !response.headers.get("content-disposition")?.includes("attachment") ||
      bytes.subarray(0, 5).toString() !== "%PDF-" ||
      !bytes.subarray(-1024).toString().includes("%%EOF")
    )
      throw new Error("INVALID_PDF");
    row.file = `${phase}-${index}.pdf`;
    await writeFile(resolve(directory, row.file), bytes);
    if (!(await readFile(resolve(directory, row.file))).equals(bytes))
      throw new Error("PDF_SAVE_MISMATCH");
    row.bytes = bytes.length;
    row.sha256 = createHash("sha256").update(bytes).digest("hex");
    row.ok = true;
  } catch (error) {
    row.error = error.message;
  }
  row.totalMs = performance.now() - started;
  return row;
}
const baseline = await request(reports[0], 0, "baseline");
if (!baseline.ok) throw new Error(`BASELINE_PDF_FAILED_${baseline.error}`);
await Promise.all(
  reports.slice(0, 100).map((report, i) => request(report, i, "burst")),
);
const failed = rows.find((r) => r.phase === "burst" && !r.ok);
if (failed) await request(reports[failed.index], failed.index, "recovery");
const burst = rows.filter((r) => r.phase === "burst");
const successTimes = burst
  .filter((r) => r.ok)
  .map((r) => r.totalMs)
  .sort((a, b) => a - b);
const summary = {
  attempted: burst.length,
  succeeded: successTimes.length,
  failed: burst.length - successTimes.length,
  medianMs: successTimes.length
    ? successTimes[Math.ceil(successTimes.length / 2) - 1]
    : null,
  p95Ms: successTimes.length
    ? successTimes[Math.ceil(successTimes.length * 0.95) - 1]
    : null,
  dispatchSpreadMs:
    Math.max(...burst.map((r) => r.started)) -
    Math.min(...burst.map((r) => r.started)),
  errors: Object.fromEntries(
    [...new Set(burst.filter((r) => !r.ok).map((r) => r.error))].map((e) => [
      e,
      burst.filter((r) => r.error === e).length,
    ]),
  ),
};
await writeFile(
  resolve(directory, "pdf-http-results.json"),
  JSON.stringify(
    {
      runId,
      environment: health,
      scope:
        "100 simultaneous HTTP downloads of 100 distinct saved synthetic reports; one local production-build server",
      fixturePreparation:
        "Access tokens issued with application helper and local-only test key; database lookup and authorization executed by real HTTP route",
      sourceRuns: process.argv.slice(2),
      baseline,
      summary,
      rows,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    directory,
    baseline,
    summary,
    recovery: rows.find((r) => r.phase === "recovery"),
  }),
);
