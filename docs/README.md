# Documentation Index

This folder is the single source of truth for ETS architecture, conventions, and runbooks. Read the docs in the order below if you're new; jump straight to any file if you know what you're looking for.

## For new developers (read in order)

1. [getting-started.md](./getting-started.md) — local setup: clone → install → env → run.
2. [tech-stack.md](./tech-stack.md) — what's installed and why.
3. [architecture.md](./architecture.md) — system overview, route map, data flow.
4. [projects-system.md](./projects-system.md) — projects are **tournaments** (authored in-app); overlays are **global**, organized by pack (folder = category)/template; a tournament's `overlayPacks` selects packs; runtime theming.
5. [titles-system.md](./titles-system.md) — how to author an overlay (`index.tsx` + `model.ts` widget schema + `settings.ts` + GSAP animations).

## Reference

- [auth.md](./auth.md) — username + password session cookie, login flow, guest users, protected routes.
- [database.md](./database.md) — Drizzle schema, tournaments, the `project_id` isolation pattern, rundown broadcast addressing (the rundown `uuid`), the rundown→overlay→data tree.
- [data-entities.md](./data-entities.md) — CRUD entity reference (Players, Teams, Talents, Sponsors, Matches/Brackets, Themes, Assets, Videos).
- [rundowns.md](./rundowns.md) — the **Overlays** section: rundown/overlay data model, the editor, and the live controller.
- [preview-air.md](./preview-air.md) — the SSE contract for `/preview` and `/air` (display-addressed); OBS/vMix browser-source setup.
- [state-management.md](./state-management.md) — Redux Toolkit + RTK Query patterns.

## Operations

- [deployment.md](./deployment.md) — a single always-on Node server on Hetzner behind Caddy; Neon (or self-hosted) Postgres; object-storage media; the single-instance SSE/bus model.
- [roadmap.md](./roadmap.md) — MVP scope and Beta items (MIDI, Bluetooth).
