# Overlays Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the global overlay component system + build-time registry, the `rundown_overlays` data + CRUD, and the rundown **editor**, so an operator can build and configure a rundown of overlays. Live broadcast stays deferred.

**Architecture:** Overlays are global React components under `overlays/<CATEGORY>/<TEMPLATE>/`, each declaring a Zod **widget schema** (via a `defineWidget` DSL that yields both the validator and JSON `FieldDescriptor`s). A build-time codegen emits two committed registries — a **catalog** (settings + model, server+client safe) and a **components** registry (index.tsx + GSAP). The editor lists overlays by discipline, configures each from its widget schema, and stores authored widget values inline on `rundown_overlays.data.widget`. A protected dev page renders overlays with sample data.

**Tech Stack:** Next 16 · React 19 · TS · Drizzle + Neon HTTP · Zod · React Hook Form · MUI (admin) · **SCSS modules + GSAP** (overlays) · RTK Query · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-overlays-pass-design.md`.

## Global Constraints

- **Overlays: SCSS modules + CSS variables only** — no MUI, no inline hex, no Tailwind; absolute positioning on a transparent 1920×1080 canvas; `font-display: block`.
- **`data.widget` validated against the overlay's `model.ts`** at the API boundary (create + patch), never re-validated in a render payload.
- **`defineWidget` is the single source** for a widget's Zod validator and its `FieldDescriptor[]`; `can_live_update` defaults **false**.
- **Registry split:** `lib/overlays/catalog.generated.ts` (no components — admin/API) and `lib/overlays/components.generated.ts` (index.tsx + GSAP — render only). Both **committed**; a test asserts they match a fresh generation.
- **Integer ids / `project_id` FK isolation** preserved; `rundown_overlays` carries a denormalized `project_id`.
- **`gsap` (`^3.11`)** added; `titles:generate` + `predev`/`prebuild` restored.
- Green `typecheck`/`lint`/`build`/`vitest` at Task 9. **`db:migrate` is run by the operator**, not the agent. Never touch `.env`.
- Deferred (broadcast pass): SSE bus, `/preview`·`/air`, `displayUuid`, `rundown_overlay_data`, controller, mixers/MIDI.

---

## File Structure

**New:** `lib/overlays/{widget-schema.ts,catalog.ts,render.ts,catalog.generated.ts,components.generated.ts}` · `scripts/generate-overlay-registry.ts` · `models/Timer.ts` · `overlays/general/{Text,Scoreboard,OpeningTimer,Intro}/{index.tsx,model.ts,settings.ts,animationIn.ts,animationOut.ts,*.module.scss}` · `db/schemas/rundown-overlays.ts` · `app/api/projects/[projectId]/rundowns/[id]/overlays/{route.ts,[overlayId]/route.ts,reorder/route.ts}` · `app/api/projects/[projectId]/route.ts` (single-project GET) · `store/apis/rundownOverlaysApi.ts` · `components/admin/overlays/OverlayWidgetForm.tsx` · `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx` · `app/(admin)/dev/overlays/page.tsx` · tests.

**Modified:** `db/schema.ts` (add `rundownOverlays`) · `store/index.ts` (register api) · `package.json` (gsap, titles:generate, predev/prebuild).

---

## Task 1: Widget-schema DSL (`defineWidget` + describeModel)

**Files:** Create `lib/overlays/widget-schema.ts`; Test `test/overlays/widget-schema.test.ts`.

**Interfaces:** Produces `FieldDescriptor`, field builders (`text`/`number`/`checkbox`/`select`/`selectMulti`/`listObject`), and `defineWidget(shape) → { model: ZodObject, fields: FieldDescriptor[] }`.

- [ ] **Step 1: Write `lib/overlays/widget-schema.ts`.**
```ts
import { z } from 'zod'

export type InputType = 'text' | 'number' | 'select' | 'selectmulti' | 'checkbox' | 'list_object'

export type FieldDescriptor = {
  name: string
  input_type: InputType
  label: string
  required: boolean
  default?: unknown
  choices?: [value: string, label: string][]
  can_live_update: boolean
}

type FieldSpec = { zod: z.ZodTypeAny; descriptor: Omit<FieldDescriptor, 'name'> }
type Common = { label?: string; required?: boolean; canLiveUpdate?: boolean }

function base(input_type: InputType, o: Common, extra: Partial<FieldDescriptor> = {}): Omit<FieldDescriptor, 'name'> {
  return { input_type, label: o.label ?? '', required: o.required ?? false, can_live_update: o.canLiveUpdate ?? false, ...extra }
}
function withPresence(zod: z.ZodTypeAny, o: Common & { default?: unknown }): z.ZodTypeAny {
  if (o.default !== undefined) return zod.default(o.default as never)
  if (!o.required) return zod.optional()
  return zod
}

export function text(o: Common & { default?: string } = {}): FieldSpec {
  return { zod: withPresence(z.string(), o), descriptor: base('text', o, { default: o.default }) }
}
export function number(o: Common & { default?: number } = {}): FieldSpec {
  return { zod: withPresence(z.coerce.number(), o), descriptor: base('number', o, { default: o.default }) }
}
export function checkbox(o: Common & { default?: boolean } = {}): FieldSpec {
  return { zod: withPresence(z.coerce.boolean(), o), descriptor: base('checkbox', o, { default: o.default }) }
}
export function select(o: Common & { choices: [string, string][]; default?: string }): FieldSpec {
  const values = o.choices.map((c) => c[0]) as [string, ...string[]]
  return { zod: withPresence(z.enum(values), o), descriptor: base('select', o, { default: o.default, choices: o.choices }) }
}
export function selectMulti(o: Common & { choices: [string, string][]; default?: string[] }): FieldSpec {
  const values = o.choices.map((c) => c[0]) as [string, ...string[]]
  return { zod: withPresence(z.array(z.enum(values)), o), descriptor: base('selectmulti', o, { default: o.default, choices: o.choices }) }
}
export function listObject(o: Common & { fields: Record<string, FieldSpec>; default?: unknown[] }): FieldSpec {
  const shape = Object.fromEntries(Object.entries(o.fields).map(([k, v]) => [k, v.zod]))
  return { zod: withPresence(z.array(z.object(shape)), o), descriptor: base('list_object', o, { default: o.default }) }
}

function humanize(name: string): string {
  return name.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

export function defineWidget<S extends Record<string, FieldSpec>>(shape: S) {
  const zodShape: Record<string, z.ZodTypeAny> = {}
  const fields: FieldDescriptor[] = []
  for (const [name, spec] of Object.entries(shape)) {
    zodShape[name] = spec.zod
    fields.push({ name, ...spec.descriptor, label: spec.descriptor.label || humanize(name) })
  }
  return { model: z.object(zodShape), fields }
}
```

- [ ] **Step 2: Test** `test/overlays/widget-schema.test.ts` — `defineWidget({ text: text({default:'x',canLiveUpdate:true}), n: number({required:true}), pick: select({choices:[['a','A']]}) })`: assert `model.parse({ n: '3', pick: 'a' })` coerces `n` to `3`; assert `fields` has the right `input_type`/`required`/`default`/`choices`/`can_live_update`; assert `label` humanizes (`text` → `Text`). Run → PASS.

- [ ] **Step 3: Commit.** `git commit -am "feat(overlays): widget-schema DSL (defineWidget + field descriptors)"`

---

## Task 2: Overlay contract + first overlay (general/Text) + gsap

**Files:** `package.json` (add `gsap`); Create `overlays/general/Text/{index.tsx,model.ts,settings.ts,animationIn.ts,animationOut.ts,Text.module.scss}`; `lib/overlays/types.ts`.

**Interfaces:** Establishes the concrete overlay folder contract every other overlay copies. Produces `OverlaySettings` type.

- [ ] **Step 1: `npm install gsap@^3.11`.**

- [ ] **Step 2: `lib/overlays/types.ts`.**
```ts
import type { ComponentType } from 'react'
import type { FieldDescriptor } from './widget-schema'

export type OverlaySettings = {
  model: string
  preview?: Record<string, string>
  color: number            // 1..7 UI tag color
  isFullscreen: boolean
  widgetName?: string       // default operator label
  allowedParticipantType?: 'team' | 'player'
}

export type OverlayData = { widget: Record<string, unknown> } & Record<string, unknown>
export type OverlayComponent = ComponentType<{ data: OverlayData }>
export type OverlayAnimation = (root: HTMLElement) => unknown // returns a gsap Timeline; callers don't need the type

export type CatalogEntry = {
  model: string
  category: string
  template: string
  widgetName: string
  preview?: Record<string, string>
  color: number
  isFullscreen: boolean
  allowedParticipantType?: 'team' | 'player'
  zodModel: import('zod').ZodTypeAny
  fields: FieldDescriptor[]
  actions: readonly string[]
}
```

- [ ] **Step 3: `overlays/general/Text/model.ts`.**
```ts
import { z } from 'zod'
import { defineWidget, text } from '@/lib/overlays/widget-schema'

export const { model, fields } = defineWidget({
  text: text({ label: 'Headline', default: 'Text sample', canLiveUpdate: true }),
})
export const actions = ['next'] as const
export type Data = z.infer<typeof model>
```

- [ ] **Step 4: `overlays/general/Text/settings.ts`.**
```ts
import type { OverlaySettings } from '@/lib/overlays/types'
const settings: OverlaySettings = { model: 'general-text', color: 1, isFullscreen: false, widgetName: 'Text' }
export default settings
```

- [ ] **Step 5: `index.tsx` + `Text.module.scss`.**
```tsx
// overlays/general/Text/index.tsx
import styles from './Text.module.scss'
import type { Data } from './model'
export default function Text({ data }: { data: { widget: Data } }) {
  return <div className={styles.root}><span className={styles.text}>{data.widget.text}</span></div>
}
```
```scss
// Text.module.scss — absolute on the transparent canvas, theme CSS vars only.
.root { position: fixed; left: 120px; bottom: 160px; }
.text {
  font-family: var(--font-display, sans-serif); font-display: block;
  font-size: 64px; color: var(--color-primary, #fff);
  background: var(--color-bg-accent, rgba(0,0,0,0.6)); padding: 12px 28px;
}
```

- [ ] **Step 6: `animationIn.ts` / `animationOut.ts`.**
```ts
// animationIn.ts
import { gsap } from 'gsap'
export default function animationIn(root: HTMLElement) {
  return gsap.timeline().from(root, { y: 40, autoAlpha: 0, duration: 0.5, ease: 'power2.out' })
}
```
```ts
// animationOut.ts
import { gsap } from 'gsap'
export default function animationOut(root: HTMLElement) {
  return gsap.timeline().to(root, { y: 40, autoAlpha: 0, duration: 0.35, ease: 'power2.in' })
}
```

- [ ] **Step 7: Commit.** `git commit -am "feat(overlays): overlay contract + general/Text sample + gsap"`

---

## Task 3: Registry codegen + registries + npm scripts

**Files:** Create `scripts/generate-overlay-registry.ts`, `lib/overlays/catalog.ts`, `lib/overlays/render.ts`, and the generated `lib/overlays/{catalog.generated.ts,components.generated.ts}`; Modify `package.json`; Test `test/overlays/registry.test.ts`.

**Interfaces:** `listOverlays(discipline?)`, `getCatalogEntry(model)`, `getOverlayModel(model)`, `describeModel(model)`, `isDeclaredAction(model, action)` (catalog); `getOverlayRender(model)` (render).

- [ ] **Step 1: `scripts/generate-overlay-registry.ts`.** Export a pure `buildSources(dirs: {category:string;template:string}[]) → { catalog: string; components: string }` and a `main()` that scans `overlays/*/*/settings.ts`, calls `buildSources`, and writes both generated files. Generated **catalog** shape:
```ts
// AUTO-GENERATED — do not edit. Run: npm run titles:generate
import TextSettings from '@/overlays/general/Text/settings'
import * as TextModel from '@/overlays/general/Text/model'
export const catalog = [
  { category: 'general', template: 'Text', settings: TextSettings,
    zodModel: TextModel.model, fields: TextModel.fields, actions: (TextModel as any).actions ?? [] },
] as const
```
Generated **components** shape:
```ts
import TextComponent from '@/overlays/general/Text'
import TextIn from '@/overlays/general/Text/animationIn'
import TextOut from '@/overlays/general/Text/animationOut'
export const components = [
  { category: 'general', template: 'Text', Component: TextComponent, animationIn: TextIn, animationOut: TextOut },
]
```
(Identifier per overlay = `${Category}${Template}` PascalCase; import specifiers use `@/overlays/<category>/<template>/...`.)

- [ ] **Step 2: `lib/overlays/catalog.ts`.** Build `Map<model, CatalogEntry>` from `catalog.generated`, deriving `category`/`template` from each row, the kebab key from `row.settings.model`, `widgetName = settings.widgetName ?? template`, `zodModel = row.zodModel`. Expose:
```ts
export function listOverlays(discipline?: string): CatalogEntry[] // category==='general' || category===discipline
export function getCatalogEntry(model: string): CatalogEntry | undefined
export function getOverlayModel(model: string): import('zod').ZodTypeAny | undefined // entry.zodModel
export function describeModel(model: string): FieldDescriptor[] // entry.fields ?? []
export function isDeclaredAction(model: string, action: string): boolean // action in entry.actions
```

- [ ] **Step 3: `lib/overlays/render.ts`.** Join `catalog.generated` + `components.generated` by `(category, template)`; expose `getOverlayRender(model) → { entry, Component, animationIn, animationOut } | undefined`. This is the only module importing `components.generated` (keeps overlay components out of the admin/API bundle).

- [ ] **Step 4: `package.json`.** Add `"titles:generate": "tsx scripts/generate-overlay-registry.ts"`, and `"predev"`/`"prebuild"` = `"npm run titles:generate"`.

- [ ] **Step 5: Generate + commit the outputs.** Run `npm run titles:generate`; the two generated files now exist (Text only).

- [ ] **Step 6: Test** `test/overlays/registry.test.ts` — (a) `listOverlays()` includes `general-text`; `listOverlays('dota-2')` still includes it (general); (b) `getOverlayModel('general-text').parse({})` yields `{ text: 'Text sample' }`; (c) `describeModel('general-text')[0].can_live_update === true`; (d) `isDeclaredAction('general-text','next') === true`, `'nope' === false`; (e) **in-sync**: call `buildSources` for the current overlay dirs and assert the strings equal the committed generated files. Run → PASS.

- [ ] **Step 7: Commit.** `git commit -am "feat(overlays): build-time registry codegen (catalog + components)"`

---

## Task 4: Shared Timer model + 3 more overlays

**Files:** Create `models/Timer.ts`; `overlays/general/{Scoreboard,OpeningTimer,Intro}/*`; regenerate registries; Test `test/overlays/render.test.tsx`.

- [ ] **Step 1: `models/Timer.ts`** — shared contract:
```ts
import { defineWidget, number, text } from '@/lib/overlays/widget-schema'
export const TimerFields = { duration: number({ label: 'Duration (s)', default: 300, canLiveUpdate: true }),
  label: text({ label: 'Label', default: 'STARTS IN', canLiveUpdate: true }) }
export const TimerActions = ['start', 'stop', 'reset'] as const
export const timerWidget = () => defineWidget(TimerFields)
```

- [ ] **Step 2: OpeningTimer** — `model.ts` uses `timerWidget()` + `export const actions = TimerActions`; `settings.ts` `{ model: 'general-opening-timer', color: 4, isFullscreen: false }`; `index.tsx` renders `data.widget.label` + a formatted `data.widget.duration`; GSAP fade; scss.

- [ ] **Step 3: Scoreboard** — `model.ts` widget `{ title: text({default:'MATCH'}) }`; `index.tsx` reads `data.match`/`data.participants` (left/right name + score) with fallbacks; `settings.ts` `{ model: 'general-scoreboard', color: 3, isFullscreen: false }`; GSAP; scss.

- [ ] **Step 4: Intro** — full-screen splash; `settings.ts` `{ model: 'general-intro', color: 6, isFullscreen: true }`; `model.ts` `{ heading: text({default:'WELCOME'}) }`; `index.tsx` full-canvas; GSAP; scss.

- [ ] **Step 5: Regenerate** — `npm run titles:generate` (now 4 overlays); commit the updated generated files.

- [ ] **Step 6: Test** `test/overlays/render.test.tsx` — for each of the 4 overlays, `render(<Component data={{ widget: getOverlayModel(model).parse({}), match: {...}, participants: [...] }} />)` and assert it mounts + shows expected sample text (jsdom; CSS-module classNames are stubbed/undefined — assert on text, not styles). Run → PASS.

- [ ] **Step 7: Commit.** `git commit -am "feat(overlays): Scoreboard + OpeningTimer + Intro samples with shared Timer model"`

---

## Task 5: `rundown_overlays` schema + Zod + migration

**Files:** Modify `db/schema.ts`; Create `db/schemas/rundown-overlays.ts`; Test `test/db/rundown-overlays.test.ts`.

- [ ] **Step 1: Add `rundownOverlays` to `db/schema.ts`** (per `database.md` §5 + inline `data`):
```ts
export const rundownOverlays = pgTable('rundown_overlays', {
  id: serial('id').primaryKey(),
  rundownId: integer('rundown_id').notNull().references(() => rundowns.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  category: text('category'),
  template: text('template'),
  widgetName: text('widget_name').notNull(),
  layer: integer('layer').notNull().default(1),
  color: integer('color').notNull().default(1),
  displayFilter: text('display_filter'),
  previewImg: text('preview_img'),
  isFullscreen: boolean('is_fullscreen').notNull().default(false),
  hasNextButton: boolean('has_next_button').notNull().default(false),
  order: integer('order').notNull().default(0),
  inMixer: text('in_mixer'), outMixer: text('out_mixer'), innerMixer: text('inner_mixer'),
  inTransitionCutPoint: doublePrecision('in_transition_cut_point'),
  outTransitionCutPoint: doublePrecision('out_transition_cut_point'),
  backgroundVideo: text('background_video'), backgroundImage: text('background_image'),
  data: jsonb('data').$type<{ widget: Record<string, unknown> }>().notNull().default({ widget: {} }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('rundown_overlays_rundown_idx').on(t.rundownId, t.order)])
```
(Import `doublePrecision` from `drizzle-orm/pg-core`.)

- [ ] **Step 2: `db/schemas/rundown-overlays.ts`** — Zod:
```ts
export const createRundownOverlaySchema = z.object({
  model: z.string().min(1),
  widgetName: z.string().min(1).optional(),
  layer: z.coerce.number().int().min(1).max(7).default(1),
  color: z.coerce.number().int().min(1).max(7).default(1),
  displayFilter: z.string().optional(),
  isFullscreen: z.boolean().optional(),
})
export const updateRundownOverlaySchema = z.object({
  widgetName: z.string().min(1).optional(),
  layer: z.coerce.number().int().min(1).max(7).optional(),
  color: z.coerce.number().int().min(1).max(7).optional(),
  displayFilter: z.string().nullish(),
  isFullscreen: z.boolean().optional(),
  widget: z.record(z.string(), z.unknown()).optional(), // validated against the overlay model in the route
})
export const reorderSchema = z.object({ orderedIds: z.array(z.number().int()).min(1) })
```

- [ ] **Step 3: `db:generate`** → one `0001_*` migration. **Do not run `db:migrate`.**

- [ ] **Step 4: Test** `test/db/rundown-overlays.test.ts` — table exposes `data`/`model`/`layer`/`displayFilter`; id is `PgSerial`; migration file contains `create table … "rundown_overlays"`. Run → PASS.

- [ ] **Step 5: Commit.** `git commit -am "feat(db): rundown_overlays table + migration"`

---

## Task 6: `rundown_overlays` CRUD + single-project GET

**Files:** Create `app/api/projects/[projectId]/rundowns/[id]/overlays/{route.ts,[overlayId]/route.ts,reorder/route.ts}`, `app/api/projects/[projectId]/route.ts`, `store/apis/rundownOverlaysApi.ts`; Modify `store/index.ts`; Test `test/app/api/rundown-overlays.test.ts`.

**Interfaces:** Produces `rundownOverlaysApi` (list/create/update/delete/reorder, tags by rundown) and `GET /api/projects/[projectId]` → the project row (for the editor's discipline filter).

- [ ] **Step 1: Single-project GET** `app/api/projects/[projectId]/route.ts` — session-guarded; return the `projects` row by `Number(projectId)` (404 if none). Add a `getProject` query endpoint to `store/apis/projectsApi.ts` (`query: (projectId) => \`/projects/${projectId}\``) and export `useGetProjectQuery` for the editor's discipline lookup.

- [ ] **Step 2: Overlays list/create** `…/overlays/route.ts` (bespoke; `[id]` = rundownId):
  - `GET` — overlays where `rundownId` = Number(id) ordered by `order`.
  - `POST` — parse `createRundownOverlaySchema`; `const entry = getCatalogEntry(parsed.model)`; 400 if missing; compute `order` = current count; insert `{ rundownId, projectId: Number(projectId), model, category: entry.category, template: entry.template, widgetName: parsed.widgetName ?? entry.widgetName, previewImg, isFullscreen: parsed.isFullscreen ?? entry.isFullscreen, layer, color, displayFilter, data: { widget: (getOverlayModel(model)!.parse({})) } }`. Session-guarded; `requireSession`.
- [ ] **Step 3: `[overlayId]/route.ts`** — `PATCH`: parse `updateRundownOverlaySchema`; if `widget` present, load the row's `model`, `getOverlayModel(model).parse(widget)` (400 on failure) and set `data: { widget }`; update scalar fields; filter `and(eq(id, Number(overlayId)), eq(projectId, Number(projectId)))`. `DELETE`: same filter.
- [ ] **Step 4: `reorder/route.ts`** — `POST` `{ orderedIds }`; for each id, `update … set order=index where id=id and rundownId=Number(id)` (sequential). Return 204.
- [ ] **Step 5: `store/apis/rundownOverlaysApi.ts`** — plain `createApi`, base `/api`, tag `RundownOverlay`; endpoints `listRundownOverlays({projectId,rundownId})`, `createRundownOverlay`, `updateRundownOverlay`, `deleteRundownOverlay`, `reorderRundownOverlays` (invalidate a `LIST:{rundownId}` tag). Register in `store/index.ts`.
- [ ] **Step 6: Test** `test/app/api/rundown-overlays.test.ts` — POST 400 on unknown model; POST derives category/template + default widget from the registry and uses URL projectId; PATCH rejects an invalid widget field (400) and accepts a valid one; reorder rewrites order. (Mock `@/lib/auth`, `@/db`; the registry is real.) Run → PASS.
- [ ] **Step 7: Commit.** `git commit -am "feat(overlays): rundown_overlays CRUD + reorder + single-project GET"`

---

## Task 7: Overlay editor UI

**Files:** Create `components/admin/overlays/OverlayWidgetForm.tsx`, `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`.

- [ ] **Step 1: `OverlayWidgetForm`** — props `{ model: string; value: Record<string,unknown>; onSubmit }`. `const fields = describeModel(model)`, `const zodModel = getOverlayModel(model)`; RHF `useForm({ resolver: zodResolver(zodModel), defaultValues: value })`; render each `FieldDescriptor` by `input_type`: `text`/`number` → `TextField`, `select` → `TextField select` with `choices`, `selectmulti` → `Select multiple`, `checkbox` → `Checkbox`, `list_object` → a JSON `TextField` (parsed on submit). Disable nothing here (live-update gating is the controller's job); show a `can_live_update` hint chip.
- [ ] **Step 2: Editor page** — `use(params)` → `{ projectId, rundownId }`. Load: `useGetProjectQuery(projectId)` (discipline id) + `useListTagsQuery()` (resolve discipline name) + `useListRundownOverlaysQuery({projectId,rundownId})`.
  - **Add** dialog: `listOverlays(disciplineName)` grid (widgetName/color/preview); pick → `createRundownOverlay({ projectId, rundownId, data: { model } })`.
  - **Row list** ordered by `order`: each shows `widgetName`, `layer`, `color`, `is_fullscreen`; **Edit** opens the `OverlayWidgetForm` + `widgetName`/`layer`(1–7)/`color`(1–7)/`displayFilter`/`isFullscreen` controls → `updateRundownOverlay`; **↑/↓** call `reorderRundownOverlays`; **Delete**.
  - Back-link to `…/rundowns`.
- [ ] **Step 3: Verify** the editor imports only `lib/overlays/catalog` (never `render`/`components.generated`), so overlay components stay out of the admin bundle.
- [ ] **Step 4: Commit.** `git commit -am "feat(overlays): rundown editor (picker + widget-schema form + reorder)"`

---

## Task 8: Dev render harness

**Files:** Create `app/(admin)/dev/overlays/page.tsx`.

- [ ] **Step 1:** A protected page: an overlay `<select>` from `listOverlays()`; on choose, `const r = getOverlayRender(model)`; render `<r.Component data={sample} />` inside a scaled (`transform: scale(...)`) transparent 1920×1080 stage with a dark checker backdrop; sample `data` = `{ widget: getOverlayModel(model).parse({}), match: { participant_left:{name:'Team A',score:1}, participant_right:{name:'Team B',score:2} }, participants: [...] }`. On mount, run `r.animationIn(rootEl)`; an **Exit** button runs `r.animationOut(rootEl)`. (This page is the only admin surface importing `lib/overlays/render`.)
- [ ] **Step 2: Verify** in the browser preview (Task 9 covers the full check): the overlay appears and animates.
- [ ] **Step 3: Commit.** `git commit -am "feat(overlays): dev render harness at /dev/overlays"`

---

## Task 9: Integration + green gate + docs note

**Files:** any dangling refs; `docs/rundowns.md` + `docs/database.md` (the inline-`data` divergence note); `docs/getting-started.md` (rundown_overlays in the table list).

- [ ] **Step 1: Regenerate** `npm run titles:generate`; confirm the in-sync test passes.
- [ ] **Step 2: `npm run typecheck`** — fix to clean.
- [ ] **Step 3: `npm run lint`** — fix to clean (overlays: no MUI/hex; SCSS only).
- [ ] **Step 4: `npm run build`** — succeeds (predev/prebuild codegen runs; `/dev/overlays` + editor compile).
- [ ] **Step 5: `npm run test`** — full suite green.
- [ ] **Step 6: Browser check** — start the dev server (or attach to the running one), open `/dev/overlays`, screenshot an overlay rendering + animating; open a rundown editor, add an overlay, edit a field, reorder.
- [ ] **Step 7: Docs** — add the "authored widget values live inline on `rundown_overlays.data` this pass; per-display `rundown_overlay_data` arrives with broadcast" note to `database.md`/`rundowns.md`; add `rundown_overlays` to the getting-started table list.
- [ ] **Step 8: Commit.** `git commit -am "chore(overlays): whole-project green + docs note"`

---

## Self-review notes (author)

- **Spec coverage:** DSL (T1), contract+samples (T2/T4), codegen+registry (T3), rundown_overlays data+CRUD (T5/T6), editor (T7), harness (T8), gate+docs (T9) — all mapped.
- **CSS in tests:** render tests (T4) assert on text, not class names — Vitest stubs/returns proxy for `.module.scss`, so no sass processing needed. If an import fails, add a `css.modules` stub or alias in `vitest.config.ts`.
- **Discipline filter:** all four samples are `general`, so `listOverlays(discipline)` returns them for every tournament — the filter is wired but only meaningfully exercised once discipline-specific overlays exist.
- **`list_object`:** supported in the DSL + validated, but the editor renders it as a JSON textarea this pass (no sample uses it).
- **Registry bundle hygiene:** admin/API import `catalog` (no components); only `render.ts` (harness now, broadcast later) imports `components.generated`.
