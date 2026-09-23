import type { ReportAudience } from "@/modules/assessment/report-audience";
import {
  REPORT_ASSESSMENT_ORDER,
  type ReportAssessmentId,
} from "@/modules/reporting/pool-feasibility-report";

const HOMEOWNER_REPORT_ASSESSMENT_IDS = [
  "pool_fit",
  "water_wastewater",
  "stormwater",
  "flooding_drainage",
  "electricity",
  "gas",
  "terrain",
  "planning",
] as const satisfies readonly ReportAssessmentId[];

const HOMEOWNER_BUILDER_CONFIRMATION_ITEMS = [
  "Final pool model, depth and installation requirements",
  "Site access and excavation method",
  "Ground levels, drainage, retaining and support",
  "Underground services and mapped boundaries",
  "Pool-barrier design, nearby features and approval requirements",
] as const;

export function reportWebAudiencePresentation(audience: ReportAudience) {
  if (audience === "pool_builder") {
    return {
      assessmentIds: REPORT_ASSESSMENT_ORDER,
      showTechnicalConstructability: true,
      showDetailedSources: true,
      builderConfirmationItems: [],
      onsiteNextStep: null,
    } as const;
  }

  return {
    assessmentIds: HOMEOWNER_REPORT_ASSESSMENT_IDS,
    showTechnicalConstructability: false,
    showDetailedSources: false,
    builderConfirmationItems: HOMEOWNER_BUILDER_CONFIRMATION_ITEMS,
    onsiteNextStep: {
      action: "Arrange an onsite visit with a pool builder.",
      explanation:
        "Share this report and ask the builder to inspect the property and confirm the proposed pool position, construction access, ground and excavation conditions, underground services, final depth and pool-barrier requirements before design or pricing. PoolReady does not arrange, assign, introduce or book a builder.",
    },
  } as const;
}
