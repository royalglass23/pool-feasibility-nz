import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ContactEnquiryForm } from "@/components/contact-enquiry-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("lets a partner enquire without a message and preserves the submission on retry", async () => {
  const user = userEvent.setup();
  const send = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Please try again shortly." } }),
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ sent: true }), { status: 202 }),
    );
  vi.stubGlobal("fetch", send);
  render(<ContactEnquiryForm purpose="partnership" />);
  await user.type(screen.getByLabelText("Your name"), "Casey Visitor");
  await user.type(screen.getByLabelText("Company"), "Example Pools");
  await user.type(screen.getByLabelText("Work email"), "casey@example.com");
  await user.click(
    screen.getByRole("button", { name: "Register your interest" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again shortly.",
  );
  expect(screen.getByLabelText("Company")).toHaveValue("Example Pools");
  await user.click(
    screen.getByRole("button", { name: "Register your interest" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "Thanks — your partnership enquiry has been sent.",
    ),
  );
  const first = JSON.parse(send.mock.calls[0]![1].body);
  const retry = JSON.parse(send.mock.calls[1]![1].body);
  expect(first).toMatchObject({
    purpose: "partnership",
    company: "Example Pools",
    message: "",
  });
  expect(retry.idempotencyKey).toBe(first.idempotencyKey);
});
