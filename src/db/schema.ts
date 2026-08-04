import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";

export const homeownerAssessments = pgTable(
  "homeowner_assessments",
  {
    id: uuid("id").primaryKey(),
    reference: text("reference").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("new_enquiry"),
    homeownerName: text("homeowner_name").notNull(),
    homeownerPhone: text("homeowner_phone").notNull(),
    homeownerEmail: text("homeowner_email").notNull(),
    homeownerAddress: text("homeowner_address").notNull(),
    visitorType: text("visitor_type"),
    visitorTypeOtherDetail: text("visitor_type_other_detail"),
    desiredTiming: text("desired_timing").notNull(),
    desiredTimingOtherDetail: text("desired_timing_other_detail"),
    additionalInfo: text("additional_info"),
    consentGiven: boolean("consent_given").notNull(),
    consentVersion: text("consent_version").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    selectedAddressId: text("selected_address_id").notNull(),
    formattedAddress: text("formatted_address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    boundaryStatus: text("boundary_status").notNull(),
    parcelIdentifier: text("parcel_identifier"),
    addressEvidence: jsonb("address_evidence")
      .$type<PersistedAssessmentSubmission["addressEvidence"]>()
      .notNull(),
    poolLayout: jsonb("pool_layout")
      .$type<PersistedAssessmentSubmission["poolLayout"]>()
      .notNull(),
    layerStates: jsonb("layer_states")
      .$type<PersistedAssessmentSubmission["layerStates"]>()
      .notNull(),
    warnings: jsonb("warnings")
      .$type<PersistedAssessmentSubmission["warnings"]>()
      .notNull(),
    recommendations: jsonb("recommendations")
      .$type<PersistedAssessmentSubmission["recommendations"]>()
      .notNull(),
    reportData: jsonb("report_data")
      .$type<PersistedAssessmentSubmission["report"]["reportData"]>()
      .notNull(),
    reportTitle: text("report_title").notNull(),
    reportSummary: text("report_summary").notNull(),
    reportMapImageDataUrl: text("report_map_image_data_url"),
    feasibilityState: text("feasibility_state").notNull(),
    analysisVersion: text("analysis_version").notNull(),
    emailDeliveryState: text("email_delivery_state")
      .notNull()
      .default("pending"),
    emailDeliveryAttemptCount: integer("email_delivery_attempt_count")
      .notNull()
      .default(0),
    emailDeliveryLastAttemptedAt: timestamp(
      "email_delivery_last_attempted_at",
      { withTimezone: true },
    ),
    emailDeliverySentAt: timestamp("email_delivery_sent_at", {
      withTimezone: true,
    }),
    emailDeliveryProviderMessageId: text("email_delivery_provider_message_id"),
    emailDeliveryLastErrorCode: text("email_delivery_last_error_code"),
    emailDeliveryClaimToken: uuid("email_delivery_claim_token"),
    forwardingState: text("forwarding_state").notNull().default("pending"),
    forwardingAttemptCount: integer("forwarding_attempt_count")
      .notNull()
      .default(0),
    forwardingLastAttemptedAt: timestamp("forwarding_last_attempted_at", {
      withTimezone: true,
    }),
    forwardingSentAt: timestamp("forwarding_sent_at", {
      withTimezone: true,
    }),
    forwardingProviderMessageId: text("forwarding_provider_message_id"),
    forwardingLastErrorCode: text("forwarding_last_error_code"),
    forwardingClaimToken: uuid("forwarding_claim_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("homeowner_assessments_reference_uq").on(table.reference),
    uniqueIndex("homeowner_assessments_idempotency_key_uq").on(
      table.idempotencyKey,
    ),
    index("homeowner_assessments_created_at_idx").on(table.createdAt),
    index("homeowner_assessments_status_idx").on(table.status),
    check(
      "homeowner_assessments_status_ck",
      sql`${table.status} in ('new_enquiry', 'archived')`,
    ),
    check(
      "homeowner_assessments_timing_ck",
      sql`${table.desiredTiming} in ('asap', '3_months', '6_months', '12_months', 'other')`,
    ),
    check(
      "homeowner_assessments_visitor_type_ck",
      sql`${table.visitorType} in ('homeowner', 'pool_builder', 'other')`,
    ),
    check(
      "homeowner_assessments_other_detail_ck",
      sql`(${table.visitorType} <> 'other' or length(trim(coalesce(${table.visitorTypeOtherDetail}, ''))) > 0) and (${table.desiredTiming} <> 'other' or length(trim(coalesce(${table.desiredTimingOtherDetail}, ''))) > 0)`,
    ),
    check(
      "homeowner_assessments_consent_ck",
      sql`${table.consentGiven} = true`,
    ),
    check(
      "homeowner_assessments_feasibility_ck",
      sql`${table.feasibilityState} in ('no_warning', 'needs_checking', 'blocked')`,
    ),
    check(
      "homeowner_assessments_delivery_ck",
      sql`${table.emailDeliveryState} in ('pending', 'sending', 'sent', 'failed') and ${table.forwardingState} in ('pending', 'sending', 'sent', 'failed')`,
    ),
    check(
      "homeowner_assessments_delivery_attempts_ck",
      sql`${table.emailDeliveryAttemptCount} >= 0 and ${table.forwardingAttemptCount} >= 0`,
    ),
  ],
);

export type HomeownerAssessmentRow = typeof homeownerAssessments.$inferSelect;
