import type { ClientApiError } from "@/shared/http/client-api-error";
import { withErrorReference } from "@/shared/http/client-api-error";

export function friendlyFieldError(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): string {
  const issue = issues[0];
  const label = fieldLabel(issue);
  if (!label) return "Please check your details and try again.";
  return `${label}: ${friendlyIssueMessage(issue)}`;
}

export function friendlyFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  return issues.reduce<Record<string, string>>((errors, issue) => {
    const field = String(issue.path[0] ?? "");
    if (field && !errors[field]) errors[field] = friendlyIssueMessage(issue);
    return errors;
  }, {});
}

function fieldLabel(
  issue: { path: ReadonlyArray<PropertyKey> } | undefined,
): string | undefined {
  const labels: Record<string, string> = {
    name: "Name",
    email: "Email",
    company: "Company",
    message: "Message",
    phone: "Phone",
    additionalInfo: "Additional information",
    visitorTypeOtherDetail: "Who you are",
    desiredTimingOtherDetail: "When you need it",
    visitorType: "Who you are",
    desiredTiming: "When you need it",
    consentGiven: "Consent",
  };
  return labels[String(issue?.path[0])];
}

function friendlyIssueMessage(issue: { message: string } | undefined): string {
  return issue?.message.startsWith("Please ") ||
    issue?.message.startsWith("Enter a valid NZ")
    ? issue.message
    : "Please check this field and try again.";
}

export function friendlyRequestError(
  status: number,
  action: "send your message" | "save your report",
  error?: ClientApiError | null,
) {
  if (status === 429)
    return withErrorReference(
      "You've tried a few times. Please wait a moment before trying again.",
      error,
    );
  if (status === 400 || status === 413)
    return "Please check your details and try again.";
  if (error?.code === "RATE_LIMIT_UNAVAILABLE")
    return withErrorReference(
      "We couldn't verify the request limit just now. Your details are still here. Please try again shortly.",
      error,
    );
  return withErrorReference(
    `We couldn't ${action} just now. Your details are still here. Please try again shortly.`,
    error,
  );
}
