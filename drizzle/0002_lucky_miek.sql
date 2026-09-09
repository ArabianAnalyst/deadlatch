ALTER TABLE "monitors" ADD COLUMN "last_alert_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "last_alert_error" text;