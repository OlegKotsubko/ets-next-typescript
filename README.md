# ETS — weplay studios Live-Stream Graphics

A Next.js application that serves broadcast graphics (lower-thirds, scoreboards, player cards, sponsor bugs) to streaming software such as **OBS** and **vMix** via browser sources. An operator drives the broadcast from an admin UI; preview and on-air channels render the same React title components fed by Server-Sent Events.

## Quickstart

```bash
git clone <repo-url> ets-next-typescript
cd ets-next-typescript

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL (Neon), BETTER_AUTH_SECRET, BETTER_AUTH_URL

# 3. Apply database schema
npm run db:migrate

# 4. Run the dev server
npm run dev
```

Open <http://localhost:3000/login>. After signing in you'll land on the project gallery at `/admin`, where **Add Project** creates a broadcast event that selects one overlay package (a folder under `projects/`).

To preview a rundown as OBS would see it, open `http://localhost:3000/air/<rundownId>` in a separate browser tab or as an OBS Browser Source (1920×1080, transparent background).

## Project structure at a glance

```
app/                    # Next.js App Router (admin, login, preview, air, api)
projects/               # Overlay packages (config, overlay components, css, assets) — reusable templates
db/                     # Drizzle schema + migrations
scripts/                # sync-project-assets.ts
docs/                   # Full documentation — start at docs/README.md
public/projects/        # Build artifact: copied package assets (git-ignored)
```

## Documentation

Full docs live in [`docs/`](./docs/README.md). Start there for architecture, the title-authoring guide, the data model, the SSE contract, and the deployment runbook.

## Status

**MVP** — Auth, Project creation, Data CRUD, Overlays (rundowns), Controller, Preview, Air.
**Beta (not in MVP)** — MIDI control surfaces, Bluetooth presenter remotes. See [`docs/roadmap.md`](./docs/roadmap.md).
