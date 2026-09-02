export const POOL_SHELL_CLEARANCE_LIMITATION =
  "Indicative mapped pool-shell clearances — not a survey or setback assessment.";

export const PRELIMINARY_FEASIBILITY_SCOPE =
  "This is an indicative desktop screen based on mapped information. Confirm the boundary, site conditions, services, design and approvals before relying on it.";

export const PRELIMINARY_FEASIBILITY_REPORT_SCOPE =
  "This preliminary feasibility report is an indicative desktop screen based on available mapped information. The proposed pool position and clearances are not a survey, title confirmation, detailed design, utility locate, consent decision or construction approval. Confirm the boundary and complete normal site, service, design and approval checks before relying on this report.";

export const PRELIMINARY_FEASIBILITY_REPORT_FOOTER =
  "Preliminary Feasibility Report — indicative desktop screening";

export const PRELIMINARY_FEASIBILITY_READING_GUIDE = {
  title: "How this assessment works",
  summary:
    "This is an early mapped view of the proposed pool location. It helps you discuss space, possible constraints and the next questions before treating the layout as a construction solution.",
  workflow: [
    {
      title: "Start with your property",
      summary:
        "You choose the address, pool size and position that you want to explore.",
    },
    {
      title: "Check the mapped evidence",
      summary:
        "The app compares that layout with the saved property boundary and available mapped layers.",
    },
    {
      title: "Plan the right next step",
      summary:
        "Use the result to decide what should be checked on site, designed or confirmed next.",
    },
  ],
  statusTitle: "What the results mean",
  statuses: [
    {
      status: "green",
      title: "Appears suitable",
      summary:
        "No major mapped constraint was found for the selected layout. Normal site, design and approval checks still apply.",
    },
    {
      status: "amber",
      title: "Further investigation required",
      summary:
        "A mapped condition, incomplete evidence or design item needs confirming. This is not automatically a no.",
    },
    {
      status: "red",
      title: "Potential constraint",
      summary:
        "A mapped issue may affect the selected position. Review or reposition the pool before progressing.",
    },
    {
      status: "unknown",
      title: "Not assessed",
      summary:
        "The required mapped information was not available, so this report cannot draw a conclusion.",
    },
  ],
} as const;
