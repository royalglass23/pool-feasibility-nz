import type { ReportEmailInput } from "@/modules/reporting/resend-email-gateway";
import { escapeHtml } from "@/shared/html/escape-html";

const MAX_COMPLETED_REFRESH_AGE_MS = 48 * 60 * 60 * 1_000;
const MAX_RUNNING_REFRESH_AGE_MS = 36 * 60 * 60 * 1_000;
const STORAGE_ALERT_PERCENT = 80;
const SUPPORT_EMAIL = "support@bluehaven.nz";

export type LinzAddressHealthIssueCode =
  | "LINZ_INDEX_STALE"
  | "LINZ_REFRESH_STUCK"
  | "LINZ_REFRESH_ERROR"
  | "DATABASE_STORAGE_HIGH";

export type LinzAddressHealthIssue = {
  code: LinzAddressHealthIssueCode;
  message: string;
};

export type LinzAddressHealthInput = {
  checkedAt: Date;
  latestCompletedAt: Date | null;
  latestRun: {
    status: string;
    startedAt: Date;
    errorCode: string | null;
  } | null;
  databaseBytes: number;
  storageLimitBytes: number | null;
};

export type LinzAddressHealthReport = LinzAddressHealthInput & {
  status: "healthy" | "needs_attention";
  storageUsedPercent: number | null;
  issues: LinzAddressHealthIssue[];
};

export function evaluateLinzAddressHealth(
  input: LinzAddressHealthInput,
): LinzAddressHealthReport {
  const issues: LinzAddressHealthIssue[] = [];
  if (
    !input.latestCompletedAt ||
    input.checkedAt.getTime() - input.latestCompletedAt.getTime() >
      MAX_COMPLETED_REFRESH_AGE_MS
  ) {
    issues.push({
      code: "LINZ_INDEX_STALE",
      message:
        "No LINZ address refresh has completed within the last 48 hours.",
    });
  }

  if (
    input.latestRun?.status === "running" &&
    input.checkedAt.getTime() - input.latestRun.startedAt.getTime() >
      MAX_RUNNING_REFRESH_AGE_MS
  ) {
    issues.push({
      code: "LINZ_REFRESH_STUCK",
      message:
        "The current LINZ address refresh has been running for more than 36 hours.",
    });
  }

  if (input.latestRun?.errorCode) {
    issues.push({
      code: "LINZ_REFRESH_ERROR",
      message: `The latest LINZ refresh recorded ${input.latestRun.errorCode}.`,
    });
  }

  const storageUsedPercent = input.storageLimitBytes
    ? (input.databaseBytes / input.storageLimitBytes) * 100
    : null;
  if (
    storageUsedPercent !== null &&
    storageUsedPercent >= STORAGE_ALERT_PERCENT
  ) {
    issues.push({
      code: "DATABASE_STORAGE_HIGH",
      message: `Database storage is ${storageUsedPercent.toFixed(2)}% of the configured limit.`,
    });
  }

  return {
    ...input,
    status: issues.length === 0 ? "healthy" : "needs_attention",
    storageUsedPercent,
    issues,
  };
}

export function linzAddressHealthAlertEmail(
  report: LinzAddressHealthReport,
  from: string,
): ReportEmailInput {
  const issueLines = report.issues.map(
    (issue) => `- ${issue.code}: ${issue.message}`,
  );
  const details = [
    `Checked: ${report.checkedAt.toISOString()}`,
    `Latest completed refresh: ${report.latestCompletedAt?.toISOString() ?? "none"}`,
    `Latest run status: ${report.latestRun?.status ?? "none"}`,
    `Database size: ${formatBytes(report.databaseBytes)}`,
    `Configured storage limit: ${report.storageLimitBytes ? formatBytes(report.storageLimitBytes) : "not configured"}`,
    `Storage used: ${report.storageUsedPercent?.toFixed(2) ?? "not configured"}%`,
  ];
  const idempotencyIssueKey = report.issues
    .map((issue) => issue.code.toLowerCase())
    .sort()
    .join("-");

  return {
    from,
    to: SUPPORT_EMAIL,
    subject: "[PoolReady] LINZ address index needs attention",
    text: [
      "PoolReady LINZ address monitoring found an issue.",
      "",
      ...issueLines,
      "",
      ...details,
    ].join("\n"),
    html: [
      "<h1>PoolReady LINZ address index needs attention</h1>",
      `<ul>${report.issues.map((issue) => `<li><strong>${escapeHtml(issue.code)}</strong>: ${escapeHtml(issue.message)}</li>`).join("")}</ul>`,
      `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`,
    ].join(""),
    idempotencyKey: `linz-address-health/${report.checkedAt.toISOString().slice(0, 10)}/${idempotencyIssueKey}`,
  };
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
