import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveContactDeliveryPolicy } from "@/modules/contact/contact-delivery-policy";

describe("contact delivery policy", () => {
  it("permits the synthetic sink only in local development or test", () => {
    expect(
      resolveContactDeliveryPolicy({
        mode: "synthetic_test",
        nodeEnvironment: "development",
      }),
    ).toEqual({ mode: "synthetic_test" });
  });

  it("fails closed if synthetic delivery is configured for a deployment", () => {
    expect(() =>
      resolveContactDeliveryPolicy({
        mode: "synthetic_test",
        nodeEnvironment: "production",
        vercelEnvironment: "production",
      }),
    ).toThrow("CONTACT_DELIVERY_MODE_DISABLED");
  });
});
