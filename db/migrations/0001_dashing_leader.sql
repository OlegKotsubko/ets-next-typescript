CREATE TABLE "rundown_overlays" (
	"id" serial PRIMARY KEY NOT NULL,
	"rundown_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"model" text NOT NULL,
	"category" text,
	"template" text,
	"widget_name" text NOT NULL,
	"layer" integer DEFAULT 1 NOT NULL,
	"color" integer DEFAULT 1 NOT NULL,
	"display_filter" text,
	"preview_img" text,
	"is_fullscreen" boolean DEFAULT false NOT NULL,
	"has_next_button" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"in_mixer" text,
	"out_mixer" text,
	"inner_mixer" text,
	"in_transition_cut_point" double precision,
	"out_transition_cut_point" double precision,
	"background_video" text,
	"background_image" text,
	"data" jsonb DEFAULT '{"widget":{}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rundown_overlays" ADD CONSTRAINT "rundown_overlays_rundown_id_rundowns_id_fk" FOREIGN KEY ("rundown_id") REFERENCES "public"."rundowns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_overlays" ADD CONSTRAINT "rundown_overlays_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rundown_overlays_rundown_idx" ON "rundown_overlays" USING btree ("rundown_id","order");