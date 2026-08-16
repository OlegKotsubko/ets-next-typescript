# Foundation Reconciliation — Design

**Status:** approved-in-brainstorm, pending spec review
**Date:** 2026-08-16

## Goal

Reconcile the built P0–P5a code's **data layer and Data-section CRUD** to the corrected docs (the etalon model): tournaments with integer ids, the real entity shapes, and the removal of the invented package/CSS/bracket-generator machinery. This is **subsystems 1–2** of the larger reconciliation; overlays, broadcast, and the controller (subsystems 3–5) are deferred.

## Approach

The corrected `docs/database.md` and `docs/data-entities.md` are the authoritative target and already contain the intended Drizzle table definitions verbatim — this pass makes the code match them. The generic CRUD machinery (`createCrudHandlers`, `createEntityApi`, `CrudPage`, `AssetPickerField`) is reused; each entity's table, Zod schema, `EntityDef`, route, RTK slice, and admin page is reshaped. All code built on the removed package model is deleted (not shimmed) and rebuilt correctly in later passes.

## Tech stack

Unchanged: Next.js 16 · React 19 · TypeScript · Drizzle + Neon (`@neondatabase/serverless` HTTP driver) · better-auth · Zod · React Hook Form · MUI · RTK Query · Vitest.

## Global constraints

- **Integer primary keys** (Drizzle `serial`) for every entity; the sole UUID is `displays.uuid` (deferred subsystem — not created this pass). `params.projectId` is parsed as an integer.
- **`project_id` FK isolation** preserved exactly (every entity table has `project_id` → `projects.id` `on delete cascade`; every index leads with `project_id`; `projectId` is derived from the URL, never the body).
- **Re-baseline migrations, do not run them.** Replace `db/migrations/0000–0003` with one fresh `0000` baseline via `db:generate`. **Never run `db:migrate`** — the operator resets their dev DB and runs it. **`.env` is never read, moved, or modified.**
- **Auth is untouched** this pass (email+password stays). Switching to the better-auth username plugin is a separate auth-subsystem task; flag it, don't do it.
- Green **typecheck, lint, build, and `vitest run`** at the end. Tests asserting removed concepts are deleted; tests for changed entities are rewritten.
- Do not touch `docs/superpowers/plans/*` historical records other than adding this pass's plan.

## In scope

**Schema baseline** (`db/schema.ts`) — the tables foundation + the Data section need:

| Group | Tables |
|---|---|
| Auth (unchanged) | `users`, `sessions`, `accounts`, `verifications` |
| Tournaments | `projects` (int id, `title`, `hero_section_url`, `status` enum, `discipline_id`→tags), `project_tags`, `project_favourites` |
| Disciplines | `tags` |
| Data entities | `players`+`player_photos`, `teams`+`team_logos`+`team_players`, `talents`, `sponsors`, `matches`+`seatings`+`brackets`, `themes`, `assets`, `videos` |
| Container | `rundowns` (int id, `projectId`, `userId`, `name`, `image`) |

Field-level definitions are taken verbatim from `docs/database.md` §2–5 and `docs/data-entities.md`. Deltas from the doc snippets that this spec fixes:
- **`tags`**: `{ id serial, name text }` (minimal; FK target for `projects.discipline_id`, `players.discipline_id`, `teams.discipline_id`, `project_tags`).
- **`talents`**: `{ id, projectId, nickname (req), socialLinks jsonb, extraText text, photoUrl text }` (single photo URL per the data-entities "Conventions"; drops the invented asset-FK columns + `extra` map).
- **`sponsors`**: `{ id, projectId, name (req), logoUrl text, videoId int→videos }` (duplicate names allowed; drops asset-FK columns).
- **`brackets`**: `{ id, projectId, name, structure jsonb }` — a **stored tree**; drops `format`/`participant_count`/generated `rounds`.
- **`assets`**: `{ id, projectId, name, url, assetType enum(decor|background) }` (+ optional `mimeType`/`sizeBytes` upload metadata); drops `kind`.
- **`videos`**: `{ id, projectId, name, url, videoType enum(mixer|background) }`.
- **`rundowns`**: keeps `createdAt`/`updatedAt` (harmless audit columns) on top of the doc's shown fields.

**Entity CRUD reconciliation** (Data section) — table + Zod (`db/schemas/<entity>.ts`) + `EntityDef` (`lib/entities/<entity>.ts`) + route + RTK slice (`store/apis/<entity>Api.ts`) + admin page:

- **players** — core fields + typed `player_photos`; `socialLinks` map. Drops 7 asset FKs + `extra`.
- **teams** — `country/region/disciplineId/opendotaId/socialLinks` + `team_logos` + roster (`team_players`, int ids).
- **talents** — reshaped to `nickname/socialLinks/extraText/photoUrl`.
- **sponsors** — `name/logoUrl/videoId`.
- **brackets/matches/seatings** — replace the `participant_count` generator with stored-tree bracket CRUD + `matches` CRUD + `seatings` CRUD. (Heaviest change; the bracket editor UI becomes a stored-tree editor + match list.)
- **tags** — new CRUD (disciplines vocabulary).
- **themes** — new CRUD (`name/isActive/colors[{name,code}]/assetIds[]`), replacing `project_css`.
- **assets** — reshaped; **upload de-Netlified** behind a small storage abstraction (`lib/assets/upload.ts` → an interface with a local-disk/dev impl; S3/R2 impl is a deployment concern). Drops `@netlify/blobs`.
- **videos** — reshaped (`videoType`).
- **projects gallery** — list + status filter + favourite; **no create**. Reconcile `projectsApi`, `/api/projects`, `ProjectsGallery`, and the `[projectId]` workspace (Data / Overlays / MIDI / Bluetooth nav — Overlays/MIDI/Bluetooth land as later passes; nav present, routes may be stubs).

**New EntityDef field widgets** needed: `select` (disciplineId, status), `social-links` (repeatable `{type,link}`), `typed-images` (photo-type child rows). Reuse `AssetPickerField` for single-URL image fields.

**Child-table writes**: parent create/update accepts nested children (players → `photos[]`; teams → `logos[]` + `roster[]`), written as a replace-children operation alongside the parent row. Wrap in `db.transaction` if the neon-http driver supports it in this version; otherwise sequential writes (documented, best-effort). Mirrors the existing team-roster `replaceRoster` route pattern.

## Removals (delete code **and** tests)

- **Package model**: `projects/` tree; `lib/projects/{packages,getProjectLabel,registry-codegen,assets,generated}.ts`; `lib/broadcast/PackageLabelContext.tsx`; `app/api/overlay-packages/route.ts`; `store/apis/overlayPackagesApi.ts`; `scripts/generate-package-registry.ts`; `scripts/sync-project-assets.ts`; the `packages:generate`/`assets:sync`/`dev:assets` npm scripts (and their `predev`/`prebuild` hooks). Tests: `test/projects/*`, `test/app/api/overlay-packages.test.ts`, `test/store/apis/overlayPackagesApi.test.ts`.
- **project_css**: `app/api/projects/[projectId]/css/route.ts`; `app/(admin)/projects/[projectId]/data/css/page.tsx`; `store/apis/projectCssApi.ts`; `project_css` table; `lib/css/validate-no-remote-import.ts`; `test/lib/css/*`. (Replaced by `themes`.)
- **extra-map**: `components/admin/crud/ExtraMapField.tsx`; `db/schemas/shared.ts` `extraSchema`; `test/components/admin/crud/ExtraMapField.test.tsx`, `test/db/schemas/shared.test.ts`.
- **bracket generator**: `lib/brackets/generate.ts`; `test/lib/brackets/generate.test.ts`.
- **`@netlify/blobs`** dependency (upload rewritten).

## Deferred — removed now, rebuilt in later passes (subsystems 3–5)

Deleted this pass because they're built on the package model and would be rewritten regardless: overlay/titles registry (`lib/titles/*`, `scripts/generate-title-registry.ts`, `titles:generate`, `app/api/projects/[projectId]/titles/route.ts`, `store/apis/titlesApi.ts`, `app/(admin)/dev/title-preview/*`, `models/*`, `components/admin/rundown/*`); rundown-**overlays** CRUD (`app/api/projects/[projectId]/rundowns/[id]/items/*`, `lib/entities/rundown-items.ts`, `store/apis/rundownItemsApi.ts`, `db/schemas/rundown-items.ts`, the rundown editor page); broadcast + preview/air (`lib/broadcast/*`, `app/api/broadcast/*`, `app/(broadcast)/*`); controller/displays/settings (not yet built). Their tables (`displays`, `settings`, `rundown_overlays`, `rundown_overlay_data`) are added to the schema with the pass that builds them.

**Consequence accepted:** there is no working `/preview` or `/air` between this pass and the broadcast pass. `rundowns` remains (a named container) with basic list/create CRUD; it has no placed overlays until the overlay pass.

## Re-baseline procedure (operator runs, not the agent)

1. Reset the dev database (drop schema / fresh Neon branch).
2. `npm run db:migrate` to apply the new `0000` baseline.
3. Seed a couple of `projects` (tournament) rows + `tags` for local dev.

## Verification (all agent-run except `db:migrate`)

1. `npm run typecheck` — clean.
2. `npm run lint` — clean.
3. `npm run build` — succeeds (`prebuild` reduced to `titles:generate`… which is itself removed → `prebuild` dropped; confirm build has no codegen dependency left).
4. `npm run test` (`vitest run`) — green; no test references a removed concept.
5. Dropped-term sweep: `grep -rniE "project_mode|project_label|overlay.?package|participant_count|extraSchema|avatarAssetId|@netlify/blobs|titleKey|rundown_items|project_css" app lib components store db scripts` returns nothing (outside this spec + `docs/superpowers/**`).
6. New-model spot check: `projects` has `title/status/discipline_id`; `player_photos`/`team_logos`/`matches`/`seatings`/`themes`/`tags` tables exist; every entity route parses an integer `projectId`.
