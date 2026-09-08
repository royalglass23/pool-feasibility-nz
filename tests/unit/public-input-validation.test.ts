import { afterEach, expect, it, vi } from "vitest";
import { contactRequestSchema } from "@/modules/contact/contact-fields";
import { homeownerContactSchema } from "@/modules/assessment/homeowner-contact";
vi.mock("server-only", () => ({}));
import { handleContactRequest } from "@/modules/contact/contact-request";

afterEach(() => vi.unstubAllEnvs());
const contact = {
  name: "Hēmi O’Connor",
  email: "hemi@example.com",
  message: "Can you help with a 3m & 4m pool?",
  idempotencyKey: "8f4144e8-2b28-4fd5-b0d4-9d2b5ca707b4",
};
const homeowner = {
  name: contact.name,
  email: contact.email,
  phone: "0211234567",
  visitorType: "homeowner",
  desiredTiming: "asap",
  consentGiven: true,
};

it.each(["name", "email", "message", "website", "company"])(
  "rejects control characters in contact %s at the API",
  async (field) => {
    const send = vi.fn();
    const response = await handleContactRequest(
      new Request("https://test.example/api/public/contact", {
        method: "POST",
        body: JSON.stringify({
          ...contact,
          purpose: "partnership",
          company: "Example Pools",
          [field]: "bad\u0000input",
        }),
      }),
      { send },
    );
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  },
);

it.each([
  "name",
  "email",
  "additionalInfo",
  "visitorTypeOtherDetail",
  "desiredTimingOtherDetail",
  "phone",
])("rejects control characters in report %s", (field) => {
  expect(
    homeownerContactSchema.safeParse({
      ...homeowner,
      [field]: "bad\u0000input",
    }).success,
  ).toBe(false);
});

it("retains safe Unicode and encodes script-shaped text in every enquiry email field", async () => {
  vi.stubEnv("CONTACT_DELIVERY_MODE", "production");
  const payload = '<img src=x onerror="alert(1)">';
  const send = vi.fn().mockResolvedValue({ id: "test-only" });
  const response = await handleContactRequest(
    new Request("https://test.example/api/public/contact", {
      method: "POST",
      body: JSON.stringify({
        ...contact,
        purpose: "partnership",
        company: payload,
        name: payload,
        message: payload,
      }),
    }),
    { send, apiKey: "test-only", from: "test@example.com" },
  );
  expect(response.status).toBe(202);
  expect(send.mock.calls[0][0].html).not.toContain(payload);
  expect(send.mock.calls[0][0].html.match(/&lt;img/g)).toHaveLength(3);
  expect(contactRequestSchema.parse(contact).name).toBe(contact.name);
});

it("rejects unknown fields, invalid selections and missing consent", () => {
  expect(
    contactRequestSchema.safeParse({ ...contact, admin: true }).success,
  ).toBe(false);
  expect(
    homeownerContactSchema.safeParse({ ...homeowner, visitorType: "admin" })
      .success,
  ).toBe(false);
  expect(
    homeownerContactSchema.safeParse({
      ...homeowner,
      desiredTiming: "arbitrary",
    }).success,
  ).toBe(false);
  expect(
    homeownerContactSchema.safeParse({ ...homeowner, consentGiven: false })
      .success,
  ).toBe(false);
});
