export class SessionReportValidationError extends Error {
  constructor(readonly code: "INVALID_REPORT" | "INVALID_MAP_IMAGE") {
    super(code);
    this.name = "SessionReportValidationError";
  }
}

export class ReportRendererBusyError extends Error {
  constructor() {
    super("REPORT_RENDERER_BUSY");
    this.name = "ReportRendererBusyError";
  }
}

export class ReportRendererTimeoutError extends Error {
  constructor() {
    super("REPORT_RENDERER_TIMEOUT");
    this.name = "ReportRendererTimeoutError";
  }
}
