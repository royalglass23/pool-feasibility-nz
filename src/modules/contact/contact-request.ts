import "server-only";

import pino from "pino";
import { z } from "zod";
import { env } from "@/env";
import {
  ReportEmailDeliveryError,
  sendResendEmail,
  type ReportEmailInput,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import { resolveContactDeliveryPolicy } from "./contact-delivery-policy";

const MAX_BODY_BYTES = 16_000;
const SUPPORT_EMAIL = "support@royalglass.co.nz";
const logger = pino({ base: undefined });

const contactRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(320),
    message: z.string().trim().min(10).max(2_000),
    idempotencyKey: z.uuid(),
    website: z.string().max(2_000).optional(),
  })
  .strict();

type ContactRequest = z.infer<typeof contactRequestSchema>;

export type ContactRequestDependencies = {
  apiKey?: string;
  from?: string;
  send?: (input: ReportEmailInput) => Promise<ReportEmailResult>;
};

export async function handleContactRequest(
  request: Request,
  dependencies: ContactRequestDependencies = {},
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    return invalidRequestResponse(correlationId);
  }

  let input: ContactRequest;
  try {
    input = contactRequestSchema.parse(
      JSON.parse(new TextDecoder().decode(body)),
    );
  } catch {
    return invalidRequestResponse(correlationId);
  }

  // Honeypot submissions are treated as accepted without calling the mail provider.
  if (input.website) return acceptedResponse(correlationId);

  let deliveryMode: "synthetic_test" | "production";
  try {
    deliveryMode = resolveContactDeliveryPolicy({
      mode: process.env.CONTACT_DELIVERY_MODE,
      vercelEnvironment: process.env.VERCEL_ENV,
      nodeEnvironment: process.env.NODE_ENV,
    }).mode;
  } catch {
    logger.error({
      event: "contact_form_email",
      outcome: "unavailable",
      reason: "delivery_mode_disabled",
      correlationId,
    });
    return unavailableResponse(correlationId);
  }

  if (deliveryMode === "synthetic_test") {
    logger.info({
      event: "contact_form_email",
      outcome: "synthetic_test",
      correlationId,
    });
    return acceptedResponse(correlationId);
  }

  const apiKey = dependencies.apiKey ?? env.RESEND_API_KEY;
  const from = dependencies.from ?? env.REPORT_FROM_EMAIL;
  if (!apiKey || !from) {
    logger.error({
      event: "contact_form_email",
      outcome: "unavailable",
      correlationId,
    });
    return unavailableResponse(correlationId);
  }

  try {
    const send =
      dependencies.send ??
      ((email: ReportEmailInput) => sendResendEmail({ ...email, apiKey }));
    await send(emailForContactRequest(input, from));
    logger.info({
      event: "contact_form_email",
      outcome: "sent",
      correlationId,
    });
    return acceptedResponse(correlationId);
  } catch (error) {
    logger.error({
      event: "contact_form_email",
      outcome: "failed",
      reason:
        error instanceof ReportEmailDeliveryError
          ? error.code
          : "delivery_failed",
      correlationId,
    });
    return unavailableResponse(correlationId);
  }
}

function emailForContactRequest(
  input: ContactRequest,
  from: string,
): ReportEmailInput {
  return {
    from,
    to: SUPPORT_EMAIL,
    replyTo: input.email,
    subject: "New PoolReady contact enquiry",
    text: [
      "New PoolReady contact enquiry",
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      "",
      "Message:",
      input.message,
    ].join("\n"),
    html: `<h1>New PoolReady contact enquiry</h1><p><strong>Name:</strong> ${escapeHtml(input.name)}</p><p><strong>Email:</strong> ${escapeHtml(input.email)}</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    idempotencyKey: `contact-form/${input.idempotencyKey}`,
  };
}

function invalidRequestResponse(correlationId: string) {
  return apiErrorResponse(
    {
      code: "INVALID_REQUEST",
      message: "Enter your name, email address, and a short message.",
    },
    400,
    correlationId,
    { "Cache-Control": "no-store" },
  );
}

function unavailableResponse(correlationId: string) {
  return apiErrorResponse(
    {
      code: "CONTACT_UNAVAILABLE",
      message: "We could not send your message. Please try again shortly.",
    },
    503,
    correlationId,
    { "Cache-Control": "no-store" },
  );
}

function acceptedResponse(correlationId: string) {
  return apiJsonResponse({ sent: true }, 202, correlationId, {
    "Cache-Control": "no-store",
  });
}
