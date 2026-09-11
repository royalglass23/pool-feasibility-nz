import { describe, expect, it } from "vitest";
import { friendlyRequestError } from "@/components/form-feedback";

describe("friendlyRequestError", () => {
  it("distinguishes an exceeded limit from an unavailable limiter", () => {
    expect(
      friendlyRequestError(429, "save your report", {
        code: "RATE_LIMITED",
        correlationId: "rate-limited-reference",
      }),
    ).toContain("wait");

    expect(
      friendlyRequestError(503, "save your report", {
        code: "RATE_LIMIT_UNAVAILABLE",
        correlationId: "limiter-unavailable-reference",
      }),
    ).toBe(
      "We couldn't verify the request limit just now. Your details are still here. Please try again shortly. Reference: limiter-unavailable-reference.",
    );
  });

  it("retains the correlation reference for another server failure", () => {
    expect(
      friendlyRequestError(502, "send your message", {
        code: "DELIVERY_UNAVAILABLE",
        correlationId: "delivery-reference",
      }),
    ).toContain("Reference: delivery-reference.");
  });
});
