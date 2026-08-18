# Getting Started

A 10-minute path from clone to a working dev server with a sample project showing in OBS.

## Prerequisites

- **Node.js 20.9+** (Next.js 16 minimum).
- **A Neon account** — free tier is fine. Create a project and copy its connection string.
- **OBS Studio** (or vMix) if you want to verify the broadcast pipeline end-to-end.

## 1. Clone and install

```bash
git clone <repo-url> ets-next-typescript
cd ets-next-typescript
npm install
```

## 2. Configure environment

Copy the example file and fill in the blanks:

```bash
cp .env.example .env.local
```

`.env.local` (git-ignored):

```env
# Neon dev database
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"

# better-auth
BETTER_AUTH_SECRET="<random 32-byte hex — generate with `openssl rand -hex 32`>"
BETTER_AUTH_URL="http://localhost:3000"
```

See [auth.md](./auth.md) for what each variable controls and [deployment.md](./deployment.md) for how these are set on the production server.

## 3. Initialize the database

Apply the Drizzle schema to your Neon dev branch:

```bash
npm run db:migrate
```

This creates `users`, `sessions`, `projects` (tournaments), the entity tables (`players`, `player_photos`, `teams`, `team_logos`, `team_players`, `talents`, `sponsors`, `matches`, `seatings`, `brackets`, `tags`, `themes`, `assets`, `videos`), and the content tree (`rundowns` — with a public `uuid` broadcast address — and `rundown_overlays`). Broadcast output is addressed by the rundown's `uuid`; there is no `displays` or `settings` table (the per-broadcast `rundown_overlay_data` is deferred).

> If you ever want to inspect the live database, `npm run db:studio` opens Drizzle Studio in your browser.

## 4. Create your first user

There is no public sign-up screen. Insert a user via Drizzle Studio (`npm run db:studio`) or with a one-liner:

```bash
npx tsx scripts/create-user.ts your-username 'a-strong-password'
```

The script hashes the password and inserts a row into `users`. Login is by **username**. See [auth.md](./auth.md#bootstrapping-the-first-user) for the script source.

## 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000/login>, sign in with the user you created in step 4, and you'll land on the project gallery.

## 6. Enter a tournament

A "project" is a **tournament** (absorbed from the weplay tournament service — see [projects-system.md](./projects-system.md#projects-are-tournaments)). Seed a couple of tournament rows into `projects` for local dev (via `npm run db:studio` or a seed script), then open the gallery at `/projects`, filter by status, and click one to open its **Data / Overlays / MIDI / Bluetooth** workspace. There is no "create project" flow.

## 7. (Optional) Hook up OBS

Build a rundown of overlays, then point OBS at that rundown's public URL:

1. **+** in OBS Sources → **Browser**.
2. URL: `http://localhost:3000/air/<rundownUuid>` (the rundown's public UUID; append `?filter=N` to route by `display_filter`).
3. Width/Height: **1920 / 1080**.
4. **Custom CSS**: leave empty — the active theme's CSS variables are applied automatically.
5. Check **Refresh browser when scene becomes active**.

Now taking an overlay to air in the controller will show it in OBS. See [preview-air.md](./preview-air.md#obs--vmix-setup) for vMix instructions and troubleshooting.

## Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000. |
| `npm run build` | Production build. |
| `npm run titles:generate` | Regenerate the overlay registry (static imports). Runs via `predev`/`prebuild`. |
| `npm run db:generate` | Generate a new SQL migration from schema changes. |
| `npm run db:migrate` | Apply pending migrations against `DATABASE_URL`. |
| `npm run db:studio` | Open Drizzle Studio. |

## When things go wrong

- **`relation "users" does not exist`** — you skipped step 3. Run `npm run db:migrate`.
- **Login form rejects valid credentials** — `BETTER_AUTH_URL` doesn't match the origin you're loading the app from, or `BETTER_AUTH_SECRET` is empty. See [auth.md](./auth.md#troubleshooting).
- **`/air/<rundownUuid>` shows a blank page in OBS** — open the URL in a regular browser first to check for errors. The most common cause is a rundown UUID that doesn't exist, or no overlay currently on air for it. See [preview-air.md](./preview-air.md).
- **Fonts or colors look wrong in OBS** — the tournament has no active theme, so its CSS variables aren't set. Activate a theme. See [projects-system.md](./projects-system.md#theming).

## Working on media/upload features

Uploaded images and videos (player photos, team/sponsor logos, tournament art, overlay stinger/background clips) are stored in **object storage** (S3-compatible — Cloudflare R2 / Hetzner Object Storage) or on a local media volume in production; the DB holds only the URL. See [deployment.md](./deployment.md#6-media-storage). For local dev, point the app at a dev bucket (or a local MinIO / a local `public/media` folder) via the same env vars you'll use in production.
