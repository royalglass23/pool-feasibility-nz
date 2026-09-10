import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareSpeedInsightsEvent } from "@/modules/speed-insights";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/modules/anonymous-funnel-analytics";

describe("Speed Insights event privacy", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("requires live consent, including for callbacks retained after withdrawal", () => {
    const event = { type: "vital" as const, url: `${window.location.origin}/` };
    expect(prepareSpeedInsightsEvent(event)).toBeNull();
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    expect(prepareSpeedInsightsEvent(event)).toEqual(event);
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    expect(prepareSpeedInsightsEvent(event)).toBeNull();
  });

  it("strips property and campaign parameters and fragments", () => {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    expect(
      prepareSpeedInsightsEvent({
        type: "vital",
        url: `${window.location.origin}/?address=private&utm_source=test#report`,
      }),
    ).toEqual({ type: "vital", url: `${window.location.origin}/` });
  });

  it.each(["/staff/sign-in", "/report/private-token", "/privacy"])(
    "blocks events for %s and events queued before navigation there",
    (path) => {
      localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
      expect(
        prepareSpeedInsightsEvent({ type: "vital", url: path }),
      ).toBeNull();
      window.history.replaceState({}, "", path);
      expect(prepareSpeedInsightsEvent({ type: "vital", url: "/" })).toBeNull();
    },
  );

  it("fails closed when browser storage is unavailable", () => {
    const storage = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("Storage blocked");
      });
    expect(prepareSpeedInsightsEvent({ type: "vital", url: "/" })).toBeNull();
    storage.mockRestore();
  });
});
