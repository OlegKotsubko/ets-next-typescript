-- Singleton seed project. Idempotent so re-running migrations is safe.
INSERT INTO "projects" ("id", "name", "mode", "label")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Event', 'team_vs_team', 'default')
ON CONFLICT ("id") DO NOTHING;
