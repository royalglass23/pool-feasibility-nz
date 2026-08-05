CREATE TABLE "report_request_retention_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"deleted_count" integer NOT NULL,
	CONSTRAINT "report_request_retention_runs_deleted_count_ck" CHECK ("report_request_retention_runs"."deleted_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "report_request_retention_runs_ran_at_idx" ON "report_request_retention_runs" USING btree ("ran_at");