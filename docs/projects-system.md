# Tournaments & Overlay Organization

> This doc used to describe an "overlay package folder vs. UI-created project" duality. **That model does not exist in the real system and has been removed.** Projects are tournaments; overlays are global. This file now describes both.

## Projects are tournaments

A **project is a tournament** — a record from the weplay `tournament-management-service`, absorbed into the monolith as a `projects` row (see [database.md](./database.md#2-tournaments-a-project--favourites)). The operator does **not** create projects; they:

- **Browse** the tournament gallery at `/projects` (filterable by `status`: `draft` / `upcoming` / `ongoing` / `ended`),
- **Favourite** tournaments (a per-operator sidebar), and
- **Enter** one to open its **Data / Overlays / MIDI / Bluetooth** workspace.

A tournament carries `title`, a `status`, and **`overlayPacks`** — a `text[]` of pack (folder) names. It is **authored in-app**: create / edit / delete from the gallery (`POST`/`PATCH`/`DELETE /api/projects`). There is no `project_mode`, `project_label`, hero image, discipline, or label tags — the `tags`/`project_tags` tables were removed.

## Overlays are global, organized by pack / template

Overlay components are **not** bundled per tournament. They live in one global tree, organized by **pack (a top-level folder = the overlay's `category`)** then **template (widget)**:

```
overlays/
├── GGL/                         # pack = category (top-level folder)
│   ├── Scoreboard/              # template = widget
│   │   ├── index.tsx            # the React component
│   │   ├── model.ts             # widget schema (operator-editable fields)
│   │   ├── settings.ts          # presentation: preview image, animations, mixers, colors
│   │   ├── animationIn.ts       # GSAP enter timeline
│   │   ├── animationOut.ts      # GSAP exit timeline
│   │   └── Scoreboard.module.scss
│   ├── LowerThird/
│   │   └── …
├── MRI/                         # another pack
│   └── …
└── general/                     # just another pack — no special-casing
```

Each overlay's registry key is its kebab-cased `model` string (e.g. `ggl-scoreboard`) — the same key stored on `rundown_overlays.model` and used to look the overlay up at render time. The **pack names** available to attach are derived from this tree by `listCategories()` (the codegen already scanned it), so adding `overlays/MRI/…` makes `MRI` a selectable pack after `titles:generate`. See [titles-system.md](./titles-system.md) for the per-overlay file contract and discovery.

### Which overlays a tournament can use

A tournament's **`overlayPacks`** is a set of pack (folder) names. The rundown editor's picker offers exactly the overlays whose **`category` ∈ `overlayPacks`** (`listOverlays(project.overlayPacks)`). There is **no `general` fallback** — an empty `overlayPacks` shows zero titles. The pack multi-select in the tournament form is populated from `listCategories()`.

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
| Tournament (title, status, `overlayPacks[]`) | Database (`projects`) | Authored in-app (CRUD) |
| Players, teams, talents, sponsors, matches, themes, assets | Database, `project_id`-scoped | Absorbed entity services; edited in the Data section |
| Rundowns, overlays, and their per-instance data | Database | Edited in the Overlays editor; `data.widget` is JSONB. The rundown's public `uuid` is its broadcast address |
| Live on-air / preview state | In-process bus (transient) | Broadcast is addressed by the rundown `uuid`; no display entity. On-air state is never persisted |

## Common pitfalls

- **Assuming per-tournament overlay packages.** Overlays are global; a tournament selects packs by folder name (`overlayPacks`), it does not own a folder.
- **Hardcoding theme colors.** Colors come from the active theme at runtime via CSS variables — never inline a hex in overlay SCSS.
- **`font-display: swap` on a broadcast page.** Acceptable in admin, never in `/preview` / `/air`.
