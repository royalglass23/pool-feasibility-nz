import { afterEach, describe, expect, it, vi } from "vitest";

const logInfo = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("pino", () => ({ default: () => ({ info: logInfo }) }));

import { POST } from "@/app/api/internal/report/pdf/route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/internal/report/pdf security outcomes", () => {
  it("logs a rejected outcome without submitted report content", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const submittedMarker = "sensitive-report-marker";

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/report/pdf", {
        method: "POST",
        headers: { "X-Correlation-ID": "report-security-log-test" },
        body: JSON.stringify({ submittedMarker }),
      }),
    );

    expect(response.status).toBe(400);
    expect(logInfo).toHaveBeenCalledWith({
      event: "pdf_report_security",
      outcome: "rejected",
      category: "invalid_request",
      principal: "local_development",
      status: 400,
      correlationId: "report-security-log-test",
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain(submittedMarker);
  });
});
