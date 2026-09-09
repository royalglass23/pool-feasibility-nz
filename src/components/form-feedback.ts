export function friendlyFieldError(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): string {
  const issue = issues[0];
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
  const label = labels[String(issue?.path[0])];
  if (!label) return "Please check your details and try again.";
  const message =
    issue.message.startsWith("Please ") ||
    issue.message.startsWith("Enter a valid NZ")
      ? issue.message
      : "Please check this field and try again.";
  return `${label}: ${message}`;
}

export function friendlyRequestError(
  status: number,
  action: "send your message" | "save your report",
) {
  if (status === 429)
    return "You've tried a few times. Please wait a moment before trying again.";
  if (status === 400 || status === 413)
    return "Please check your details and try again.";
  return `We couldn't ${action} just now. Your details are still here. Please try again shortly.`;
}
