CREATE TYPE "public"."project_mode" AS ENUM('team_vs_team', 'player_vs_player');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mode" "project_mode" NOT NULL,
	"label" text NOT NULL,
	"picture_url" text,
	"event_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rundown_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rundown_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title_key" text NOT NULL,
	"label" text,
	"position" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rundowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_rundown_id_rundowns_id_fk" FOREIGN KEY ("rundown_id") REFERENCES "public"."rundowns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rundowns" ADD CONSTRAINT "rundowns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rundown_items_rundown_idx" ON "rundown_items" USING btree ("rundown_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rundowns_project_idx" ON "rundowns" USING btree ("project_id");