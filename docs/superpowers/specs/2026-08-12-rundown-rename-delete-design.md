# Rundown Rename/Delete — Design

**Date:** 2026-08-12
**Status:** Approved for planning

## Goal

Close the gap left by the previous rundowns pass: wire up rename (`PATCH`) and delete (`DELETE`) for a rundown, on both the rundowns list page and the stub detail page. Full rundown data-model and controller spec: [docs/rundowns.md](../../rundowns.md). Prior pass: [2026-08-12-workspace-nav-and-rundowns-list-design.md](./2026-08-12-workspace-nav-and-rundowns-list-design.md), which explicitly deferred this ("routes exist on the CRUD factory but aren't wired to the UI or exported").

## Architecture

### 1. API route

`app/api/projects/[projectId]/rundowns/[id]/route.ts` keeps its existing hand-written `GET` (single row by `projectId` + `id`, already tested in `test/app/api/rundowns-id.test.ts`) and adds:

```ts
export const { PATCH, DELETE } = createCrudHandlers({ table: rundowns, createSchema: createRundownSchema, updateSchema: updateRundownSchema })
```

Same one-line pattern as `app/api/projects/[projectId]/teams/[id]/route.ts` and `players/[id]/route.ts`. Session-gated, scoped by `projectId` + `id` (`and(eq(table.id, id), eq(table.projectId, projectId))`), 404 if no row matches, `updatedAt` bumped by the factory automatically. `updateRundownSchema` already exists (`createRundownSchema.partial()`) — no schema change needed.

### 2. Client state

`store/apis/rundownsApi.ts`: `createEntityApi` already defines `updateRundown`/`deleteRundown` mutations (unused so far). Export the corresponding hooks, matching how `useCreateRundownMutation` is already exported:

```ts
export const useUpdateRundownMutation = hooks.useUpdateRundownMutation
export const useDeleteRundownMutation = hooks.useDeleteRundownMutation
```

Both mutations already `invalidatesTags` for the single-row tag and the project's list tag (`createEntityApi.ts`), so list and stub views re-render without manual refetch logic.

### 3. Rundowns list page (`app/admin/[projectId]/rundowns/page.tsx`)

Each `Card` gets a `⋮` `IconButton` (top-right corner, `stopPropagation` so it doesn't trigger the card's `CardActionArea` navigation) opening an MUI `Menu` with **Rename** and **Delete** items.

- **Rename**: opens a `Dialog` with a `TextField` prefilled with the card's current `name` (mirrors the existing "Add Rundown" dialog already in this file). Submit calls `useUpdateRundownMutation({ projectId, id, data: { name } })`, same `.unwrap()` / try-catch / `getErrorMessage` → `Alert` pattern as `handleCreate`, same `disabled={!name.trim() || isLoading}` guard.
- **Delete**: opens a confirm `Dialog` — "Delete '<name>'? This can't be undone." with Cancel/Delete buttons. Submit calls `useDeleteRundownMutation({ projectId, id })`, same error-surfacing pattern. On success the dialog closes; the card disappears via cache invalidation (no manual list update needed).
- Local state needed: which rundown is targeted by the open menu/dialog (e.g. `const [menuTarget, setMenuTarget] = useState<Rundown | null>(null)`, reused to seed both the rename and delete dialogs) plus the existing per-dialog `open`/`name`/`error` state, one set per dialog.

### 4. Rundown stub page (`app/admin/[projectId]/rundowns/[rundownId]/page.tsx`)

Same Rename/Delete affordance, placed next to the rundown name in the header (icon buttons, or a `⋮` `Menu` for consistency with the list page — implementer's choice, whichever reads cleaner next to a single `Typography variant="h4"`). Same two dialogs (rename pre-filled with `rundown.name`, delete confirm with `rundown.name`), same mutations. Only the current rundown is ever targeted, so no "which row" state is needed here — just `open`/`name`/`error` per dialog.

On successful delete, `router.push('/admin/${projectId}/rundowns')` (via `useRouter` from `next/navigation`) instead of leaving the operator on a now-404ing page.

## Data model & API

No schema or migration changes — `rundowns` table, `createRundownSchema`/`updateRundownSchema`, and the CRUD factory all already exist. This pass only exports handlers and hooks that were already defined but unused.

## Testing

- No new automated tests. `createCrudHandlers`'s `PATCH`/`DELETE` behavior (401/404/200/204, `projectId` scoping) is already covered generically in `test/lib/crud/createCrudHandlers.test.ts`; no other entity route (`teams`, `players`) duplicates that coverage per-route, so `rundowns` won't either. The existing `GET`-only tests in `test/app/api/rundowns-id.test.ts` stay as-is.
- No component tests for the list or stub page changes — consistent with every other admin page in this codebase (no component tests exist for `/admin`, `/login`, the Data hub, or the current rundowns pages).
- Manual verification pass at the end (`npm run dev`):
  1. From the rundowns list, open a card's `⋮` menu → Rename → change the name → confirm the card updates in place without a manual refresh.
  2. From the rundowns list, `⋮` menu → Delete → confirm → card disappears from the list.
  3. Open a rundown's stub page → Rename via the header control → confirm the heading updates.
  4. From the stub page, Delete via the header control → confirm redirect back to `/admin/[projectId]/rundowns` and the rundown no longer appears.
  5. Cancel out of both dialogs (rename and delete) on both pages → confirm no request is sent and no state changes.
  6. Attempt rename with an empty name → confirm the submit button stays disabled (same guard as create).

## Out of scope for this pass

- Any UI for cascading `rundown_items` deletion (none exist yet — the rundown editor isn't built).
- Undo / soft-delete.
- Type-to-confirm on delete (a simple confirm dialog was chosen instead, consistent with the low stakes of an empty-editor rundown).
- Any change to the rundown editor, broadcast bus, or `/preview`/`/air` pages — untouched by this pass.
