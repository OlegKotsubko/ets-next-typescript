# Titles / Overlays System

An **overlay** (historically "title") is a React component that renders one broadcast graphic — a lower-third, scoreboard, player card, sponsor bug, timer, bracket. Overlays are **global**, organized by **discipline (category) / template (widget)** (see [projects-system.md](./projects-system.md#overlays-are-global-organized-by-discipline--template)); the same component renders in the operator preview (`/preview`) and on air (`/air`). The etalon ships **277 overlays across 27 disciplines**.

> **Terminology.** "Overlay" and "title" are the same thing. Each overlay's registry key is its kebab-cased **`model`** string (e.g. `ggl-scoreboard`), stored on `rundown_overlays.model` and used to look the component up at render time.

## Anatomy of an overlay

Each overlay is a folder under `overlays/<CATEGORY>/<TEMPLATE>/`:

```
overlays/GGL/Scoreboard/
├── index.tsx          # the React render component (data prop only)
├── model.ts           # the widget schema — operator-editable fields
├── settings.ts        # presentation: model key, preview image map, color, full-screen, mixers
├── animationIn.ts     # GSAP enter timeline
├── animationOut.ts    # GSAP exit timeline
└── Scoreboard.module.scss
```

### `model.ts` — the widget schema

The Zod schema describes every field the operator can edit for this overlay. It is used in two places:

1. **The admin edit form** — the schema is serialized to plain-JSON **field descriptors** (the "widget schema") that the operator form renders from.
2. **Server-side validation** — writes to `rundown_overlay_data.data.widget` are validated against the schema at the API boundary (on save).

> The SSE payload is **not** re-validated against `model.ts` — the server assembles and pushes the render payload; the renderer draws it. (An earlier version of this doc claimed three-point validation including SSE; that was wrong.)

Each field carries the widget-schema attributes the real system exposes at `GET {model}/{id}/widget`:

```ts
// the descriptor each field serializes to
type FieldDescriptor = {
  input_type: 'text' | 'number' | 'select' | 'selectmulti' | 'checkbox' | 'list_object';
  label: string;
  required: boolean;
  default?: unknown;
  choices?: [value: string, label: string][];   // for select / selectmulti
  can_live_update: boolean;                       // may this field change while on air?
};
```

`can_live_update` is load-bearing: the controller disables non-live fields once an overlay is on air, and only live fields are sent on a `live_update` (see [rundowns.md](./rundowns.md#edit-while-on-air)).

```ts
// overlays/general/Text/model.ts
import { z } from 'zod';

export const model = z.object({
  text: z.string().default('Text sample'),        // input_type 'text', can_live_update true
});

// Declared thread-widget actions (buttons the controller shows for this overlay);
// universal actions (air/preview/hide/update) are implicit and never listed.
export const actions = ['next'] as const;

export type Data = z.infer<typeof model>;
```

**Shared field/action contracts** live once in top-level `models/<Type>.ts` (e.g. `OpeningTimerFields` + `OpeningTimerActions = ['start','stop','reset']`); an overlay's `model.ts` composes them with `.omit()`/`.extend()` and re-exports `actions`.

### `index.tsx` — the render component

```tsx
// overlays/GGL/Scoreboard/index.tsx
import styles from './Scoreboard.module.scss';

export default function Scoreboard({ data }: { data: ScoreboardData }) {
  // data.widget = operator-edited fields; data.match / data.participants / data.sponsors = collected payload
  return <div className={styles.root}>{data.widget.title_text}</div>;
}
```

An overlay:
- Receives a single `data` prop = `{ widget, …collected }` (its edited fields plus the server-collected render context — match, participants, sponsors, tournament logo).
- Renders absolutely-positioned content onto a transparent 1920×1080 canvas.
- Uses **only SCSS modules + CSS variables** — never raw hex, never MUI. Theme colors come from the active tournament theme at runtime ([projects-system.md](./projects-system.md#theming)).

### `settings.ts` — presentation

Author-time presentation, read from the registry by `model` key (never in the SSE payload): the `model` string, a `preview` thumbnail map (keyed by theme), the UI `color`, whether it's a full-screen splash, and its default background/mixer beds.

```ts
// overlays/GGL/Scoreboard/settings.ts
export default {
  model: 'ggl-scoreboard',
  preview: { default: 'scoreboard.png' },   // thumbnail(s) in the picker
  color: 3,                                  // 1..7 UI tag color
  is_fullscreen: false,
};
```

### Animations & mixers

Each overlay ships **GSAP** enter/exit timelines (`animationIn.ts` / `animationOut.ts`) keyed off the render's `onShow` flag: enter on show, exit-then-clear on hide. Video **stinger mixers** (`in_mixer` / `out_mixer` / `inner_mixer` on the `rundown_overlays` row) are composited around the reveal, and a `play_mixer` event plays a full-screen stinger over the whole canvas. See [preview-air.md](./preview-air.md#stingers--mixers).

## Styling rules

1. **SCSS modules only** — no MUI, no Tailwind, no inline hex.
2. **Colors/fonts from CSS variables** written by the active theme (`var(--color-primary)`, `var(--font-display)`).
3. **Position absolutely** onto the transparent canvas (`fixed`, corners) — no root flex/grid.
4. **`font-display: block`** so a broadcast frame never paints a fallback font.
5. **Self-contained** — an overlay imports only from its own folder.

## Discovery & registry

Overlays are discovered into a registry keyed by `model`. The etalon uses `require.context` over `overlays/`; the monolith uses **build-time codegen** (a Node script emits static imports), because neither `import.meta.glob` nor `require.context` works under both Turbopack and Vitest. The registry composes each overlay's `{ Component, model, actions, settings }` and is consulted by: the "add overlay" picker (`listOverlays()` filtered by discipline), the API validator (`getOverlayModel()` to validate `data.widget`; `isDeclaredAction()` to reject an unknown thread-widget action), and the broadcast pages (`getOverlay().Component`).

## Adding a new overlay

1. `mkdir overlays/<CATEGORY>/<TEMPLATE>/`.
2. Write (or reuse) the shared model in `models/`, then compose `model.ts` and re-export `actions`.
3. Write `index.tsx` (+ `.module.scss`), `settings.ts`, `animationIn.ts` / `animationOut.ts`.
4. Regenerate the registry (`npm run titles:generate`, run automatically by `predev`/`prebuild`).

**No migration** — overlay config lives in `rundown_overlay_data.data.widget`.

## Editing an overlay's model

Adding **optional** fields is safe. Removing/narrowing a field breaks existing `data.widget` for that overlay; add-optional → backfill → tighten, as usual.
