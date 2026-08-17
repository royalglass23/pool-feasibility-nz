export const POOL_SHELL_CLEARANCE_LIMITATION =
  "Indicative mapped pool-shell clearances — not a survey or setback assessment.";

export const PRELIMINARY_FEASIBILITY_SCOPE =
  "This is an indicative desktop screen based on mapped information. Confirm the boundary, site conditions, services, design and approvals before relying on it.";

export const PRELIMINARY_FEASIBILITY_REPORT_SCOPE =
  "This preliminary feasibility report is an indicative desktop screen based on available mapped information. The proposed pool position and clearances are not a survey, title confirmation, detailed design, utility locate, consent decision or construction approval. Confirm the boundary and complete normal site, service, design and approval checks before relying on this report.";

export const PRELIMINARY_FEASIBILITY_REPORT_FOOTER =
  "Preliminary Feasibility Report — indicative desktop screening";

type ReportEvidenceSource = {
  dataset: string;
  queryStatus?: "success" | "empty" | "unavailable" | "error";
};

export function preliminaryEvidenceActions(input: {
  boundaryStatus: string;
  sources: readonly ReportEvidenceSource[];
}): string[] {
  const actions: string[] = [];

  if (input.boundaryStatus === "provisional") {
    actions.push(
      "Boundary source: provisional. Confirm boundary/title before design.",
    );
  } else if (input.boundaryStatus === "multiple") {
    actions.push(
      "Boundary source: multiple mapped parcels. Confirm the correct boundary/title before design.",
    );
  } else if (input.boundaryStatus === "unavailable") {
    actions.push(
      "Boundary source unavailable. Confirm the property boundary/title before design.",
    );
  }

  for (const source of input.sources) {
    if (source.queryStatus === "unavailable") {
      actions.push(`${source.dataset} layer unavailable for this check; it was not assessed.`);
    } else if (source.queryStatus === "error") {
      actions.push(`${source.dataset} service did not return a result; it was not assessed.`);
    } else if (source.queryStatus === "empty") {
      actions.push(
        `No ${source.dataset} feature was returned by this mapped-data query; this does not confirm that none are present.`,
      );
    }
  }

  return actions;
}
