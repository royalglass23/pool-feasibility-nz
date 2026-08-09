import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  trackAnonymousFunnelEvent,
} from "@/modules/anonymous-funnel-analytics";

describe("anonymous funnel analytics", () => {
  const gtag = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    gtag.mockReset();
    Object.defineProperty(window, "gtag", {
      configurable: true,
      value: gtag,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "gtag");
  });

  it("sends only allowlisted events after affirmative analytics consent", () => {
    expect(trackAnonymousFunnelEvent({ name: "address_search_started" })).toBe(
      false,
    );
    expect(gtag).not.toHaveBeenCalled();

    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");

    expect(trackAnonymousFunnelEvent({ name: "address_search_started" })).toBe(
      true,
    );
    expect(
      trackAnonymousFunnelEvent({
        name: "report_delivery_outcome",
        outcomeCategory: "delivered",
      }),
    ).toBe(true);
    expect(gtag).toHaveBeenNthCalledWith(1, "event", "address_search_started");
    expect(gtag).toHaveBeenNthCalledWith(
      2,
      "event",
      "report_delivery_outcome",
      { outcome_category: "delivered" },
    );
  });

  it("rejects unknown names, outcome values, and every extra payload field", () => {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");

    const rejected = [
      { name: "page_view" },
      { name: "report_delivery_outcome", outcomeCategory: "queued" },
      { name: "report_delivery_outcome", outcomeCategory: "email_failed" },
      { name: "property_check_completed", email: "jane@example.com" },
      { name: "report_form_viewed", address: "1 Test Street" },
      { name: "report_request_submitted", coordinates: [174.7, -36.8] },
      { name: "address_search_started", message: "free text" },
    ];

    for (const event of rejected) {
      expect(trackAnonymousFunnelEvent(event)).toBe(false);
    }
    expect(gtag).not.toHaveBeenCalled();
  });
});
