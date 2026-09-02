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

export const reportRequestRetentionRuns = pgTable(
  "report_request_retention_runs",
  {
    id: uuid("id").primaryKey(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
    deletedCount: integer("deleted_count").notNull(),
  },
  (table) => [
    index("report_request_retention_runs_ran_at_idx").on(table.ranAt),
    check(
      "report_request_retention_runs_deleted_count_ck",
      sql`${table.deletedCount} >= 0`,
    ),
  ],
);

/** Public LINZ address-search records only. No visitor search history is stored. */
export const linzAddressIndex = pgTable(
  "linz_address_index",
  {
    addressId: text("address_id").primaryKey(),
    fullAddress: text("full_address").notNull(),
    fullAddressNumber: text("full_address_number").notNull(),
    unit: text("unit"),
    territorialAuthority: text("territorial_authority").notNull(),
    searchText: text("search_text").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    isCurrent: boolean("is_current").notNull(),
    lastSeenRunId: uuid("last_seen_run_id"),
  },
  (table) => [
    index("linz_address_index_current_ta_idx").on(
      table.isCurrent,
      table.territorialAuthority,
    ),
  ],
);

export const linzAddressIndexRuns = pgTable(
  "linz_address_index_runs",
  {
    id: uuid("id").primaryKey(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceSnapshotUrl: text("source_snapshot_url"),
    sourceSnapshotAt: timestamp("source_snapshot_at", { withTimezone: true }),
    lastObjectId: integer("last_object_id"),
    acceptedCount: integer("accepted_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    errorCode: text("error_code"),
  },
  (table) => [
    index("linz_address_index_runs_status_completed_idx").on(
      table.status,
      table.completedAt,
    ),
    check(
      "linz_address_index_runs_status_ck",
      sql`${table.status} in ('running', 'completed', 'failed')`,
    ),
    check(
      "linz_address_index_runs_counts_ck",
      sql`${table.acceptedCount} >= 0 and ${table.rejectedCount} >= 0`,
    ),
  ],
);

export const staffAdminAccounts = pgTable(
  "staff_admin_accounts",
  {
    id: integer("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    failedSignInCount: integer("failed_sign_in_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_admin_accounts_username_uq").on(table.username),
    check("staff_admin_accounts_singleton_ck", sql`${table.id} = 1`),
    check(
      "staff_admin_accounts_failed_sign_in_count_ck",
      sql`${table.failedSignInCount} >= 0`,
    ),
  ],
);

export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").primaryKey(),
    adminAccountId: integer("admin_account_id")
      .notNull()
      .references(() => staffAdminAccounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_sessions_token_hash_uq").on(table.tokenHash),
    index("staff_sessions_expires_at_idx").on(table.expiresAt),
  ],
);
