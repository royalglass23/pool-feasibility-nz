ALTER TABLE "homeowner_assessments" DROP CONSTRAINT "homeowner_assessments_delivery_ck";--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "report_map_image_data_url" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "email_delivery_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "email_delivery_last_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "email_delivery_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "email_delivery_provider_message_id" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "email_delivery_last_error_code" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "email_delivery_claim_token" uuid;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "forwarding_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "forwarding_last_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "forwarding_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "forwarding_provider_message_id" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "forwarding_last_error_code" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "forwarding_claim_token" uuid;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD CONSTRAINT "homeowner_assessments_delivery_attempts_ck" CHECK ("homeowner_assessments"."email_delivery_attempt_count" >= 0 and "homeowner_assessments"."forwarding_attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD CONSTRAINT "homeowner_assessments_delivery_ck" CHECK ("homeowner_assessments"."email_delivery_state" in ('pending', 'sending', 'sent', 'failed') and "homeowner_assessments"."forwarding_state" in ('pending', 'sending', 'sent', 'failed'));