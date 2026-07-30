ALTER TABLE "homeowner_assessments" ALTER COLUMN "latitude" SET DATA TYPE double precision USING "latitude"::double precision;--> statement-breakpoint
ALTER TABLE "homeowner_assessments" ALTER COLUMN "longitude" SET DATA TYPE double precision USING "longitude"::double precision;
