ALTER TABLE "homeowner_assessments" DROP CONSTRAINT "homeowner_assessments_timing_ck";--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "visitor_type" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "visitor_type_other_detail" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD COLUMN "desired_timing_other_detail" text;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD CONSTRAINT "homeowner_assessments_visitor_type_ck" CHECK ("homeowner_assessments"."visitor_type" in ('homeowner', 'pool_builder', 'other'));--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD CONSTRAINT "homeowner_assessments_other_detail_ck" CHECK (("homeowner_assessments"."visitor_type" <> 'other' or length(trim(coalesce("homeowner_assessments"."visitor_type_other_detail", ''))) > 0) and ("homeowner_assessments"."desired_timing" <> 'other' or length(trim(coalesce("homeowner_assessments"."desired_timing_other_detail", ''))) > 0));--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ADD CONSTRAINT "homeowner_assessments_timing_ck" CHECK ("homeowner_assessments"."desired_timing" in ('asap', '3_months', '6_months', '12_months', 'other'));
