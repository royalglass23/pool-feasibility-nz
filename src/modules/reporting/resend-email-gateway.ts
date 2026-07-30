export type ReportEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: Buffer;
  filename: string;
  idempotencyKey: string;
};

export type ConfiguredResendEmailInput = ReportEmailInput & {
  apiKey: string;
};

export type ReportEmailResult = { id: string };

export class ReportEmailDeliveryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ReportEmailDeliveryError";
    this.code = code;
  }
}

export async function sendResendEmail(
  input: ConfiguredResendEmailInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ReportEmailResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImplementation(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          from: input.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: [
            {
              content: input.attachment.toString("base64"),
              filename: input.filename,
            },
          ],
        }),
        signal: controller.signal,
      },
    );
    const responseBody = (await response.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
    } | null;
    if (!response.ok || typeof responseBody?.id !== "string") {
      const providerCode =
        typeof responseBody?.name === "string"
          ? responseBody.name
          : `HTTP_${response.status}`;
      throw new ReportEmailDeliveryError(
        `RESEND_${providerCode.toUpperCase()}`,
      );
    }
    return { id: responseBody.id };
  } catch (error) {
    if (error instanceof ReportEmailDeliveryError) throw error;
    if (controller.signal.aborted) {
      throw new ReportEmailDeliveryError("RESEND_TIMEOUT");
    }
    throw new ReportEmailDeliveryError("RESEND_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}
