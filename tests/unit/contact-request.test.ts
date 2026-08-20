import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  handleContactRequest,
  type ContactRequestDependencies,
} from "@/modules/contact/contact-request";

const validRequest = {
  name: "Casey Visitor",
  email: "casey@example.com",
  message: "Could you help me understand the next step?",
  idempotencyKey: "0a2ed00c-7b5d-4f5d-9fa9-09e231d6f179",
};

function request(body: unknown) {
  return new Request("https://pool.example/api/public/contact", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("contact requests", () => {
  it("sends only the contact fields to the support inbox with a reply-to address", async () => {
    const send = vi.fn().mockResolvedValue({ id: "resend-message-1" });
    const dependencies: ContactRequestDependencies = {
      apiKey: "re_test_contact_key",
      from: "PoolReady <hello@example.com>",
      send,
    };

    const response = await handleContactRequest(
      request({
        ...validRequest,
        message: "<script>alert(1)</script> Enough text.",
      }),
      dependencies,
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ sent: true });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "support@royalglass.co.nz",
        replyTo: "casey@example.com",
        subject: "New PoolReady contact enquiry",
        idempotencyKey: `contact-form/${validRequest.idempotencyKey}`,
      }),
    );
    expect(send.mock.calls[0]![0].html).toContain("&lt;script&gt;");
    expect(send.mock.calls[0]![0].html).not.toContain("<script>");
  });

  it("rejects malformed contact fields without calling delivery", async () => {
    const send = vi.fn();
    const response = await handleContactRequest(
      request({ ...validRequest, email: "not-an-email" }),
      { apiKey: "re_test_contact_key", from: "sender@example.com", send },
    );

    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("silently accepts a honeypot submission without sending an email", async () => {
    const send = vi.fn();
    const response = await handleContactRequest(
      request({ ...validRequest, website: "https://bot.example" }),
      { apiKey: "re_test_contact_key", from: "sender@example.com", send },
    );

    expect(response.status).toBe(202);
    expect(send).not.toHaveBeenCalled();
  });

  it("returns a generic unavailable response when delivery fails", async () => {
    const response = await handleContactRequest(request(validRequest), {
      apiKey: "re_test_contact_key",
      from: "sender@example.com",
      send: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "CONTACT_UNAVAILABLE" },
    });
  });
});
