# P5a — Rundown-item CRUD (design)

**Date:** 2026-08-13
**Status:** approved, ready for plan
**Depends on:** P1 (schema), P2 (auth), P3 (title registry), P4 (broadcast — for context only; P5a does not touch the bus).

## Goal

Let an operator open a rundown and **add / edit / reorder / delete title
items**, where each item's `data` is a form **generated from that title's
`model.ts`** and validated against the same schema at the API boundary. This
is the last authoring piece before the P5b controller can drive items on air.

## What already exists (do not rebuild)

- `/projects` gallery + `POST /api/projects` (validates `createProjectSchema`,
  checks `packageExists`) — shipped.
- Workspace `/projects/[projectId]` with **Data** / **Overlays** nav — shipped.
- Rundown list + full CRUD: route via `createCrudHandlers`, `rundownsApi` slice,
  list page, and the rundown **detail page** with rename/delete — shipped. The
  detail page ([app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx])
  is a **stub**: it hardcodes `0 items` and has no item UI.
- Title registry: `getTitleModel(label, key)`, `getTitleEntry`, `listTitles`,
  `getTitleActions`, `isDeclaredAction` (`lib/titles/registry.ts`), built from
  build-time codegen (`lib/titles/generated.ts`).
- Existing admin form convention: `CrudPage` + hand-written `EntityDef.fields`
  (`components/admin/crud/`). **P5a does not reuse this** — the title data form
  is Zod-schema-driven, a different shape — but it mirrors its stack (RHF +
  MUI + `zodResolver`).

## Scope decisions (locked)

1. **`layer` is deferred to P5b.** `rundown_items` has no `layer` column and
   P5a adds no migration — the roadmap promises "P3, P4, and P5a are
   migration-free" and P5b Task 1 already owns the `layer` migration. The spec's
   older "Add Template modal: Layer 0–10" line is superseded: the P5a modal
   collects **title + optional label** only. Position is server-assigned.
2. **No per-item `color` column.** `title_color` is author-time presentation in
   `settings.ts`. The modal/list show it as a read-only chip sourced from the
   title's settings; it is never stored on `rundown_items` (that too would need a
   migration). Deferred with layer.
3. **Reorder is IN P5a** (user-approved): up/down controls + a dedicated order
   endpoint. Cheap, useful for authoring; the one piece that was safe to cut.
4. **Data validation is server-authoritative.** The title's real Zod `model.ts`
   validates `data` on POST/PATCH. The client renders from serialized field
   **descriptors** and never re-parses against a forked schema copy — same
   principle as CLAUDE.md decision 3 (`model.ts` is the single source of truth)
   and decision 5 (SSE payloads aren't client-re-validated).

## Architecture

### Zod → descriptors (the crux)

Title models are server-only Zod objects. The client can't hold the Zod schema
for an arbitrary runtime-chosen `(packageLabel, titleKey)`, so the server
serializes each model into plain-JSON **field descriptors**.

`lib/titles/describeModel.ts`:

```ts
export type FieldDescriptor =
  | { name: string; label: string; kind: 'string'; required: boolean; minLength?: number; maxLength?: number; multiline?: boolean }
  | { name: string; label: string; kind: 'number'; required: boolean; int: boolean; min?: number; max?: number }
  | { name: string; label: string; kind: 'enum';   required: boolean; options: string[] }
  | { name: string; label: string; kind: 'boolean'; required: boolean }
  | { name: string; label: string; kind: 'stringArray'; required: boolean }

export function describeModel(model: z.ZodTypeAny): FieldDescriptor[]
```

- Iterates the top-level `ZodObject` shape.
- For each field, unwraps `ZodOptional` / `ZodDefault` / `ZodNullable` to find
  the inner type and whether it is `required` (present and not optional/defaulted).
- Reads bounds from the inner type's checks: string `min`/`max` → `minLength`/
  `maxLength`; number `min`/`max` + `int` flag; enum → `options`.
- `label` defaults to a humanized field name (e.g. `playerName` → "Player name").
- Unknown/unsupported inner kinds are **skipped** (not fatal) so a title with an
  exotic field still yields a usable form for the rest. Covered kinds are exactly
  those the shipped models use (`string`, `number`, `enum`, `boolean`,
  `array<string>`); anything else is out of P5a scope.

Zod-version note: the plan's implementer must confirm whether this project's Zod
exposes checks via `._def.checks` (Zod 3) or the newer internal shape, and write
`describeModel` against whatever `import { z } from 'zod'` actually resolves to
here — verified by the unit tests below, not assumed.

`defaults`: computed server-side per title as `model.safeParse({}).data ?? {}`
merged with per-kind fallbacks (`string`→`''`, `number`→its `min ?? 0`,
`enum`→first option, `boolean`→`false`, `stringArray`→`[]`) for required fields
that have no schema default, so a freshly-added item is immediately valid-ish and
its inputs are controlled from first render.

### Data layer

**`db/schemas/rundown-items.ts`**

```ts
import { z } from 'zod'

// `data` is validated dynamically against the title's model.ts at the API
// boundary (see the items route), so it is an open record here.
export const createRundownItemSchema = z.object({
  titleKey: z.string().min(1),
  label: z.string().max(120).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
})

// label and data are independently patchable; position moves via the order route.
export const updateRundownItemSchema = z.object({
  label: z.string().max(120).nullish(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const reorderRundownItemsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export type CreateRundownItemInput = z.infer<typeof createRundownItemSchema>
export type UpdateRundownItemInput = z.infer<typeof updateRundownItemSchema>
export type ReorderRundownItemsInput = z.infer<typeof reorderRundownItemsSchema>
```

`lib/entities/rundown-items.ts` — the `RundownItem` row type
(`{ id, rundownId, projectId, titleKey, label, position, data }`).

**Items API** — custom handlers (not `createCrudHandlers`, which only knows
`projectId` and a static schema). A shared helper resolves and guards context:

`lib/rundown-items/context.ts`:
```ts
// Verifies session, that the rundown exists and belongs to projectId, and
// returns the project's package label. Returns a Response (401/404) on failure.
async function loadItemsContext(req, projectId, rundownId):
  Promise<{ packageLabel: string } | Response>
```

`app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts`:
- **GET** → items for the rundown, ordered by `position`.
- **POST** → parse `createRundownItemSchema`; `loadItemsContext`;
  `model = getTitleModel(packageLabel, titleKey)` — missing → `400 {error:"unknown titleKey"}`;
  `model.safeParse(body.data)` — fail → `400` flattened; `position = (max
  position in rundown) + 1` (0 if empty); insert `{ rundownId, projectId,
  titleKey, label, position, data: parsed }`; `201`.

`app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/route.ts`:
- **PATCH** → `loadItemsContext`; load item, 404 unless its `rundownId` and
  `projectId` match the URL; if `data` present, re-validate against the item's
  own `titleKey` model → `400` on fail; apply `label`/`data`; return row.
- **DELETE** → same ownership guard; delete; `204`.

`app/api/projects/[projectId]/rundowns/[rundownId]/items/order/route.ts`:
- **PUT** → parse `reorderRundownItemsSchema`; verify every id belongs to this
  rundown+project and the set matches the rundown's current items exactly
  (reject partial/foreign sets → `400`); rewrite `position` to array index in
  one pass; return the reordered list.

**Titles endpoint** — `app/api/projects/[projectId]/titles/route.ts` (GET):
session; resolve project → `label`; return
`listTitles(label).map(t => ({ key, name: t.settings.title_name, color:
t.settings.title_color ?? null, isFullScreen: t.settings.title_is_full_screen,
fields: describeModel(t.model), defaults: computeDefaults(t.model) }))`.

### State (RTK Query)

- `store/apis/rundownItemsApi.ts` — nested path, hand-written (the
  `createEntityApi` factory assumes `/projects/:id/:base`). Endpoints:
  `listItems({projectId,rundownId})`, `createItem({projectId,rundownId,data})`,
  `updateItem({projectId,rundownId,itemId,data})`,
  `deleteItem({projectId,rundownId,itemId})`,
  `reorderItems({projectId,rundownId,orderedIds})`. Tags: `Item` +
  `{ type:'Item', id: 'LIST:'+rundownId }`; every mutation invalidates the list.
- `store/apis/titlesApi.ts` — `listTitles({projectId})` → the descriptors above.
- Register both reducers/middleware in the store (follow the existing pattern for
  `rundownsApi` in `store/`).

### UI

Rundown detail page (`rundowns/[rundownId]/page.tsx`) — replace the hardcoded
`0 items` block:
- Header keeps rundown name + rename/delete (unchanged).
- **Item list**, ordered by position. Each row: title name, `label`, a color
  chip from the title's settings, up/down buttons (disabled at ends,
  call `reorderItems` with the swapped order), delete, and an expand toggle.
- **Add Template** button → modal (MUI `Dialog`): a title `select` populated from
  `useListTitlesQuery` (option label = `name`, with a color swatch), optional
  `label` text field. Submit → `createItem` with `data = defaults` for the chosen
  title → the new row appears, expandable to edit.
- **Expanded row** renders `TitleDataForm`.

`components/admin/rundown/TitleDataForm.tsx`:
```ts
function TitleDataForm({
  fields,          // FieldDescriptor[]
  defaultValues,   // Record<string, unknown>
  onSubmit,        // (values) => Promise<{ fieldErrors?: Record<string,string[]> }>
  saving,
}): JSX.Element
```
- RHF `useForm({ defaultValues })`; one `Controller` per descriptor via a
  `renderField` switch: `string`→`TextField` (multiline when `maxLength` is
  undefined or `> 60`), `number`→`TextField type="number"`,
  `enum`→`select`, `boolean`→`Checkbox`, `stringArray`→a minimal add/remove list
  editor (mirroring the spirit of `ExtraMapField`, values only).
- Save calls `onSubmit`; if it returns `fieldErrors`, `setError` per field →
  MUI `helperText` badges. Light client required/min hints come from descriptors,
  but the server 400 is the authority.

## Testing

- **`describeModel`** (unit): each kind (`string` with min/max, `number`
  int+bounds, `enum` options, `boolean`, `array<string>`), plus
  optional/default/nullable unwrapping and the humanized label. Assert against
  both shipped models (`LowerThirdFields`, the opening-timer package's
  omit/extend model).
- **Items route** (integration against the test DB or mocked db, matching how
  existing route tests run): POST valid → 201 & persisted; POST bad `data` →
  400 flattened; POST unknown `titleKey` → 400; PATCH re-validates; item under a
  wrong `projectId`/`rundownId` → 404; POST auto-appends `position`; PUT `order`
  rewrites positions and rejects foreign/partial id sets.
- **`TitleDataForm`** (component/RTL): renders an input per descriptor; submit
  forwards values; a returned `fieldErrors` shows as a field badge.
- **Audit** (spec requirement): `grep -rn "00000000-0000" app lib` returns
  nothing — nothing hardcodes the seeded `default` project UUID.

## Acceptance (from the base-app-scope spec)

Create project → create rundown → **Add Template** picks a title → an item
persists with server-assigned position → editing its data validates against the
title's `model.ts` (bad input rejected with field badges, good input saved) →
reorder changes on-screen order and persists. No migration was added.

## Out of scope (P5b or later)

`layer` column + control, per-item color, driving items to `/preview`/`/air`
(the bus/TAKE path), drag-and-drop reorder, command/thread-widget buttons.
