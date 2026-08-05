CREATE TABLE "staff_admin_accounts" (
	"id" integer PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"failed_sign_in_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_admin_accounts_singleton_ck" CHECK ("staff_admin_accounts"."id" = 1),
	CONSTRAINT "staff_admin_accounts_failed_sign_in_count_ck" CHECK ("staff_admin_accounts"."failed_sign_in_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admin_account_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_admin_account_id_staff_admin_accounts_id_fk" FOREIGN KEY ("admin_account_id") REFERENCES "public"."staff_admin_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_admin_accounts_username_uq" ON "staff_admin_accounts" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_sessions_token_hash_uq" ON "staff_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "staff_sessions_expires_at_idx" ON "staff_sessions" USING btree ("expires_at");