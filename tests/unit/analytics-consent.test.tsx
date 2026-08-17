import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/modules/anonymous-funnel-analytics";

vi.mock("next/script", () => ({
  default: ({ children, ...props }: React.ComponentProps<"script">) => (
    <script {...props}>{children}</script>
  ),
}));

describe("analytics consent", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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

  it("stays safely disabled when no GA4 measurement ID is configured", async () => {
    const user = userEvent.setup();
    const { container } = render(<AnalyticsConsent />);

    await user.click(
      await screen.findByRole("button", { name: "Allow analytics" }),
    );

    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(container.querySelector("script")).toBeNull();
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
