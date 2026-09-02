import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FooterContactDialog } from "@/components/footer-contact-dialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("footer contact dialog", () => {
  it("opens a neutral contact form and keeps the privacy notice in a new tab", async () => {
    const user = userEvent.setup();
    render(<FooterContactDialog />);

    expect(screen.getByRole("button", { name: "Contact us" })).toBeVisible();
    expect(screen.queryByLabelText("How can we help?")).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Contact us" }));

    expect(screen.getByRole("heading", { name: "Contact us" })).toBeVisible();
    expect(screen.getByLabelText("Name")).toBeVisible();
    const privacy = screen.getByRole("link", { name: "privacy notice" });
    expect(privacy).toHaveAttribute("href", "/privacy");
    expect(privacy).toHaveAttribute("target", "_blank");
    expect(screen.queryByText(/Royal Glass/i)).not.toBeInTheDocument();
  });

  it("opens from a #contact link and removes the fragment when closed", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/#contact");
    render(<FooterContactDialog />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Contact us" })).toBeVisible(),
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(window.location.hash).toBe("");
  });

  it("submits only the three contact fields and confirms delivery", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sent: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<FooterContactDialog />);

    await user.click(screen.getByRole("button", { name: "Contact us" }));
    await user.type(screen.getByLabelText("Name"), "Casey Visitor");
    await user.type(screen.getByLabelText("Email"), "casey@example.com");
    await user.type(
      screen.getByLabelText("How can we help?"),
      "Could you help me understand the next step?",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(
        screen.getByText("Thanks — your message has been sent."),
      ).toBeVisible(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/contact",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
