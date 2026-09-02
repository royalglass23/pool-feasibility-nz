DROP INDEX "linz_address_index_source_object_id_uq";--> statement-breakpoint
ALTER TABLE "linz_address_index" DROP COLUMN "source_object_id";--> statement-breakpoint
ALTER TABLE "linz_address_index" DROP COLUMN "suburb_locality";--> statement-breakpoint
ALTER TABLE "linz_address_index" DROP COLUMN "town_city";--> statement-breakpoint
ALTER TABLE "linz_address_index" DROP COLUMN "postcode";--> statement-breakpoint
ALTER TABLE "linz_address_index" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "linz_address_index" DROP COLUMN "synced_at";
