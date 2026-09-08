import "server-only";

import pino from "pino";
import { contactRequestSchema, type ContactRequest } from "./contact-fields";
import { env } from "@/env";
import {
  ReportEmailDeliveryError,
  sendResendEmail,
  type ReportEmailInput,
  type ReportEmailResult,
} from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";
import { readRequestBytesWithinLimit } from "@/shared/http/provider-runtime";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import { resolveContactDeliveryPolicy } from "./contact-delivery-policy";

const MAX_BODY_BYTES = 16_000;
const SUPPORT_EMAIL = "support@bluehaven.nz";
const logger = pino({ base: undefined });

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
  let input: ContactRequest;
  try {
    const body = await readRequestBytesWithinLimit(request, MAX_BODY_BYTES);
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
  const partnership = input.purpose === "partnership";
  const subject = partnership
    ? "[PoolReady] Founding Partner enquiry"
    : "[PoolReady] General enquiry";
  const fields: [string, string][] = [
    ["Name", input.name],
    ...(partnership ? [["Company", input.company] as [string, string]] : []),
    ["Email", input.email],
    ["Message", input.message || "Not provided"],
  ];
  return {
    from,
    to: SUPPORT_EMAIL,
    replyTo: input.email,
    subject,
    text: [
      subject,
      "",
      ...fields.map(([label, value]) => `${label}: ${value}`),
      "",
      "PoolReady powered by BlueHaven",
    ].join("\n"),
    html: `<h1>${subject}</h1>${fields.map(([label, value]) => `<p style="white-space:pre-wrap"><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}<p><a href="https://www.poolready.co.nz/">PoolReady</a> powered by <a href="https://www.bluehaven.nz/">BlueHaven</a></p>`,
    idempotencyKey: `${partnership ? "partnership" : "contact"}-form/${input.idempotencyKey}`,
  };
}

function invalidRequestResponse(correlationId: string) {
  return apiErrorResponse(
    {
      code: "INVALID_REQUEST",
      message: "Check the required fields and enter a valid email address.",
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
