CREATE TABLE "alerts" (
	"project_id" uuid NOT NULL,
	"flag_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_project_id_flag_id_pk" PRIMARY KEY("project_id","flag_id")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"expectation_id" text NOT NULL,
	"reason" text NOT NULL,
	"offender" jsonb NOT NULL,
	"cause" jsonb,
	"ref" jsonb NOT NULL,
	"window" jsonb NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"version" text,
	"stream" text,
	"cursor_seq" bigint,
	"interval_ms" integer,
	"last_heartbeat_at" timestamp with time zone,
	"last_push_at" timestamp with time zone,
	"last_flag_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "project_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"stream" text NOT NULL,
	"alert_quiet_ms" integer DEFAULT 21600000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_flag_id_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_keys" ADD CONSTRAINT "project_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_project_sent" ON "alerts" USING btree ("project_id","sent_at");--> statement-breakpoint
CREATE INDEX "flags_project_received" ON "flags" USING btree ("project_id","received_at");--> statement-breakpoint
CREATE INDEX "flags_project_expectation" ON "flags" USING btree ("project_id","expectation_id");--> statement-breakpoint
CREATE INDEX "projects_owner" ON "projects" USING btree ("owner_id");