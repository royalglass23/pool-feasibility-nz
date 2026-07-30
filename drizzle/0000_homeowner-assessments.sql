CREATE SEQUENCE "homeowner_assessment_reference_seq";
--> statement-breakpoint
CREATE TABLE "homeowner_assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'new_enquiry' NOT NULL,
	"homeowner_name" text NOT NULL,
	"homeowner_phone" text NOT NULL,
	"homeowner_email" text NOT NULL,
	"homeowner_address" text NOT NULL,
	"desired_timing" text NOT NULL,
	"additional_info" text,
	"consent_given" boolean NOT NULL,
	"consent_version" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"selected_address_id" text NOT NULL,
	"formatted_address" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"boundary_status" text NOT NULL,
	"parcel_identifier" text,
	"address_evidence" jsonb NOT NULL,
	"pool_layout" jsonb NOT NULL,
	"layer_states" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"recommendations" jsonb NOT NULL,
	"report_data" jsonb NOT NULL,
	"report_title" text NOT NULL,
	"report_summary" text NOT NULL,
	"feasibility_state" text NOT NULL,
	"analysis_version" text NOT NULL,
	"email_delivery_state" text DEFAULT 'pending' NOT NULL,
	"forwarding_state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "homeowner_assessments_status_ck" CHECK ("homeowner_assessments"."status" in ('new_enquiry', 'archived')),
	CONSTRAINT "homeowner_assessments_timing_ck" CHECK ("homeowner_assessments"."desired_timing" in ('asap', '3_months', '6_months', '12_months')),
	CONSTRAINT "homeowner_assessments_consent_ck" CHECK ("homeowner_assessments"."consent_given" = true),
	CONSTRAINT "homeowner_assessments_feasibility_ck" CHECK ("homeowner_assessments"."feasibility_state" in ('no_warning', 'needs_checking', 'blocked')),
	CONSTRAINT "homeowner_assessments_delivery_ck" CHECK ("homeowner_assessments"."email_delivery_state" in ('pending', 'sent', 'failed') and "homeowner_assessments"."forwarding_state" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "homeowner_assessments_reference_uq" ON "homeowner_assessments" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "homeowner_assessments_idempotency_key_uq" ON "homeowner_assessments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "homeowner_assessments_created_at_idx" ON "homeowner_assessments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "homeowner_assessments_status_idx" ON "homeowner_assessments" USING btree ("status");
