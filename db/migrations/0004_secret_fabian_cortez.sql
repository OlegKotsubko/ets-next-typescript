ALTER TABLE "project_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "project_tags" CASCADE;--> statement-breakpoint
DROP TABLE "tags" CASCADE;--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "players_discipline_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_discipline_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_discipline_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "overlay_packs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "discipline_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "hero_section_url";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "discipline_id";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "discipline_id";