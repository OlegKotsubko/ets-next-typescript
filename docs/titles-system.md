# Titles System

A **title** is a React component that renders one broadcast graphic — a lower-third, a scoreboard, a player card, a sponsor bug. Titles live inside each project under `projects/<slug>/titles/`. The same component is used in the admin preview, the operator preview channel (`/preview`), and the on-air output (`/air`).

> **Terminology.** These components are the **overlays** the operator assembles in the **Overlays** workspace section. "Title" is the historical name for the same thing and is used interchangeably below (the folder is still `titles/`, the registry key is still `titleKey`).

## Anatomy of a title

Each title is its own folder with exactly three files:

```
projects/TCG/titles/lower-third/
├── index.tsx       # the React component
├── model.ts        # the Zod schema for operator-editable fields
└── settings.ts     # presentation settings (preview, stingers, color, bg/video, full-screen)
```

### `model.ts` — the single source of truth

The Zod schema describes every field the operator can edit. It is used in three places:

1. **The admin edit form** — schema fields are rendered as inputs (the title-discovery layer reflects on the schema to build the form).
2. **Server-side mutation validation** — the API parses the request body against the schema before writing to `rundown_items.data`.
3. **SSE payload validation** — the broadcast event bus validates the payload against the schema before pushing it to subscribers; the client revalidates on receipt.

```ts
// projects/atl/titles/lower-third/model.ts
import { z } from 'zod';

export const model = z.object({
  playerName: z.string().min(1).max(40),
  teamName: z.string().max(40).optional(),
  position: z.enum(['guard', 'forward', 'center']).optional(),
  teamLogoAssetId: z.string().uuid().optional(),
});

export type LowerThirdData = z.infer<typeof model>;

export const meta = {
  displayName: 'Lower Third',
  description: 'Single-line player name + optional team and position.',
};
```

> The operator-facing display name now lives in `settings.ts` as `title_name` (see below), not in `model.ts`. If you keep a `meta` export for description text, that's fine, but `title_name` is the canonical label shown in the Overlays picker.

### Shared models library (`models/`)

Reusable field/action contracts don't live duplicated inside each package — they live once, top-level, in `models/<TitleType>.ts`. A shared model exports the Zod fields **and** the title's declared **command actions**: the buttons a thread widget can send, and the allow-list the `/command` route validates against. Universal actions (`air`, `preview`, `hide`, `update`) are implicit for every title and are **never** listed here.

```ts
// models/OpeningTimer.ts
import { z } from 'zod';

export const OpeningTimerFields = z.object({
  hours: z.number().int().min(0).max(99),
  minutes: z.number().int().min(0).max(59),
  seconds: z.number().int().min(0).max(59),
  main_text: z.string().max(80),
  sponsors: z.array(z.string()).default([]),
});

export const OpeningTimerActions = ['start', 'stop', 'reset'] as const;

export type OpeningTimerData = z.infer<typeof OpeningTimerFields>;
```

A package's `model.ts` **composes** the shared contract with `.omit()`/`.extend()` — so a project can drop or add fields without forking the shared definition — then re-exports `actions` unchanged (or narrowed):

```ts
// projects/TCG/titles/opening-timer/model.ts
import { z } from 'zod';
import { OpeningTimerFields, OpeningTimerActions } from '@/models/OpeningTimer';

// This package drops sponsors and adds a subtitle.
export const model = OpeningTimerFields.omit({ sponsors: true }).extend({
  subtitle: z.string().max(60).optional(),
});

export const actions = OpeningTimerActions;
export type Data = z.infer<typeof model>;
```

A package can also use a shared model unchanged (`export const model = LowerThirdFields`), and a title with nothing to start or stop — a lower-third — still exports `actions`, just as `[] as const`.

### `index.tsx` — the React component

```tsx
// projects/atl/titles/lower-third/index.tsx
import type { LowerThirdData } from './model';
import styles from './LowerThird.module.scss';

export default function LowerThird({ data }: { data: LowerThirdData }) {
  return (
    <div className={styles.root}>
      <span className={styles.name}>{data.playerName}</span>
      {data.teamName && <span className={styles.team}>{data.teamName}</span>}
    </div>
  );
}
```

```scss
// projects/atl/titles/lower-third/LowerThird.module.scss
.root {
  position: fixed;
  bottom: 4rem;
  left: 4rem;
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-secondary);
  border-left: 4px solid var(--color-primary);
}

.name {
  font-family: var(--font-display);
  font-size: 3rem;
  color: #fff;
}

.team {
  font-family: var(--font-body);
  font-size: 1.25rem;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

A title:
- Receives a single `data` prop, typed as the inferred `z.infer<typeof model>`.
- Renders absolutely-positioned content (it sits over a transparent OBS browser source).
- Uses **only SCSS modules** (`.module.scss`) and CSS variables — never raw font-family strings, never inline hex colors, never MUI.

### `settings.ts` — presentation settings

Where `model.ts` describes the **data** the operator types, `settings.ts` describes how the overlay **presents** — its picker thumbnail, its enter/exit stinger animations, its background and video bed, its accent color, and whether it's a full-screen splash. These are **author-time** values (set by the developer, not the operator), so the broadcast renderer reads them from the registry by `titleKey` — they never travel in the SSE payload.

```ts
// projects/TCG/titles/lower-third/settings.ts
import type { TitleSettings } from '@/lib/titles/types';

export default {
  title_name: 'Lower Third',              // operator-facing label in the Overlays picker
  title_preview: 'lower-third.png',       // thumbnail — file in <package>/assets/titles/previews/
  title_color: 'red',                     // 'red' | 'green' | 'blue' | 'yellow' — accent / category tag in the UI
  title_is_full_screen: false,            // true → full-screen splash animation, shown before the content overlay
  title_stinger_in: 'lt-in.webm',         // enter transition — file in <package>/assets/titles/videos/
  title_stinger_out: 'lt-out.webm',       // exit transition — file in <package>/assets/titles/videos/
  title_background: 'lt-bg.webm',         // background bed — file in <package>/assets/titles/backgrounds/
  title_video: 'lt-loop.webm',            // foreground/loop video — file in <package>/assets/titles/videos/
} satisfies TitleSettings;
```

```ts
// lib/titles/types.ts
export type TitleColor = 'red' | 'green' | 'blue' | 'yellow';

export type TitleSettings = {
  title_name: string;
  title_preview?: string;        // filename in <package>/assets/titles/previews/
  title_color?: TitleColor;
  title_is_full_screen?: boolean;
  title_stinger_in?: string;     // filename in <package>/assets/titles/videos/
  title_stinger_out?: string;    // filename in <package>/assets/titles/videos/
  title_background?: string;     // filename in <package>/assets/titles/backgrounds/
  title_video?: string;          // filename in <package>/assets/titles/videos/
};
```

**The media fields are dropdowns sourced from the package's asset folders**, not free text:

| Setting | Picked from |
|---|---|
| `title_stinger_in`, `title_stinger_out`, `title_video` | `projects/<label>/assets/titles/videos/` |
| `title_background` | `projects/<label>/assets/titles/backgrounds/` |
| `title_preview` | `projects/<label>/assets/titles/previews/` |

These folders are copied to `public/projects/<label>/assets/titles/...` by the asset sync ([projects-system.md](./projects-system.md#static-asset-pipeline)), so the renderer builds URLs like `/projects/${label}/assets/titles/videos/${settings.title_stinger_in}`.

**How the broadcast pages use it** (see [preview-air.md](./preview-air.md#applying-overlay-settings)): on AIR the renderer plays `title_stinger_in`, shows the overlay over its `title_background` / `title_video` bed, and plays `title_stinger_out` on HIDE. When `title_is_full_screen` is true the overlay occupies the whole 1920×1080 canvas as a splash before/around the content. `title_color` is a UI affordance only (it tags the overlay in the operator's picker and list); it does **not** restyle the rendered graphic — brand colors still come from `project.css` variables.

### Contract reconciliation: what the registry actually composes

`settings.ts` default-exports **presentation only** — it does not also carry `model`/`actions`, despite what an earlier sketch of this doc showed. The full title entity, `{ Component, model, actions, settings }`, is composed by the **registry** ([below](#how-titles-are-discovered)), not read from any single file. Presentation stays a plain object validatable by one Zod schema (`titleSettingsSchema`), and consumers go through `getTitleEntry()`/`getTitleModel()`/`getTitleActions()` rather than importing a title's `model.ts` or `settings.ts` directly.

## Styling rules

1. **SCSS modules only.** MUI is not available inside title components. Each title imports its own `*.module.scss` sibling; there is no Tailwind in this repo.
2. **Brand colors and fonts come from CSS variables defined in `project.css`.** Consume them directly with `var(…)` — `font-family: var(--font-display)`, `color: var(--color-primary)`. Never `style={{ color: '#ff4d2e' }}`, never a literal hex in the SCSS.
3. **Position absolutely.** Titles render onto a transparent canvas. Use `fixed inset-0`, `absolute`, or specific corners (`fixed bottom-16 left-16`). Avoid `flex`/`grid` layout at the root — there's no parent container to flex against in OBS.
4. **`font-display: block` is set in `project.css`** so titles never paint with a fallback font in broadcast.
5. **Stay self-contained.** A title may import its own subcomponents from the same folder, but **never** from outside `projects/<slug>/titles/<this-title>/`. That keeps title boundaries clean and makes it safe to copy a title between projects.

See [projects-system.md](./projects-system.md#font-pipeline) for the font and CSS-variable wiring.

## How titles are discovered

Discovery is **build-time codegen, not a runtime scan**. Neither Vite's `import.meta.glob` (Vite-only) nor webpack's `require.context` (webpack-only) works under **both** Turbopack (`next dev` / `next build`) and Vitest, so a plain Node script walks the filesystem once and emits static imports instead:

```
scripts/generate-title-registry.ts     # thin IO shell — writes the file
  → lib/titles/codegen.ts              # scanTitleDirs() + buildRegistrySource() — the testable logic
  → lib/titles/generated.ts            # AUTO-GENERATED — one static import per title; do not edit
  → lib/titles/registry.ts             # runtime accessors, indexed by (packageLabel, titleKey)
```

`scanTitleDirs()` walks `projects/*/titles/*` and **skips any folder missing one of the three required files** (`index.tsx`, `model.ts`, `settings.ts`) — a half-written title is silently excluded from the build rather than crashing it. `npm run titles:generate` runs automatically via `predev`/`prebuild` ([projects-system.md](./projects-system.md#static-asset-pipeline)); **adding, renaming, or removing a title requires re-running it** (restarting `npm run dev` does this for you, since it runs `predev` first).

```ts
// lib/titles/types.ts (shipped)
export type TitleEntry = {
  key: string                                    // folder name (e.g., 'lower-third')
  packageLabel: string                           // overlay-package folder it belongs to
  Component: ComponentType<TitleProps<never>>
  model: z.ZodTypeAny
  actions: readonly string[]                     // from the composed model.ts
  settings: TitleSettings                        // from settings.ts, Zod-validated at codegen time
}
```

```ts
// lib/titles/registry.ts (shipped) — accessors built once from generated.ts
export function getTitleEntry(packageLabel: string, titleKey: string): TitleEntry | undefined
export function getTitleModel(packageLabel: string, titleKey: string)
export function getTitleActions(packageLabel: string, titleKey: string): readonly string[]
export function isDeclaredAction(packageLabel: string, titleKey: string, action: string): boolean
export function listTitles(packageLabel: string): TitleEntry[]   // sorted by title_name
```

The registry is consulted in three places:

| Caller | Use |
|---|---|
| Admin "Add to rundown" modal (Screenshot 5) | `listTitles()` — available titles for the current package. |
| API mutation handler | `getTitleModel()` to validate `data` before writing; `isDeclaredAction()` to 400 an unknown `/command` action ([database.md](./database.md)). |
| Broadcast page (`/preview`, `/air`) | `getTitleEntry(...).Component` — render with the SSE payload. |

## Adding a new title

```bash
# 1. Create the folder
mkdir -p projects/TCG/titles/sponsor-bug

# 2. Write (or reuse) the shared model, then compose it
$EDITOR models/SponsorBug.ts                        # if this is a new title type
$EDITOR projects/TCG/titles/sponsor-bug/model.ts     # composes via .omit()/.extend(), re-exports actions

# 3. Write the component
$EDITOR projects/TCG/titles/sponsor-bug/index.tsx

# 4. Write the settings (preview, stingers, color, bg/video, full-screen)
$EDITOR projects/TCG/titles/sponsor-bug/settings.ts

# 5. Regenerate the registry (npm run dev / npm run build do this automatically via predev/prebuild)
npm run titles:generate
```

**No database migration is needed.** Title data lives in `rundown_items.data jsonb`, validated against `model.ts` at the API boundary. See [database.md](./database.md#migrations-vs-project-creation-vs-overlay-packages).

## Editing a title's model

You may freely add **optional** fields to a title's model. **Removing** or **type-narrowing** existing fields is a breaking change for any rundown that already has data for that title — the API will reject the row on next read.

Migration strategy:
1. Add the new field as `.optional()` with a sensible default in the component.
2. Backfill existing `rundown_items.data` rows via a one-off SQL update (`UPDATE rundown_items SET data = data || '{"newField": "default"}' WHERE title_key = 'lower-third' AND data->>'newField' IS NULL`).
3. Tighten the schema in a follow-up commit if needed.

## Testing a title in isolation

Until the rundown editor wraps everything, you can mount a title against a hand-rolled payload:

```tsx
// app/dev/title-preview/page.tsx (DEV ONLY)
import LowerThird from '@/projects/atl/titles/lower-third';

export default function Preview() {
  return (
    <>
      <link rel="stylesheet" href="/projects/atl/styles/project.css" />
      <LowerThird data={{ playerName: 'Casey Liu', teamName: 'Boom Squad' }} />
    </>
  );
}
```

Visit `http://localhost:3000/dev/title-preview` to iterate visually. The page 404s in
production via a `NODE_ENV` guard — it lives under `app/dev/` rather than `app/_dev/`
because Next's private-folder convention (`_`-prefixed folders) excludes the whole
subtree from routing, so an underscore-prefixed page can never resolve as a URL.

## Anti-patterns

- **`import { Button } from '@mui/material'` inside a title.** MUI is for admin only.
- **`style={{ fontFamily: 'ATLDisplay' }}`.** Use `className="font-display"` so the project can re-skin without touching the title.
- **Reading from a Redux store in a title.** Titles receive everything as the `data` prop. The broadcast pages are pure functions of `(titleKey, data)`.
- **Fetching data inside a title.** All data flows through SSE; titles do not make their own network calls.
- **`use client` is unnecessary.** Title components are rendered on the client by the broadcast page (`'use client'` at the page level), but the title file itself should be plain TSX.
