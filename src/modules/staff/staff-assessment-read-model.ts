import { z } from "zod";
import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";

export type StaffFeasibilityState =
  PersistedAssessmentSubmission["report"]["feasibilityState"];

export const staffFeasibilityLabels: Record<
  StaffFeasibilityState,
  "No Warning" | "Needs Checking" | "Blocked"
> = {
  no_warning: "No Warning",
  needs_checking: "Needs Checking",
  blocked: "Blocked",
};

const staffDeliveryStateSchema = z.enum([
  "pending",
  "sending",
  "sent",
  "failed",
]);

export type StaffDeliveryState = z.infer<typeof staffDeliveryStateSchema>;

export function parseStaffDeliveryState(input: unknown): StaffDeliveryState {
  return staffDeliveryStateSchema.parse(input);
}

export type StaffAssessmentSummary = {
  id: string;
  reference: string;
  homeownerName: string;
  homeownerAddress: string;
  desiredTiming: PersistedAssessmentSubmission["homeowner"]["desiredTiming"];
  feasibilityState: StaffFeasibilityState;
  createdAt: Date;
  poolLayout: Pick<
    PersistedAssessmentSubmission["poolLayout"],
    "lengthMetres" | "widthMetres" | "rotationDegrees"
  >;
  evidenceCount: number;
};

export type StaffAssessmentRecord = {
  id: string;
  reference: string;
  status: string;
  homeownerName: string;
  homeownerPhone: string;
  homeownerEmail: string;
  homeownerAddress: string;
  visitorType: PersistedAssessmentSubmission["homeowner"]["visitorType"] | null;
  visitorTypeOtherDetail: string | null;
  desiredTiming: PersistedAssessmentSubmission["homeowner"]["desiredTiming"];
  desiredTimingOtherDetail: string | null;
  additionalInfo: string | null;
  boundaryStatus: PersistedAssessmentSubmission["addressEvidence"]["boundaryStatus"];
  feasibilityState: StaffFeasibilityState;
  emailDeliveryState: StaffDeliveryState;
  forwardingState: StaffDeliveryState;
  createdAt: Date;
};

export type StaffAssessmentDetail = StaffAssessmentRecord & {
  report: SavedPreliminaryReport;
};
