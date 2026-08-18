# Tournaments & Overlay Organization

> This doc used to describe an "overlay package folder vs. UI-created project" duality. **That model does not exist in the real system and has been removed.** Projects are tournaments; overlays are global. This file now describes both.

## Projects are tournaments

A **project is a tournament** — a record from the weplay `tournament-management-service`, absorbed into the monolith as a `projects` row (see [database.md](./database.md#2-tournaments-a-project--favourites)). The operator does **not** create projects; they:

- **Browse** the tournament gallery at `/projects` (filterable by `status`: `draft` / `upcoming` / `ongoing` / `ended`),
- **Favourite** tournaments (a per-operator sidebar), and
- **Enter** one to open its **Data / Overlays / MIDI / Bluetooth** workspace.

A tournament carries `title`, a `hero_section` image, a `status`, a **`discipline`** (a tag), and any number of **label** tags. There is no `project_mode`, `project_label`, picture, or event date — those were invented. The `discipline` is load-bearing: it decides which overlays apply and how participants pair (team vs. player) in matches.

## Overlays are global, organized by discipline / template

Overlay components are **not** bundled per tournament. They live in one global tree, organized by **discipline (category)** then **template (widget)**:

```
overlays/
├── GGL/                         # category = discipline
│   ├── Scoreboard/              # template = widget
│   │   ├── index.tsx            # the React component
│   │   ├── model.ts             # widget schema (operator-editable fields)
│   │   ├── settings.ts          # presentation: preview image, animations, mixers, colors
│   │   ├── animationIn.ts       # GSAP enter timeline
│   │   ├── animationOut.ts      # GSAP exit timeline
│   │   └── Scoreboard.module.scss
│   └── LowerThird/
│       └── …
├── TCG/
│   └── …
└── general/                     # cross-discipline overlays (timer, sponsors, text, ticker, …)
```

The etalon ships **277 overlay definitions across 27 disciplines** (e.g. GGL, TCG, TNG, NFL-DRAFTS, MRI, VTUBER, plus a large `general`/cross-discipline set). Each overlay's registry key is its kebab-cased `model` string (e.g. `ggl-scoreboard`) — the same key stored on a `rundown_overlays.model` and used to look the overlay up at render time. See [titles-system.md](./titles-system.md) for the per-overlay file contract and discovery.

### Which overlays a tournament can use

When the operator adds an overlay to a rundown, the picker offers the overlays whose **category matches the tournament's discipline** plus the cross-discipline `general` set. Some overlays additionally declare an allowed participant type (team vs. player) that must match the tournament — the equivalent of the Django `allowed_project_type` check. There is no per-tournament "package selection" step.

## Theming

Brand look comes from the tournament's **active theme** (from `tournament-themes`), not from a per-package `project.css` file:

- A theme is `{ is_active, name, colors: [{ name, code }], assets: [id] }` ([data-entities.md](./data-entities.md#themes)). Exactly one theme per tournament is active.
- On `/preview` and `/air`, the active theme's colors are written to `document.documentElement` as CSS variables (`--<name>: <code>`) at runtime — the etalon does this in `useProjectTheme`.
- Overlay SCSS consumes those variables with `var(--…)`, so re-skinning a tournament is a data change (activate a different theme), not a code change.

```scss
// overlays/GGL/Scoreboard/Scoreboard.module.scss
.score {
  font-family: var(--font-display);
  color: var(--color-primary);   /* from the active theme, written to :root at runtime */
}
```

**Fonts** are static assets bundled with the overlay tree (served from `public/`), declared with `@font-face` and `font-display: block` (never `swap` — a broadcast frame must never paint a fallback font). There is no per-tournament font upload; fonts ship with the overlays.

## Assets & mixers

Per-tournament media — decor/background images, background loops, and stinger **mixer** videos — come from `tournament-assets` / `tournament-videos` (`asset_type: decor | background`, `video_type: mixer | background`). An overlay references them through its `settings.ts` (background bed) and its `rundown_overlays` mixer fields (`in_mixer` / `out_mixer` / `inner_mixer`). See [titles-system.md](./titles-system.md#settingsts--presentation) and [preview-air.md](./preview-air.md#stingers--mixers).

## File-system vs. database boundary

| Concern | Lives in | Why |
|---|---|---|
| Overlay components (React + widget model + settings + GSAP + SCSS) | File-system (`overlays/<category>/<template>/`) | Code; built and bundled |
| Fonts, static overlay assets | File-system (`public/`) | Static assets |
| Tournament (title, status, discipline, labels) | Database (`projects`) | Absorbed from TMS |
| Players, teams, talents, sponsors, matches, themes, assets | Database, `project_id`-scoped | Absorbed entity services; edited in the Data section |
| Rundowns, overlays, and their per-instance data | Database | Edited in the Overlays editor; `data.widget` is JSONB. The rundown's public `uuid` is its broadcast address |
| Live on-air / preview state | In-process bus (transient) | Broadcast is addressed by the rundown `uuid`; no display entity. On-air state is never persisted |

## Common pitfalls

- **Assuming per-tournament overlay packages.** Overlays are global; a tournament selects among them by discipline, it does not own a folder.
- **Hardcoding theme colors.** Colors come from the active theme at runtime via CSS variables — never inline a hex in overlay SCSS.
- **`font-display: swap` on a broadcast page.** Acceptable in admin, never in `/preview` / `/air`.
