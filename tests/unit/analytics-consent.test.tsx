import { runInNewContext } from "node:vm";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/modules/anonymous-funnel-analytics";

vi.mock("next/script", () => ({
  default: ({ children, ...props }: React.ComponentProps<"script">) => (
    <script {...props}>{children}</script>
  ),
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <span data-testid="speed-insights" />,
}));

describe("analytics consent", () => {
  afterEach(() => {
    cleanup();
    document
      .querySelectorAll('#_next-gtm, #_next-gtm-init, script[src*="/gtm.js"]')
      .forEach((element) => element.remove());
    delete (window as Window & { dataLayer?: unknown[] }).dataLayer;
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Reflect.deleteProperty(window, "posthog");
  });

  it("keeps GA unloaded until consent and lets the visitor reverse the choice", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AnalyticsConsent measurementId="G-TEST123" />,
    );

    expect(
      await screen.findByRole("heading", { name: "Analytics cookies" }),
    ).toBeVisible();
    expect(
      container.querySelector('script[src*="googletagmanager"]'),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(
      screen.queryByRole("heading", { name: "Analytics cookies" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBeNull();
    expect(
      container.querySelector('script[src*="googletagmanager"]'),
    ).toBeNull();

    await user.click(
      within(container).getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(screen.getByRole("button", { name: "Allow analytics" }));

    await waitFor(() =>
      expect(
        container.querySelector('script[src*="googletagmanager"]'),
      ).not.toBeNull(),
    );
    expect(container.querySelector("#ga4-config")?.textContent).toContain(
      "send_page_view:false",
    );
    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");

    await user.click(
      screen.getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Turn analytics off" }),
    );

    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(
      (window as unknown as Record<string, unknown>)["ga-disable-G-TEST123"],
    ).toBe(true);
  });

  it("loads the configured GTM container only after consent", async () => {
    const user = userEvent.setup();
    render(<AnalyticsConsent gtmId="GTM-WC3QDMX6" />);

    expect(document.querySelector('script[src*="/gtm.js"]')).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Allow analytics" }),
    );

    await waitFor(() =>
      expect(document.querySelector('script[src*="/gtm.js"]')).toHaveAttribute(
        "src",
        expect.stringContaining("id=GTM-WC3QDMX6"),
      ),
    );
    expect(document.querySelector("#_next-gtm-init")?.textContent).toContain(
      "gtm.start",
    );
  });

  it("withdraws Google consent when GTM is configured without direct GA", async () => {
    const user = userEvent.setup();
    const analyticsWindow = window as Window & { dataLayer?: unknown[] };
    analyticsWindow.dataLayer = [];
    document.cookie = "_ga=synthetic; Path=/";
    document.cookie = "_ga_CONTAINER=synthetic; Path=/";
    render(<AnalyticsConsent gtmId="GTM-WC3QDMX6" />);

    await user.click(
      await screen.findByRole("button", { name: "Allow analytics" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Turn analytics off" }),
    );

    expect(analyticsWindow.dataLayer).toContainEqual([
      "consent",
      "update",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).not.toContain("_ga_CONTAINER=");
  });

  it("gates Metricool and PostHog on consent even without GA4 or Hotjar", async () => {
    const user = userEvent.setup();
    const { container } = render(<AnalyticsConsent />);

    const pixel = () =>
      container.querySelector('img[src*="tracker.metricool.com"]');
    expect(pixel()).toBeNull();
    expect(document.querySelector("#posthog-loader")).toBeNull();
    expect(within(container).queryByTestId("speed-insights")).toBeNull();
    await user.click(
      await screen.findByRole("button", { name: "Reject analytics" }),
    );
    expect(pixel()).toBeNull();
    expect(document.querySelector("#posthog-loader")).toBeNull();
    expect(within(container).queryByTestId("speed-insights")).toBeNull();
    await user.click(
      within(container).getByRole("button", { name: "Analytics settings" }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Allow analytics" }),
    );

    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    const posthogScript = document.querySelector("#posthog-loader");
    expect(posthogScript?.textContent).toContain("https://eu.i.posthog.com");
    expect(posthogScript?.textContent).toContain("autocapture: false");
    expect(posthogScript?.textContent).toContain(
      "disable_session_recording: true",
    );
    const context: Record<string, unknown> = {
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [
          { parentNode: { insertBefore: () => undefined } },
        ],
      },
      localStorage,
    };
    context.window = context;
    runInNewContext(posthogScript?.textContent ?? "", context);
    const posthog = context.posthog as {
      _i: Array<
        [
          string,
          {
            before_send: (event: {
              event: string;
              properties: Record<string, string>;
            }) => { properties: Record<string, string> } | null;
          },
        ]
      >;
    };
    const [key, config] = posthog._i[0];
    expect(key).toBe("phc_BCgxNofbcnuCzPePiYFdqzHKRaB6ectcYCRXJzjhDUPd");
    expect(
      config.before_send({
        event: "property_check_completed",
        properties: {
          token: key,
          distinct_id: "anonymous-visitor",
          address: "1 Test Street",
        },
      })?.properties,
    ).toEqual({ token: key, distinct_id: "anonymous-visitor" });
    expect(
      config.before_send({
        event: "property_check_completed",
        properties: { token: key },
      }),
    ).toBeNull();
    expect(
      config.before_send({
        event: "$pageview",
        properties: { token: key, distinct_id: "anonymous-visitor" },
      }),
    ).toBeNull();
    expect(pixel()).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(within(container).getByTestId("speed-insights")).toBeInTheDocument();

    await user.click(
      within(container).getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Turn analytics off" }),
    );
    expect(pixel()).toBeNull();
    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(within(container).queryByTestId("speed-insights")).toBeNull();
  });

  it("opts out of PostHog when consent is withdrawn and back in when granted", async () => {
    const user = userEvent.setup();
    const optIn = vi.fn();
    const optOut = vi.fn();
    Object.defineProperty(window, "posthog", {
      configurable: true,
      value: { opt_in_capturing: optIn, opt_out_capturing: optOut },
    });
    const { container } = render(<AnalyticsConsent />);

    await user.click(
      await screen.findByRole("button", { name: "Allow analytics" }),
    );
    expect(optIn).toHaveBeenCalled();
    expect(document.querySelector("#posthog-loader")).not.toBeNull();

    await user.click(
      within(container).getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Turn analytics off" }),
    );
    expect(optOut).toHaveBeenCalled();
  });

  it("loads Hotjar only after consent and clears its browser storage on withdrawal", async () => {
    const user = userEvent.setup();
    const { container } = render(<AnalyticsConsent hotjarSiteId="123456" />);

    expect(container.querySelector("#hotjar-loader")).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Allow analytics" }),
    );

    expect(container.querySelector("#hotjar-loader")?.textContent).toContain(
      "static.hotjar.com/c/hotjar-",
    );
    localStorage.setItem("_hjSession_123456", "session");
    sessionStorage.setItem("hjViewportId", "viewport");

    await user.click(
      within(container).getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Turn analytics off" }),
    );

    expect(localStorage.getItem("_hjSession_123456")).toBeNull();
    expect(sessionStorage.getItem("hjViewportId")).toBeNull();
  });
});
