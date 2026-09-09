ALTER TABLE "alerts" ADD COLUMN "bucket" bigint NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_project_bucket" ON "alerts" USING btree ("project_id","bucket");