import { expect, test, type APIRequestContext } from "@playwright/test";
import { createDataAccessGateway } from "../../tests/fixtures/normalized-data-access";
import { buildSessionAssessment } from "../../src/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "../../src/modules/data-access-spike/run-data-access-spike";
import { createSessionReportTokenService } from "../../src/modules/reporting/report-token";
const endpoint = "/api/internal/report/pdf";
const authorization = `Basic ${Buffer.from("security-user:security-password-123").toString("base64")}`;
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGL5//8/AAAA//+rxzhLAAAABklEQVQDAAYOAwJctCtXAAAAAElFTkSuQmCC";

type FixtureTokens = {
  valid: string;
  injection: string;
};
let tokenCache: FixtureTokens | undefined;

async function fixtureTokens(): Promise<FixtureTokens> {
  if (tokenCache) return tokenCache;
  const result = await runDataAccessSpike({
    requestedAddress: "42A Bahari Drive, Ranui, Auckland",
    gateway: createDataAccessGateway(),
    now: () => new Date("2026-07-20T01:02:03.000Z"),
  });
  const validAssessment = buildSessionAssessment(result);
  const injectionAssessment = structuredClone(validAssessment);
  injectionAssessment.property.address =
    "<img src=x onerror=\"fetch('http://127.0.0.1:1')\">";
  const tokens = createSessionReportTokenService(
    "security-report-signing-secret-at-least-32-bytes",
  );
  tokenCache = {
    valid: tokens.issue(validAssessment),
    injection: tokens.issue(injectionAssessment),
  };
  return tokenCache;
}

async function validPayload() {
  return { reportToken: (await fixtureTokens()).valid, mapImageDataUrl: png };
}

function post(
  request: APIRequestContext,
  data: unknown,
  headers: Record<string, string> = {},
) {
  return request.post(endpoint, {
    data,
    headers: { authorization, ...headers },
    timeout: 60_000,
  });
}

test("denies anonymous and wrong credentials without report disclosure", async ({
  request,
}) => {
  const payload = await validPayload();
  const anonymous = await request.post(endpoint, { data: payload });
  const wrong = await request.post(endpoint, {
    data: payload,
    headers: {
      authorization: `Basic ${Buffer.from("security-user:wrong-password").toString("base64")}`,
    },
  });

  for (const response of [anonymous, wrong]) {
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify(body)).not.toContain("42A Bahari");
  }
});

test("returns one no-store three-page PDF for a valid staff request", async ({
  request,
}) => {
  const response = await post(request, await validPayload());
  const pdf = Buffer.from(await response.body());

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-disposition"]).toContain(
    "pool-feasibility-2359811.pdf",
  );
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
});

test("rejects malformed and oversized requests before rendering", async ({
  request,
}) => {
  const malformed = await request.post(endpoint, {
    data: "{not-json",
    headers: { authorization, "content-type": "application/json" },
  });
  const oversized = await request.post(endpoint, {
    data: JSON.stringify({ padding: "x".repeat(6_500_100) }),
    headers: { authorization, "content-type": "application/json" },
  });

  expect(malformed.status()).toBe(400);
  expect(oversized.status()).toBe(413);
  expect(await malformed.text()).not.toContain("not-json");
  expect(malformed.headers()["cache-control"]).toBe("no-store");
  expect(oversized.headers()["cache-control"]).toBe("no-store");
});

test("rejects non-PNG and attribute-injection-shaped map inputs", async ({
  request,
}) => {
  const remote = await validPayload();
  remote.mapImageDataUrl = "https://127.0.0.1/internal";
  const injection = await validPayload();
  injection.mapImageDataUrl =
    "data:image/png;base64,x\" onerror=\"fetch('http://127.0.0.1:1/security-probe')";

  expect((await post(request, remote)).status()).toBe(400);
  expect((await post(request, injection)).status()).toBe(400);
});

test("rejects tampered assessment facts instead of minting a forged report", async ({
  request,
}) => {
  const payload = await validPayload();
  const tampered = {
    ...payload,
    assessment: {
      property: { address: "Forged address, Auckland" },
      recommendation: "No investigation is required.",
    },
  };

  const response = await post(request, tampered);

  expect([400, 409]).toContain(response.status());
  expect(await response.text()).not.toContain("Forged address");
});

test("rejects unbounded nested report content before Chromium", async ({
  request,
}) => {
  const payload = await validPayload();
  const oversizedNested = {
    ...payload,
    limitations: ["x".repeat(50_000)],
  };

  const response = await post(request, oversizedNested);

  expect(response.status()).toBe(400);
});

test("escapes injection-shaped report text while preserving a valid PDF", async ({
  request,
}) => {
  const payload = {
    reportToken: (await fixtureTokens()).injection,
    mapImageDataUrl: png,
  };

  const response = await post(request, payload);

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
});

test("returns safe validation errors and replaces unsafe correlation IDs", async ({
  request,
}) => {
  const validToken = (await fixtureTokens()).valid;
  const payload = {
    reportToken: `${validToken.slice(0, -1)}x`,
    mapImageDataUrl: png,
  };
  const response = await post(request, payload, {
    "x-correlation-id": "private-address-stack-probe with spaces",
  });
  const text = await response.text();

  expect(response.status()).toBe(400);
  expect(text).not.toContain("private-address-stack-probe");
  expect(text).not.toMatch(/node_modules|session-report\.ts|RangeError/);
  expect(response.headers()["x-correlation-id"]).toMatch(
    /^[A-Za-z0-9._:-]{1,100}$/,
  );
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("bounds concurrent Chromium rendering with an explicit busy response", async ({
  request,
}) => {
  const firstPayload = await validPayload();
  const secondPayload = await validPayload();
  const responses = await Promise.all([
    post(request, firstPayload),
    post(request, secondPayload),
  ]);
  const busy = responses.find((response) => response.status() === 429);

  expect(
    busy,
    `observed statuses: ${responses.map((response) => response.status()).join(", ")}`,
  ).toBeDefined();
  expect((await busy!.json()).error.code).toBe("REPORT_RENDERER_BUSY");
});
