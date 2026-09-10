import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ContactEnquiryForm } from "@/components/contact-enquiry-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps labels connected to the correct fields when two contact forms are rendered", () => {
  render(
    <>
      <ContactEnquiryForm />
      <ContactEnquiryForm purpose="partnership" />
    </>,
  );

  expect(screen.getByLabelText("Name").id).not.toBe(
    screen.getByLabelText("Your name").id,
  );
  expect(screen.getByLabelText("Email").id).not.toBe(
    screen.getByLabelText("Work email").id,
  );
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

it("explains invalid names without technical wording and accepts a corrected name", async () => {
  const user = userEvent.setup();
  const send = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ sent: true }), { status: 202 }),
    );
  vi.stubGlobal("fetch", send);
  render(<ContactEnquiryForm />);
  await user.type(screen.getByLabelText("Name"), "#$%");
  await user.type(screen.getByLabelText("Email"), "test@example.com");
  await user.type(
    screen.getByLabelText("How can we help?"),
    "Please help with our pool.",
  );
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Please use letters");
  expect(screen.getByRole("alert")).toHaveAttribute(
    "data-slot",
    "field-validation-message",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("control characters");
  expect(send).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "Hēmi O’Connor");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "message has been sent",
  );
});

it("points partnership character errors to company, email, and business details", async () => {
  const user = userEvent.setup();
  const send = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ sent: true }), { status: 202 }),
    );
  vi.stubGlobal("fetch", send);
  render(<ContactEnquiryForm purpose="partnership" />);

  await user.type(screen.getByLabelText("Your name"), "Casey Visitor");
  fireEvent.input(screen.getByLabelText("Company"), {
    target: { value: "Example[Pools" },
  });
  await user.type(screen.getByLabelText("Work email"), "[sql]@email.com");
  await user.type(
    screen.getByLabelText("Tell us about your business (optional)"),
    "SELECT * FROM businesses;",
  );
  await user.click(
    screen.getByRole("button", { name: "Register your interest" }),
  );

  for (const field of [
    screen.getByLabelText("Company"),
    screen.getByLabelText("Work email"),
    screen.getByLabelText("Tell us about your business (optional)"),
  ]) {
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription();
  }
  expect(screen.getByLabelText("Work email")).toHaveFocus();
  expect(send).not.toHaveBeenCalled();
});

it("shows the conversation-character error directly below How can we help", async () => {
  const user = userEvent.setup();
  render(<ContactEnquiryForm />);
  await user.type(screen.getByLabelText("Name"), "Casey Visitor");
  await user.type(screen.getByLabelText("Email"), "casey@example.com");
  const message = screen.getByLabelText("How can we help?");
  await user.type(message, "SELECT * FROM users;");
  await user.click(screen.getByRole("button", { name: "Send message" }));

  expect(message).toHaveAttribute("aria-invalid", "true");
  expect(message).toHaveAccessibleDescription(
    "Please use plain text and common punctuation only.",
  );
  expect(message).toHaveFocus();
});
