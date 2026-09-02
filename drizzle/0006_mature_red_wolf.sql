CREATE TABLE "linz_address_index" (
	"address_id" text PRIMARY KEY NOT NULL,
	"source_object_id" integer NOT NULL,
	"full_address" text NOT NULL,
	"full_address_number" text NOT NULL,
	"unit" text,
	"territorial_authority" text NOT NULL,
	"suburb_locality" text,
	"town_city" text,
	"postcode" text,
	"search_text" text NOT NULL,
	"longitude" double precision NOT NULL,
	"latitude" double precision NOT NULL,
	"is_current" boolean NOT NULL,
	"source_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linz_address_index_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"last_object_id" integer,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"source_updated_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "linz_address_index_runs_status_ck" CHECK ("linz_address_index_runs"."status" in ('running', 'completed', 'failed')),
	CONSTRAINT "linz_address_index_runs_counts_ck" CHECK ("linz_address_index_runs"."accepted_count" >= 0 and "linz_address_index_runs"."rejected_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "linz_address_index_source_object_id_uq" ON "linz_address_index" USING btree ("source_object_id");--> statement-breakpoint
CREATE INDEX "linz_address_index_current_ta_idx" ON "linz_address_index" USING btree ("is_current","territorial_authority");--> statement-breakpoint
CREATE INDEX "linz_address_index_search_tsv_idx" ON "linz_address_index" USING gin (to_tsvector('simple', "search_text"));--> statement-breakpoint
CREATE INDEX "linz_address_index_runs_status_completed_idx" ON "linz_address_index_runs" USING btree ("status","completed_at");
