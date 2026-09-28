// Test-only third-party boundary for RG-355. Never load this in deployment.
import { appendFileSync } from "node:fs";

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
    appendFileSync(
      process.env.AUDIENCE_COMPATIBILITY_MAIL_CAPTURE,
      `${JSON.stringify({
        idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
        body: JSON.parse(String(init?.body ?? "{}")),
      })}\n`,
    );
    return Response.json({ id: "isolated-audience-compatibility-email" });
  }

  return originalFetch(input, init);
};
