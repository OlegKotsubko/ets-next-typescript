# Documentation Index

This folder is the single source of truth for ETS architecture, conventions, and runbooks. Read the docs in the order below if you're new; jump straight to any file if you know what you're looking for.

## For new developers (read in order)

1. [getting-started.md](./getting-started.md) — local setup: clone → install → env → run.
2. [tech-stack.md](./tech-stack.md) — what's installed and why.
3. [architecture.md](./architecture.md) — system overview, route map, data flow.
4. [projects-system.md](./projects-system.md) — overlay packages (the `projects/` folders) vs. UI-created projects, and how to create each.
5. [titles-system.md](./titles-system.md) — how to author a new overlay component (`index.tsx` + `model.ts` + `settings.ts`).

## Reference

- [auth.md](./auth.md) — better-auth-next setup, login flow, protected routes.
- [database.md](./database.md) — Drizzle schema, the `projects` (UUID) table, `project_id` isolation pattern, migrations vs project creation.
- [data-entities.md](./data-entities.md) — CRUD entity reference (Players, Talents, Teams, Sponsors, Assets, Videos, Brackets, Project CSS) and the `extra` string-map.
- [rundowns.md](./rundowns.md) — the **Overlays** section: rundown data model, the editor UI, the broadcast controller.
- [preview-air.md](./preview-air.md) — the SSE contract for `/preview` and `/air`; OBS/vMix browser-source setup.
- [state-management.md](./state-management.md) — Redux Toolkit + RTK Query patterns.

## Operations

- [deployment.md](./deployment.md) — Netlify Production / Deploy Preview / Branch Deploys; Neon database branching; SSE on Edge Functions.
- [roadmap.md](./roadmap.md) — MVP scope and Beta items (MIDI, Bluetooth).
