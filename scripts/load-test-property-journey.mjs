// HTTP virtual-user test of the local production build. No production targets.
// Run: node --import tsx scripts/load-test-property-journey.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import { loadLoadTestDatabaseTarget } from "./load-test-database-target.mjs";
import {
  findFastPoolDefaultPosition,
  fastPoolConstructionEnvelopeDimensions,
} from "../src/modules/data-access-spike/fast-pool-placement.ts";

const baseURL = "http://127.0.0.1:3100";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const directory = resolve("output/load-tests", runId);
await mkdir(directory, { recursive: true });
const { databaseUrl, databaseIdentity } = loadLoadTestDatabaseTarget(
  process.cwd(),
);
const health = await (await fetch("http://127.0.0.1:3199/health")).json();
if (
  !health.localLoadTest ||
  !health.emailDisabled ||
  health.databaseFingerprint !==
    createHash("sha256").update(databaseIdentity).digest("hex").slice(0, 16)
) {
  throw new Error("LOCAL_TEST_HOST_SAFETY_CHECK_FAILED");
}
const sql = neon(databaseUrl);
let fixtures = await sql`
  select address_id, full_address, longitude, latitude
  from linz_address_index
  where is_current = true and territorial_authority = 'Auckland'
    and (unit is null or unit = '')
    and full_address_number ~ '^[0-9]+[A-Z]?$'
  order by address_id limit 101
`;
const validatedSource = process.argv[2];
if (validatedSource) {
  const previous = JSON.parse(
    await readFile(resolve(validatedSource, "http-results.json")),
  );
  const previousFixtures = JSON.parse(
    await readFile(resolve(validatedSource, "address-fixtures.json")),
  );
  const validIds = new Set(
    previous.saved
      .filter((row) => row.cohort === "burst")
      .map((row) =>
        String(previousFixtures[row.user % previousFixtures.length].address_id),
      ),
  );
  fixtures = fixtures.filter((row) => validIds.has(String(row.address_id)));
}
if (fixtures.length < 1) throw new Error("NO_ADDRESS_FIXTURES");
await writeFile(
  resolve(directory, "address-fixtures.json"),
  JSON.stringify(fixtures, null, 2),
);

// Real PNG payload, deliberately labelled synthetic. Browser map rendering and
// client-side tile traffic are outside this HTTP test's scope.
const width = 768,
  height = 512;
const raw = Buffer.alloc(width * height * 3);
let seed = 9102026;
for (let i = 0; i < raw.length; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  raw[i] = 90 + (seed >>> 26);
}
const svg = Buffer.from(
  `<svg width="${width}" height="${height}"><rect x="0" y="200" width="768" height="112" fill="white"/><text x="30" y="245" font-size="24" fill="black">SYNTHETIC LOAD TEST IMAGE</text><text x="30" y="280" font-size="20" fill="black">Not a property map</text></svg>`,
);
const png = await sharp(raw, { raw: { width, height, channels: 3 } })
  .composite([{ input: svg }])
  .png()
  .toBuffer();
await writeFile(resolve(directory, "synthetic-map.png"), png);
const mapImageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
const measurements = [];
const states = [];

async function post(user, phase, path, body, pdf = false) {
  const startedAt = performance.now();
  const row = {
    cohort: user.cohort,
    user: user.index,
    phase,
    startedAt,
    status: null,
    ok: false,
  };
  measurements.push(row);
  try {
    const response = await fetch(`${baseURL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-forwarded-for": user.ip,
        "x-correlation-id": `load-${runId}-${user.cohort}-${user.index}-${phase}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    row.status = response.status;
    row.correlationId = response.headers.get("x-correlation-id");
    const bytes = Buffer.from(await response.arrayBuffer());
    row.responseBytes = bytes.length;
    row.responseMs = performance.now() - startedAt;
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      try {
        code = JSON.parse(bytes.toString()).error?.code ?? code;
      } catch {
        /* preserve HTTP code */
      }
      throw new Error(code);
    }
    if (pdf) {
      if (
        !response.headers.get("content-type")?.includes("application/pdf") ||
        !response.headers.get("content-disposition")?.includes("attachment") ||
        bytes.subarray(0, 5).toString() !== "%PDF-" ||
        !bytes.subarray(-1024).toString().includes("%%EOF")
      ) {
        throw new Error("INVALID_PDF_RESPONSE");
      }
      const file = `${user.cohort}-${user.index}-${phase}.pdf`;
      await writeFile(resolve(directory, file), bytes);
      if (!(await readFile(resolve(directory, file))).equals(bytes))
        throw new Error("PDF_SAVE_VERIFICATION_FAILED");
      row.file = file;
      row.sha256 = createHash("sha256").update(bytes).digest("hex");
      row.ok = true;
      return row;
    }
    const data = JSON.parse(bytes.toString());
    if (
      phase === "suggestions" &&
      !data.suggestions?.some(
        (s) => s.addressId === String(user.fixture.address_id),
      )
    ) {
      throw new Error("EXPECTED_ADDRESS_NOT_SUGGESTED");
    }
    if (
      phase === "property" &&
      (!data.data?.resolvedAddress || !data.assessmentSnapshot)
    )
      throw new Error("INVALID_PROPERTY_RESPONSE");
    if (["boundary", "details"].includes(phase) && !data.assessmentSnapshot)
      throw new Error("MISSING_STAGE_SNAPSHOT");
    if (phase === "boundary") {
      row.boundaryState = data.data?.boundary?.state;
      row.aerialState = data.data?.aerial?.state;
    }
    if (phase === "details") {
      if (!Array.isArray(data.data?.layers) || data.data.layers.length === 0)
        throw new Error("MISSING_DETAILED_LAYERS");
      row.detailStatus = data.data.status;
      row.layerStates = Object.fromEntries(
        data.data.layers.map((l) => [l.key, l.state]),
      );
      row.layerErrors = data.data.layers
        .filter((l) => l.evidence?.errorCode)
        .map((l) => ({
          key: l.key,
          state: l.state,
          code: l.evidence.errorCode,
        }));
    }
    if (
      phase === "save" &&
      (!data.assessment?.id || !data.assessment?.reportAccessToken)
    )
      throw new Error("INVALID_SAVE_RESPONSE");
    row.ok = true;
    return data;
  } catch (error) {
    row.error =
      error.name === "TimeoutError" ? "CLIENT_TIMEOUT_120S" : error.message;
    throw error;
  } finally {
    row.totalMs = performance.now() - startedAt;
  }
}

function summary(cohort) {
  return [
    "suggestions",
    "property",
    "boundary",
    "details",
    "save",
    "pdf",
    "pdf-recovery",
  ]
    .map((phase) => {
      const rows = measurements.filter(
        (r) => r.cohort === cohort && r.phase === phase,
      );
      const successes = rows.filter((r) => r.ok);
      const times = successes.map((r) => r.totalMs).sort((a, b) => a - b);
      const pct = (p) =>
        times.length
          ? Math.round(times[Math.max(0, Math.ceil(times.length * p) - 1)])
          : null;
      return {
        phase,
        attempted: rows.length,
        succeeded: successes.length,
        failed: rows.length - successes.length,
        partial: rows.filter((r) => r.detailStatus === "partial").length,
        medianMs: pct(0.5),
        p95Ms: pct(0.95),
        maxMs: pct(1),
        dispatchSpreadMs: rows.length
          ? Math.round(
              Math.max(...rows.map((r) => r.startedAt)) -
                Math.min(...rows.map((r) => r.startedAt)),
            )
          : null,
        errors: Object.fromEntries(
          [...new Set(rows.filter((r) => !r.ok).map((r) => r.error))].map(
            (code) => [code, rows.filter((r) => r.error === code).length],
          ),
        ),
      };
    })
    .filter((r) => r.attempted);
}

async function checkpoint() {
  const saved = states
    .filter((u) => u.saved)
    .map((u) => ({
      cohort: u.cohort,
      user: u.index,
      id: u.saved.id,
      reference: u.saved.reference,
    }));
  await writeFile(
    resolve(directory, "http-results.json"),
    JSON.stringify(
      {
        runId,
        baseURL,
        commit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        environment:
          "Local Windows production build; single Next server; live development DB and GIS; local Redis emulator; emails disabled",
        imageBytes: png.length,
        distinctAddressFixtures: fixtures.length,
        baseline: summary("baseline"),
        burst: summary("burst"),
        measurements,
        saved,
        limitations: [
          "HTTP virtual users, not 100 interactive browsers",
          "Synthetic map image; client rendering and client tile fetching excluded",
          "One local server; no Vercel scaling, production database, production Redis, or email throughput measured",
          `Development address index supplied ${fixtures.length} fixtures; repeated properties can coalesce and reduce provider load`,
          "Latency percentiles use successful responses; failures and partial checks reported separately",
          "Synchronized stages, zero automatic retries",
        ],
      },
      null,
      2,
    ),
  );
}

async function cohort(name, items) {
  const users = items.map((fixture, index) => ({
    cohort: name,
    index,
    fixture,
    ip:
      name === "baseline"
        ? "198.18.1.1"
        : `198.18.${validatedSource ? 2 : 0}.${index + 1}`,
  }));
  states.push(...users);
  const phase = async (label, operation) => {
    await Promise.all(
      users
        .filter((u) => !u.failed)
        .map(async (user) => {
          try {
            await operation(user);
          } catch (error) {
            user.failed = { phase: label, code: error.message };
          }
        }),
    );
    await checkpoint();
    console.log(
      JSON.stringify({
        cohort: name,
        ...summary(name).find((r) => r.phase === label),
        remaining: users.filter((u) => !u.failed).length,
      }),
    );
  };
  await phase("suggestions", async (u) => {
    await post(u, "suggestions", "/api/public/address-suggestions", {
      query: u.fixture.full_address.split(",")[0],
    });
  });
  await phase("property", async (u) => {
    const value = await post(u, "property", "/api/public/property-check", {
      address: u.fixture.full_address,
      selectedAddressId: String(u.fixture.address_id),
    });
    u.snapshot = value.assessmentSnapshot;
    u.property = value.data;
  });
  const stageBody = (u) => ({
    addressId: u.property.resolvedAddress.addressId,
    coordinates: u.property.resolvedAddress.coordinates,
    assessmentSnapshot: u.snapshot,
  });
  await phase("boundary", async (u) => {
    const value = await post(
      u,
      "boundary",
      "/api/public/property-check/stages",
      stageBody(u),
    );
    u.snapshot = value.assessmentSnapshot;
    u.property = { ...u.property, ...value.data };
  });
  await phase("details", async (u) => {
    const value = await post(
      u,
      "details",
      "/api/public/property-check/stages",
      { ...stageBody(u), mode: "detailed" },
    );
    u.snapshot = value.assessmentSnapshot;
  });
  // Placement setup is outside the measured save request.
  for (const u of users.filter((u) => !u.failed)) {
    const geometry = u.property.boundary?.geometry;
    const dimensions = { lengthMetres: 6.5, widthMetres: 3 };
    u.position = geometry
      ? findFastPoolDefaultPosition(
          geometry,
          fastPoolConstructionEnvelopeDimensions(dimensions),
        )
      : u.property.resolvedAddress.coordinates;
    if (!u.position)
      u.failed = { phase: "placement", code: "NO_VALID_FIXTURE_PLACEMENT" };
  }
  await phase("save", async (u) => {
    const value = await post(u, "save", "/api/public/assessments", {
      assessmentSnapshot: u.snapshot,
      mapImageDataUrl,
      mapVisibleLayerKeys: [],
      homeowner: {
        name: `LOAD TEST ${runId} ${name} ${u.index}`,
        phone: "0000000000",
        email: `load-${name}-${u.index}@example.invalid`,
        visitorType: "homeowner",
        desiredTiming: "12_months",
        additionalInfo: `SYNTHETIC LOAD TEST ${runId}; not a real enquiry; email disabled`,
        consentGiven: true,
      },
      poolLayout: {
        lengthMetres: 6.5,
        widthMetres: 3,
        rotationDegrees: 0,
        position: u.position,
        clearancesVisible: true,
      },
    });
    u.saved = value.assessment;
  });
  await phase("pdf", async (u) => {
    await post(
      u,
      "pdf",
      "/api/public/assessments/report/pdf",
      { accessToken: u.saved.reportAccessToken },
      true,
    );
  });
  return users;
}

try {
  if (!validatedSource) {
    const baseline = await cohort("baseline", fixtures.slice(0, 1));
    if (baseline[0].failed)
      throw new Error(
        `BASELINE_FAILED_${baseline[0].failed.phase}_${baseline[0].failed.code}`,
      );
  }
  const burst = await cohort(
    "burst",
    Array.from({ length: 100 }, (_, i) => fixtures[i % fixtures.length]),
  );
  // One diagnostic recovery after the burst, kept separate from burst results.
  const failedPdf = burst.find((u) => u.saved && u.failed?.phase === "pdf");
  if (failedPdf) {
    try {
      await post(
        failedPdf,
        "pdf-recovery",
        "/api/public/assessments/report/pdf",
        { accessToken: failedPdf.saved.reportAccessToken },
        true,
      );
    } catch {
      /* recorded */
    }
  }
  const marker = `SYNTHETIC LOAD TEST ${runId}; not a real enquiry; email disabled`;
  const persisted = await sql`
    select id, reference, email_delivery_attempt_count, forwarding_attempt_count,
      email_delivery_state, forwarding_state,
      report_map_image_data_url is not null as has_map,
      report_data is not null as has_report
    from homeowner_assessments where additional_info = ${marker}
  `;
  const expected = states.filter((u) => u.saved);
  const verification = {
    expected: expected.length,
    found: persisted.length,
    allIdsPresent: expected.every((u) =>
      persisted.some((r) => r.id === u.saved.id),
    ),
    allReportsPresent: persisted.every((r) => r.has_map && r.has_report),
    zeroEmailAttempts: persisted.every(
      (r) =>
        r.email_delivery_attempt_count === 0 &&
        r.forwarding_attempt_count === 0,
    ),
    persisted,
    notReached: states
      .filter((u) => u.failed)
      .map((u) => ({ cohort: u.cohort, user: u.index, ...u.failed })),
  };
  await writeFile(
    resolve(directory, "persistence-verification.json"),
    JSON.stringify(verification, null, 2),
  );
  console.log(
    JSON.stringify({
      persistence: {
        expected: verification.expected,
        found: verification.found,
        allIdsPresent: verification.allIdsPresent,
        allReportsPresent: verification.allReportsPresent,
        zeroEmailAttempts: verification.zeroEmailAttempts,
      },
    }),
  );
} catch (error) {
  await writeFile(
    resolve(directory, "blocked.json"),
    JSON.stringify({ error: error.message }, null, 2),
  );
  console.log(JSON.stringify({ stopped: error.message }));
  process.exitCode = 1;
} finally {
  await checkpoint();
  console.log(
    JSON.stringify({
      directory,
      baseline: summary("baseline"),
      burst: summary("burst"),
    }),
  );
}
