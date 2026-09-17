import type { ClientApiError } from "@/shared/http/client-api-error";

export function friendlyFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  return issues.reduce<Record<string, string>>((errors, issue) => {
    const field = String(issue.path[0] ?? "");
    if (field && !errors[field]) errors[field] = friendlyIssueMessage(issue);
    return errors;
  }, {});
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
    return "You've tried a few times. Please wait a moment before trying again.";
  if (status === 400 || status === 413)
    return "Please check your details and try again.";
  if (error?.code === "RATE_LIMIT_UNAVAILABLE")
    return "We couldn't verify the request limit just now. Your details are still here. Please try again shortly.";
  return `We couldn't ${action} just now. Your details are still here. Please try again shortly.`;
}
