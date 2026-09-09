import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => vi.unstubAllEnvs());

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
        message: "Could you help with a pool & landscaping?",
      }),
      dependencies,
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ sent: true });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "support@bluehaven.nz",
        replyTo: "casey@example.com",
        subject: "[PoolReady] General enquiry",
        idempotencyKey: `contact-form/${validRequest.idempotencyKey}`,
      }),
    );
    expect(send.mock.calls[0]![0].html).toContain("pool &amp; landscaping");
    expect(send.mock.calls[0]![0].html).not.toContain("<script>");
  });

  it("delivers a Founding Partner enquiry with its company and a distinct subject", async () => {
    const send = vi.fn().mockResolvedValue({ id: "partner-email" });
    const response = await handleContactRequest(
      request({
        ...validRequest,
        purpose: "partnership",
        company: "Example Pools & Landscaping",
        message: "",
      }),
      { apiKey: "re_test", from: "PoolReady <sender@example.com>", send },
    );

    expect(response.status).toBe(202);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "PoolReady <sender@example.com>",
        to: "support@bluehaven.nz",
        replyTo: "casey@example.com",
        subject: "[PoolReady] Founding Partner enquiry",
        idempotencyKey: `partnership-form/${validRequest.idempotencyKey}`,
      }),
    );
    expect(send.mock.calls[0]![0].text).toContain(
      "Company: Example Pools & Landscaping",
    );
    expect(send.mock.calls[0]![0].html).toContain(
      "Example Pools &amp; Landscaping",
    );
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

  it.each([
    { purpose: "partnership", company: "" },
    { purpose: "partnership", company: " ", message: "" },
    { purpose: "partnership", company: "x".repeat(161) },
    { purpose: "unknown" },
    { to: "other@example.com" },
    { subject: "Override subject" },
    { purpose: "general", message: "" },
    { purpose: "partnership", company: "Example", message: "x".repeat(2_001) },
  ])("rejects invalid or delivery-overriding fields: %j", async (fields) => {
    const send = vi.fn();
    const response = await handleContactRequest(
      request({ ...validRequest, ...fields }),
      { apiKey: "re_test", from: "sender@example.com", send },
    );
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("returns a safe rejection when the request body cannot be read", async () => {
    const brokenRequest = request(validRequest);
    await brokenRequest.text();
    const send = vi.fn();
    const response = await handleContactRequest(brokenRequest, {
      apiKey: "re_test",
      from: "sender@example.com",
      send,
    });
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

  it("bounds oversized partner requests before sending", async () => {
    const send = vi.fn();
    const response = await handleContactRequest(
      request({
        ...validRequest,
        purpose: "partnership",
        company: "Example Pools",
        message: "x".repeat(17_000),
      }),
      { apiKey: "re_test", from: "sender@example.com", send },
    );
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts partner enquiries in the local synthetic sink without delivery", async () => {
    vi.stubEnv("CONTACT_DELIVERY_MODE", "synthetic_test");
    vi.stubEnv("VERCEL_ENV", "");
    const send = vi.fn();
    const response = await handleContactRequest(
      request({
        ...validRequest,
        purpose: "partnership",
        company: "Example Pools",
      }),
      { apiKey: "re_test", from: "sender@example.com", send },
    );
    expect(response.status).toBe(202);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects synthetic partnership delivery in production", async () => {
    vi.stubEnv("CONTACT_DELIVERY_MODE", "synthetic_test");
    vi.stubEnv("VERCEL_ENV", "production");
    const send = vi.fn();
    const response = await handleContactRequest(
      request({
        ...validRequest,
        purpose: "partnership",
        company: "Example Pools",
      }),
      { apiKey: "re_test", from: "sender@example.com", send },
    );
    expect(response.status).toBe(503);
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
