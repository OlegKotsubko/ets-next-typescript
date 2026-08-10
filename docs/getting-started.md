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

See [auth.md](./auth.md) for what each variable controls and [deployment.md](./deployment.md) for how these map to Netlify contexts in production.

## 3. Initialize the database

Apply the Drizzle schema to your Neon dev branch:

```bash
npm run db:migrate
```

This creates `users`, `sessions`, `projects`, and all the entity tables (`players`, `talents`, `teams`, `team_players`, `sponsors`, `assets`, `videos`, `brackets`, `rundowns`, `rundown_items`, `project_css`).

> If you ever want to inspect the live database, `npm run db:studio` opens Drizzle Studio in your browser.

## 4. Create your first user

There is no public sign-up screen. Insert a user via Drizzle Studio (`npm run db:studio`) or with a one-liner:

```bash
npx tsx scripts/create-user.ts you@example.com 'a-strong-password'
```

The script hashes the password and inserts a row into `users`. See [auth.md](./auth.md#bootstrapping-the-first-user) for the script source.

## 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000/login>, sign in with the user you created in step 4, and you'll land on the project gallery.

## 6. Create your first project

The repo ships with one overlay package at `projects/sample/` (its folder name, `sample`, is the package **label**). In the gallery, click **Add Project**, give it a name, pick a `project_mode`, choose **sample** in the `project_label` dropdown, and set a date. That inserts a `projects` row and opens the project's **Data** / **Overlays** workspace.

> There is no `projects:sync` step. Overlay-package folders are discovered automatically by scanning `projects/`; projects themselves are created here in the UI. See [projects-system.md](./projects-system.md).

## 7. (Optional) Hook up OBS

Once you've created an overlay (rundown) in your project, set up OBS to consume it:

1. **+** in OBS Sources → **Browser**.
2. URL: `http://localhost:3000/air/<rundownId>` (copy the rundown ID from the admin URL).
3. Width/Height: **1920 / 1080**.
4. **Custom CSS**: leave empty — the project's `project.css` is loaded automatically.
5. Check **Refresh browser when scene becomes active**.

Now clicking AIR in the admin controller will show the title in OBS. See [preview-air.md](./preview-air.md#obs--vmix-setup) for vMix instructions and troubleshooting.

## Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000. Runs `dev:assets` first. |
| `npm run build` | Production build. Runs `assets:sync` first. |
| `npm run db:generate` | Generate a new SQL migration from schema changes. |
| `npm run db:migrate` | Apply pending migrations against `DATABASE_URL`. |
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run assets:sync` | Copy `projects/*/{assets,styles}` into `public/projects/*`. |
| `npm run dev:assets` | Watch `projects/*/{assets,styles}` and copy changes into `public/projects/*`. |

## When things go wrong

- **`relation "users" does not exist`** — you skipped step 3. Run `npm run db:migrate`.
- **Login form rejects valid credentials** — `BETTER_AUTH_URL` doesn't match the origin you're loading the app from, or `BETTER_AUTH_SECRET` is empty. See [auth.md](./auth.md#troubleshooting).
- **`/air/<id>` shows a blank page in OBS** — open the URL in a regular browser first to check for errors. The most common cause is a rundown ID that doesn't exist, or a project whose `project_label` points at a missing overlay-package folder. See [preview-air.md](./preview-air.md#troubleshooting).
- **Fonts don't load in OBS** — check that `public/projects/<slug>/assets/fonts/` exists after running `npm run dev:assets`. See [projects-system.md](./projects-system.md#font-pipeline).

## Working on asset-related features

Any work touching Project Assets, or any entity with an image/video field (Players, Talents, Teams, Sponsors), needs Netlify Blobs, which only works under `netlify dev` — not plain `next dev`. Run:

```bash
npx netlify dev
```

instead of `npm run dev` when working in this area. Everything else in the app works the same either way.
