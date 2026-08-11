# Projects System

There are **two distinct things** here, and keeping them apart is the whole point of this doc:

- **An overlay package** is a folder under `projects/`. It's **file-system first**: a developer ships a package by adding a folder. The folder holds everything static — its identity, its overlay components, its CSS, its bundled fonts, logos, and the videos/backgrounds its overlays use. A package is a reusable template.
- **A project** is a **broadcast event** the operator creates from the `/admin` gallery (**Add Project**). It lives in the database (`projects` row, UUID id) and **selects one overlay package** via `project_label`. Many projects can reuse the same package (e.g. two `TCG` events on different dates). The database also holds the project's mutable data (players, teams, talents, sponsors, brackets, overlays) keyed by `project_id`.

So the old "a folder *is* a project" model is gone: folders are packages, projects are instances that point at a package. (Overlay components were formerly called "titles"; see [titles-system.md](./titles-system.md).)

## Overlay-package layout

```
projects/
└── TCG/                              # package label = folder name (shown in the Add Project dropdown)
    ├── project.config.ts             # package identity: label, display name, thumbnail
    ├── titles/                       # overlay components — auto-discovered
    │   ├── lower-third/
    │   │   ├── index.tsx             # the React component
    │   │   ├── model.ts              # Zod schema for operator-editable fields
    │   │   └── settings.ts           # presentation settings (preview, stingers, color, bg/video, full-screen)
    │   ├── scoreboard/
    │   │   └── …
    │   └── player-card/
    │       └── …
    ├── styles/
    │   └── project.css               # @font-face + CSS variables (brand colors, fonts)
    └── assets/
        ├── fonts/
        │   ├── TCGDisplay.woff2
        │   └── TCGBody.woff2
        ├── logos/
        │   └── league-logo.svg
        ├── videos/
        │   └── intro.mp4
        └── titles/                   # picked from in each overlay's settings.ts
            ├── videos/               # title_video + title_stinger_in / title_stinger_out choices
            │   ├── stinger-in.webm
            │   └── lower-third-loop.webm
            ├── backgrounds/          # title_background choices
            │   └── fullscreen-splash.webm
            └── previews/             # title_preview thumbnails
                └── lower-third.png
```

Overlay authoring (including `settings.ts`) is covered in [titles-system.md](./titles-system.md). This doc covers the package shell and how projects reference it.

## `project.config.ts` (package identity)

```ts
// projects/TCG/project.config.ts
import type { OverlayPackageConfig } from '@/lib/projects/types';

export default {
  label: 'TCG',                                        // must match folder name; this is what project_label stores
  name: 'Trading Card Gauntlet',                       // human label for the dropdown
  thumbnailPath: '/projects/TCG/assets/logos/league-logo.svg',
} satisfies OverlayPackageConfig;
```

```ts
// lib/projects/types.ts
export type OverlayPackageConfig = {
  label: string;       // === folder name
  name: string;
  thumbnailPath?: string;
};
```

## Adding a new overlay package (developer)

```bash
# 1. Create the folder structure
mkdir -p projects/MY-PACKAGE/{titles,styles,assets/{fonts,logos,videos},assets/titles/{videos,backgrounds,previews}}

# 2. Add the config (copy from another package's project.config.ts)
$EDITOR projects/MY-PACKAGE/project.config.ts

# 3. (Optional) Add a starter project.css
$EDITOR projects/MY-PACKAGE/styles/project.css

# 4. Start the dev server — the asset watcher and the package scan pick it up
npm run dev
```

**No database change is needed.** Packages aren't rows; they're discovered by scanning `projects/`. The new package simply appears in the Add Project dropdown.

## Creating a project (operator)

From the `/admin` gallery, **Add Project** opens a dialog with five fields:

| Field | Maps to | Control |
|---|---|---|
| `project_name` | `projects.name` | text |
| `project_mode` | `projects.mode` | select: `team_vs_team` / `player_vs_player` |
| `project_picture` | `projects.pictureUrl` | image upload (→ Project Assets) |
| `project_label` | `projects.label` | **dropdown of overlay-package folders** (`TCG`, `TNG`, …) |
| `project_date` | `projects.eventDate` | date picker |

Submitting POSTs to `/api/projects` and inserts one row (see [database.md](./database.md#projects-one-row-per-broadcast-event-created-from-the-admin-ui)). The new project then shows in the gallery and opens to its **Data** / **Overlays** workspace.

`project_mode` is load-bearing: it decides whether bracket matches pair **teams** or **players** ([data-entities.md](./data-entities.md#tournament-brackets)).

## Populating the `project_label` dropdown (the package scan)

The dropdown and server-side validation share one helper that scans `projects/` — there is **no `projects:sync` script and no per-folder DB row** anymore.

```ts
// lib/projects/packages.ts
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECTS_DIR = join(process.cwd(), 'projects');

export function listOverlayPackages() {
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(PROJECTS_DIR, d.name, 'project.config.ts')))
    .map(async d => (await import(join(PROJECTS_DIR, d.name, 'project.config.ts'))).default);
}

export function packageExists(label: string) {
  return existsSync(join(PROJECTS_DIR, label, 'project.config.ts'));
}
```

The `POST /api/projects` handler calls `packageExists(body.label)` and rejects with `400` if the folder is missing — the project's `label` can never dangle. Because packages are file-system only, **removing a folder** orphans any project pointing at it; guard deletions accordingly (a package in use by a project shouldn't be deleted lightly).

```json
// package.json — sync is gone; only the asset pipeline remains
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "predev": "npm run dev:assets",
    "prebuild": "npm run assets:sync",
    "assets:sync": "tsx scripts/sync-project-assets.ts",
    "dev:assets": "tsx scripts/sync-project-assets.ts --watch"
  }
}
```

## Static-asset pipeline

Next.js only serves static files from `public/`. To serve fonts, logos, and videos that live alongside title source code, we copy them into `public/projects/<slug>/` at build time.

### How it works

- `scripts/sync-project-assets.ts` copies `projects/<slug>/assets/` → `public/projects/<slug>/assets/` and `projects/<slug>/styles/` → `public/projects/<slug>/styles/`.
- Runs as `prebuild` (Netlify build) and via a `chokidar` watcher in dev (`npm run dev:assets`, started automatically by `predev`).
- `public/projects/` is **git-ignored** — it's a derived artifact.

### The script

```ts
// scripts/sync-project-assets.ts
import { join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { copy } from 'fs-extra';
import chokidar from 'chokidar';

const SRC = join(process.cwd(), 'projects');
const DST = join(process.cwd(), 'public', 'projects');

const watch = process.argv.includes('--watch');

async function copyAll() {
  for (const slug of readdirSync(SRC)) {
    if (!statSync(join(SRC, slug)).isDirectory()) continue;
    await copy(join(SRC, slug, 'assets'), join(DST, slug, 'assets'), { overwrite: true });
    await copy(join(SRC, slug, 'styles'), join(DST, slug, 'styles'), { overwrite: true });
  }
}

await copyAll();
if (watch) {
  chokidar.watch([`${SRC}/*/assets/**`, `${SRC}/*/styles/**`]).on('change', copyAll);
  console.log('Watching project assets…');
}
```

### Result URLs

After sync, the following URLs are live:

| Project file | Public URL |
|---|---|
| `projects/atl/assets/fonts/ATLDisplay.woff2` | `/projects/atl/assets/fonts/ATLDisplay.woff2` |
| `projects/atl/assets/logos/league-logo.svg` | `/projects/atl/assets/logos/league-logo.svg` |
| `projects/atl/styles/project.css` | `/projects/atl/styles/project.css` |

## Font pipeline

Each project ships its own fonts. **No Google Fonts; no external requests.** This keeps overlay rendering offline-safe and deterministic.

### 1. Drop `.woff2` files

```
projects/atl/assets/fonts/ATLDisplay.woff2
projects/atl/assets/fonts/ATLBody.woff2
```

### 2. Declare `@font-face` + variables in `project.css`

```css
/* projects/atl/styles/project.css */
@font-face {
  font-family: 'ATLDisplay';
  src: url('/projects/atl/assets/fonts/ATLDisplay.woff2') format('woff2');
  font-display: block;                  /* avoid FOUT in broadcast */
}
@font-face {
  font-family: 'ATLBody';
  src: url('/projects/atl/assets/fonts/ATLBody.woff2') format('woff2');
  font-display: block;
}

:root {
  --font-display: 'ATLDisplay', sans-serif;
  --font-body: 'ATLBody', sans-serif;

  --color-primary: #ff4d2e;
  --color-secondary: #1f2937;
  --color-accent: #fbbf24;
}
```

> Use `font-display: block` (not `swap`) in broadcast contexts so the title never paints with a fallback font.

### 3. Consume the variables in the title's SCSS module

Titles are styled with **SCSS modules + CSS variables only** — no Tailwind, no MUI,
no inline hex, no raw `font-family` (see [tech-stack.md](./tech-stack.md#what-we-deliberately-did-not-use)).
The variables declared in `project.css` are read directly with `var(…)`:

```scss
// projects/atl/titles/lower-third/LowerThird.module.scss
.name {
  font-family: var(--font-display);
  color: var(--color-primary);
  font-size: 6rem;
}
```

### 4. Use the classes in titles

```tsx
// projects/atl/titles/lower-third/index.tsx
import styles from './LowerThird.module.scss';

export default function LowerThird({ data }: { data: LowerThirdData }) {
  return <div className={styles.name}>{data.playerName}</div>;
}
```

Title code is now **brand-agnostic**. To re-skin a project, edit `project.css`; no title needs to change.

### 5. Load `project.css` in `/preview` and `/air` layouts

The Preview/Air layouts inject the right `project.css` based on the rundown's `project_id`:

```tsx
// app/(broadcast)/preview/[rundownId]/layout.tsx
import { db } from '@/db';
import { rundowns, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function PreviewLayout({
  children, params,
}: { children: React.ReactNode; params: { rundownId: string } }) {
  const rundown = await db.query.rundowns.findFirst({
    where: eq(rundowns.id, params.rundownId),
    with: { project: true },                  // need the project's label, not its UUID
  });
  if (!rundown) return <div>Rundown not found</div>;

  return (
    <>
      {/* the folder is the package label, NOT the project UUID */}
      <link rel="stylesheet" href={`/projects/${rundown.project.label}/styles/project.css`} />
      {children}
    </>
  );
}
```

The same pattern is used for `/air/[rundownId]/layout.tsx`. **The asset path uses `project.label` (the package folder), never `projectId` (a UUID).** See [preview-air.md](./preview-air.md) for the SSE side.

## File-system vs database boundary

| Concern | Lives in | Why |
|---|---|---|
| Package identity (label, name, thumbnail) | File-system (`project.config.ts`) | The folder is the source of truth; discovered by scan |
| Overlay components (React + Zod model + settings) | File-system (`projects/<label>/titles/`) | Code; built and bundled |
| Brand CSS, fonts, logos, title videos/backgrounds | File-system (`projects/<label>/styles/`, `assets/`) | Static assets |
| Project (event) — name, mode, picture, label, date | Database (`projects` row, UUID) | Created in the UI; carries the `label` pointer to a package |
| Players, talents, teams, sponsors, brackets | Database | Edited at runtime by the operator |
| Overlays (rundowns) and their items | Database | Edited at runtime; carry per-instance overlay data as JSONB |
| Uploaded media (per-event photos) | Database row + external storage | See [data-entities.md](./data-entities.md#project-assets) for upload strategy |

## Common pitfalls

- **Label mismatch.** `project.config.ts` `label` must equal the folder name; otherwise `packageExists()` won't match it and projects can't select the package.
- **Forgetting to run the watcher.** If you edit a font file in `projects/atl/assets/fonts/` and don't have `dev:assets` running, the browser won't see the change. `npm run dev` starts the watcher automatically.
- **Editing files in `public/projects/`.** This folder is overwritten on every sync. Always edit the source in `projects/<slug>/...`.
- **Loading `project.css` with `font-display: swap`.** Acceptable in admin; **never** in `/preview` or `/air` — broadcast frames will paint with a fallback font for a few hundred milliseconds.
