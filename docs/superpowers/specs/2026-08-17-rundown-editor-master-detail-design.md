# Rundown Editor — Master-Detail Upgrade (Design)

**Date:** 2026-08-17
**Status:** Approved (design), pending plan
**Pass:** Editor upgrade (Pass 1 of "titles → rundown, then controller"). The
**broadcast + controller** subsystem is a **separate later design cycle** and is
out of scope here.

## Goal

Turn the current dialog-based overlay editor into a **master-detail two-pane
editor** with **preview thumbnails** and a **color filter**, matching the etalon
(`ets-react-poc`) editing experience. Frontend-only: **no schema or API
changes.**

## Context

The overlays pass shipped a working editor at
`app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`. It already does
add / configure (RHF + `zodResolver`) / reorder / delete against
`rundown_overlays`. Two problems and one UX gap:

1. **The editor is unreachable.** The Rundowns list
   (`app/(admin)/projects/[projectId]/rundowns/page.tsx`) has a stale comment
   ("editor + controller are rebuilt in a later pass") and its cards **do not
   link into the editor** — you can create a rundown but can't open it to add
   titles.
2. **The editing UX is modal.** Adding uses an "Add Overlay" dialog; configuring
   uses an "Edit" dialog. The etalon instead uses a persistent two-pane
   master-detail layout.
3. **Cards are text-only.** No preview thumbnail, no color stripe, no color
   filter.

The etalon reference is `src/pages/rundown/Rundown.js` +
`src/components/RundownOverlay/*` (Listing / Card / Form / TemplateChoiceForm /
PropertyChoiceForm / ColorFilter).

## Scope

**In:**
- Master-detail two-pane layout replacing both modal dialogs.
- Preview thumbnails on overlay cards (with graceful fallback).
- A color (1–7) filter over the listing.
- Fix the stale comment and add the **Rundowns-list → editor** link.

**Out (explicitly):**
- **Drag-and-drop reorder** — keep the existing up/down-arrow reorder (writes the
  existing reorder route). No new dnd dependency.
- **Any schema/API change** — the data already carries `layer`, `color`,
  `display_filter`, `previewImg`, and the mixer fields; the reorder route exists.
- **Broadcast + controller** (displays, SSE bus, `/preview`+`/air`,
  `rundown_overlay_data`, the controller UI) — separate later pass.

## Approach (chosen: A — in-place refactor)

Rewrite the editor page into a two-pane layout, extract focused components, and
**reuse the existing create-on-pick API, RTK hooks, `OverlayWidgetForm`, and the
up/down reorder route unchanged.** Rejected alternative B (porting the etalon
components literally with a Redux "edit mode" slice + `react-beautiful-dnd`)
because it adds a Redux slice and a drag-drop lib we deliberately dropped, for no
functional gain.

## Component structure

```
app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx
    ← rewrite: owns selection + color-filter state and the data hooks;
      renders the two-pane grid (left listing / right detail pane)

components/admin/overlays/
  RundownOverlayListing.tsx  ← left: header, OverlayColorFilter, ordered
                               OverlayCards, "Add overlay" button
  OverlayCard.tsx            ← one row: thumbnail, color stripe, widgetName,
                               category badge, L{layer}/display chips, selected
                               highlight, up/down + delete controls
  OverlayColorFilter.tsx     ← color 1–7 toggle chips (empty set = show all)
  OverlayTemplateGrid.tsx    ← right-pane default: catalog grid (thumbnail +
                               name), click to add
  OverlayPropertiesForm.tsx  ← right-pane when an overlay is selected: settings
                               fields + widget fields + Save/Delete
  OverlayWidgetForm.tsx      ← REUSED unchanged (widget fields sub-form)
```

Page state is just: `selectedId: number | null` and `activeColors: Set<number>`.

## Behavior

### Left pane — listing (`RundownOverlayListing` + `OverlayCard`)
- Header: title + `OverlayColorFilter`. The filter is **client-side** over the
  already-loaded overlays; an empty active-set shows all.
- `OverlayCard`: `previewImg` thumbnail (128×72) with a **labeled fallback box**
  when `previewImg` is empty/absent (mirrors the etalon's "No image for {name}");
  a left **color stripe** (color 1–7 → a fixed theme swatch); `widgetName`; a
  category badge; `L{layer}` and (when set) `display {n}` chips. The selected
  card shows a highlighted border.
- Reorder: up/down arrows per card, calling the existing
  `useReorderRundownOverlaysMutation`. Delete: per card, existing
  `useDeleteRundownOverlayMutation`.

### Right pane — add ↔ configure
Driven by `selectedId`:
- **`selectedId === null` → `OverlayTemplateGrid`.** Shows the catalog for the
  tournament's discipline + `general` (`listOverlays(disciplineName)`) as
  thumbnail cards (same fallback rule). Clicking one calls the existing
  `createOverlay` (creates the row with the registry default widget), then
  **auto-selects the new overlay** using the id the POST returns, so the pane
  flips straight to that overlay's properties form. An **"Add overlay"** button
  in the listing returns the pane to this grid (`selectedId = null`).
- **`selectedId` set → `OverlayPropertiesForm`.** Renders settings (name, layer,
  color, display_filter, full-screen) **+** the widget fields (`OverlayWidgetForm`)
  **+ Save / Delete**. Two existing save paths, unchanged:
  `updateOverlay(... {settings})` and the widget-form submit `updateOverlay(...
  {widget})`. Delete returns the pane to the template grid.

### Rundowns list fix
- Remove the stale "rebuilt in a later pass" comment.
- Make each rundown card open the editor
  (`/projects/[projectId]/rundowns/[rundownId]`) — a card click / link — while
  keeping the existing rename/delete menu.

## Thumbnails & fallback

Preview images are largely **absent** today (sample overlays set no `preview`;
`public/projects/default/assets/titles/previews/` is empty). Both the listing
card (from row `previewImg`) and the template grid (from `CatalogEntry.preview`)
must render a **labeled placeholder box** when no image resolves — never a broken
`<img>`. This is the same graceful path the etalon uses.

## Data & API

**Unchanged.** Same RTK hooks (`useListRundownOverlaysQuery`,
`useCreateRundownOverlayMutation`, `useUpdateRundownOverlayMutation`,
`useDeleteRundownOverlayMutation`, `useReorderRundownOverlaysMutation`), same
routes, same `rundown_overlays` shape. No migration.

## Testing

Vitest + React Testing Library component tests:
- `OverlayColorFilter` / listing: toggling a color narrows the visible cards;
  empty active-set shows all.
- Selecting a card renders its `OverlayPropertiesForm` (settings + widget
  fields).
- Clicking a template in `OverlayTemplateGrid` calls `createOverlay`.
- `OverlayCard` / template card renders the **labeled fallback** when no preview
  image is present (no broken `<img>`).

Existing route/registry/db tests stay green. Gate: `npm run test`, `npm run lint`,
typecheck, `npm run build`.

## Non-goals / deferred

Drag-and-drop reorder; any broadcast/controller work; per-display
`rundown_overlay_data`; live preview render of the selected overlay inside the
editor (that belongs with the controller pass). A rundown-level header with the
rundown image (etalon `RundownOverlayHeader`) is optional polish, not required.
