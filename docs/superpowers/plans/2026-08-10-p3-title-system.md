# P3 — Title System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Checkboxes in this repo are historically never ticked.** Do not treat them as a completion signal — verify against the filesystem (see `docs/superpowers/specs/2026-06-18-base-app-scope.md`).

**Goal:** Ship the overlay-package + title contract — a shared `models/` library, the three-file title contract, a build-time title registry, the package scan that feeds Add Project, and the asset pipeline — so P4 (bus/SSE) can render titles by `titleKey` and P5 can generate operator forms from `model.ts`.

**Architecture:** A title is a folder under `projects/<label>/titles/<key>/` holding exactly `index.tsx`, `model.ts`, `settings.ts`. Reusable field/action contracts live in a top-level `models/` library that each `model.ts` composes via `.omit()`/`.extend()`. Discovery is **build-time codegen**: a pure scanner emits `lib/titles/generated.ts` containing static imports, which the runtime registry indexes by `(packageLabel, titleKey)`. Packages themselves are discovered by a filesystem scan of `projects/*/project.config.ts`.

**Tech Stack:** TypeScript 5.9 · Zod `^3.25` · React 19 · SCSS modules (`sass ^1.101`) · Vitest 4 + @testing-library/react · tsx (scripts) · Node built-ins only for file IO (no `fs-extra`, no `chokidar`).

## Global Constraints

- **No migrations.** P3 is entirely filesystem + code. `rundown_items.data jsonb` already holds title data; `layer` is Task 1 of the multi-layer plan, not this one.
- **SCSS modules only inside titles.** No MUI import, no inline hex, no raw `font-family`. Brand values come from `project.css` CSS variables consumed with `var(…)`. `font-display: block`, never `swap`. Per `docs/titles-system.md` and `CLAUDE.md`.
- **Titles are self-contained.** A title may import from its own folder and from `@/models/*` and `@/lib/titles/types`, but **never** from another title's folder.
- **Titles never fetch, never read Redux.** Everything arrives as the `data` prop.
- **House ESLint style:** no semicolons, 2-space indent, single quotes, `max-len` 140, one JSX prop per line, one JSX expression per line. `npm run lint` must exit 0 (warnings from `no-console` in `scripts/` are acceptable).
- **Discovery must work in both Next (Turbopack) and Vitest.** That rules out `import.meta.glob` (Vite-only) and `require.context` (webpack-only) — hence codegen emitting plain static imports.
- **`packageLabel` is the folder name**, and `project.config.ts`'s `label` must equal it. `project.label` (the folder) addresses assets/CSS; `project.id` (the UUID) never appears in an asset path.
- **`public/projects/` is a derived artifact** and must be git-ignored.
- Every task ends in a commit. Work on a branch off `main`.

### Contract reconciliation (decided, do not re-litigate)

`docs/titles-system.md` shows `settings.ts` default-exporting presentation `satisfies TitleSettings`; the title-contract spec sketches a named `settings` export that *also* carries `model` and `actions`. **This plan uses the former:** `settings.ts` default-exports presentation only, `model.ts` exports `model` + `actions`, and the **registry entry** is what composes the full title entity (`{ Component, model, actions, settings }`). Rationale: presentation stays a plain object validatable by one Zod schema, and consumers already go through the registry rather than importing `settings.ts` directly. The spec's intent — "reading a title yields presentation + validation + actions" — is satisfied by `getTitleEntry()`.

---

### Task 1: Title & package contract types

The vocabulary every later task imports. Presentation settings get a **Zod schema**, not just a type, so the codegen/registry can reject a malformed `settings.ts` instead of failing mysteriously at render.

**Files:**
- Create: `lib/titles/types.ts`, `lib/projects/types.ts`
- Test: `test/titles/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `titleColorSchema`, `titleSettingsSchema`, `TitleSettings`, `TitleColor`, `CommandHandler`, `TitleProps<TData>`, `TitleEntry`, `TitleRegistry` from `@/lib/titles/types`; `overlayPackageConfigSchema`, `OverlayPackageConfig` from `@/lib/projects/types`.

- [ ] **Step 1: Write the failing test**

```ts
// test/titles/types.test.ts
import { describe, it, expect } from 'vitest'
import { titleSettingsSchema } from '@/lib/titles/types'
import { overlayPackageConfigSchema } from '@/lib/projects/types'

describe('titleSettingsSchema', () => {
  it('accepts a minimal settings object and defaults the full-screen flag', () => {
    const parsed = titleSettingsSchema.parse({ title_name: 'Lower Third' })
    expect(parsed.title_is_full_screen).toBe(false)
  })

  it('keeps the media filenames it is given', () => {
    const parsed = titleSettingsSchema.parse({
      title_name: 'Opening Timer',
      title_is_full_screen: true,
      title_stinger_in: 'timer-in.webm',
      title_preview: 'timer.png',
      title_color: 'blue',
    })
    expect(parsed.title_stinger_in).toBe('timer-in.webm')
    expect(parsed.title_color).toBe('blue')
  })

  it('rejects an empty title_name', () => {
    expect(titleSettingsSchema.safeParse({ title_name: '' }).success).toBe(false)
  })

  it('rejects a colour outside the four UI tags', () => {
    expect(titleSettingsSchema.safeParse({ title_name: 'X', title_color: 'purple' }).success).toBe(false)
  })
})

describe('overlayPackageConfigSchema', () => {
  it('accepts a package config', () => {
    const parsed = overlayPackageConfigSchema.parse({ label: 'default', name: 'Default Package' })
    expect(parsed.label).toBe('default')
  })

  it('rejects a config with no label', () => {
    expect(overlayPackageConfigSchema.safeParse({ name: 'No Label' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/titles/types.test.ts`
Expected: FAIL — cannot resolve `@/lib/titles/types`.

- [ ] **Step 3: Implement**

```ts
// lib/titles/types.ts
import { z } from 'zod'
import type { ComponentType } from 'react'

export const titleColorSchema = z.enum(['red', 'green', 'blue', 'yellow'])
export type TitleColor = z.infer<typeof titleColorSchema>

// Author-time presentation. Read from the registry by titleKey — never travels
// in the SSE payload. Media fields are filenames inside the package's
// assets/titles/{videos,backgrounds,previews}/ folders.
export const titleSettingsSchema = z.object({
  title_name: z.string().min(1),
  title_preview: z.string().optional(),
  title_color: titleColorSchema.optional(),
  title_is_full_screen: z.boolean().default(false),
  title_stinger_in: z.string().optional(),
  title_stinger_out: z.string().optional(),
  title_background: z.string().optional(),
  title_video: z.string().optional(),
})

export type TitleSettings = z.infer<typeof titleSettingsSchema>

// A command is fire-and-forget and never snapshotted: a title registers a
// handler, the renderer forwards `command` events matching its itemId.
export type CommandHandler = (action: string, payload?: unknown) => void

export type TitleProps<TData> = {
  data: TData
  onCommand?: (handler: CommandHandler) => void
}

export type TitleEntry = {
  key: string
  packageLabel: string
  Component: ComponentType<TitleProps<never>>
  model: z.ZodTypeAny
  actions: readonly string[]
  settings: TitleSettings
}

export type TitleRegistry = Record<string, TitleEntry>
```

```ts
// lib/projects/types.ts
import { z } from 'zod'

// label MUST equal the folder name under projects/ — packageExists() matches on it.
export const overlayPackageConfigSchema = z.object({
  label: z.string().min(1),
  name: z.string().min(1),
  thumbnailPath: z.string().optional(),
})

export type OverlayPackageConfig = z.infer<typeof overlayPackageConfigSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/titles/types.test.ts && npm run typecheck && npm run lint`
Expected: PASS, no type/lint errors.

- [ ] **Step 5: Commit**

```bash
git add lib/titles/types.ts lib/projects/types.ts test/titles/types.test.ts
git commit -m "feat(titles): title settings + package config contracts as Zod schemas"
```

---

### Task 2: Shared `models/` library

The reusable contract layer: field schemas **and** declared command actions, authored once and composed per package. This is what makes "OpeningTimer is almost the same across projects — skip some fields, add some" work.

**Files:**
- Create: `models/OpeningTimer.ts`, `models/LowerThird.ts`
- Test: `test/models/shared-models.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces: `OpeningTimerFields`, `OpeningTimerActions`, `OpeningTimerData` from `@/models/OpeningTimer`; `LowerThirdFields`, `LowerThirdActions`, `LowerThirdData` from `@/models/LowerThird`.

- [ ] **Step 1: Write the failing test**

```ts
// test/models/shared-models.test.ts
import { describe, it, expect } from 'vitest'
import { OpeningTimerFields, OpeningTimerActions } from '@/models/OpeningTimer'
import { LowerThirdFields, LowerThirdActions } from '@/models/LowerThird'

describe('OpeningTimerFields', () => {
  it('accepts a full valid payload', () => {
    const r = OpeningTimerFields.safeParse({
      hours: 1,
      minutes: 30,
      seconds: 0,
      main_text: 'Kickoff',
      sponsors: ['Acme'],
    })
    expect(r.success).toBe(true)
  })

  it('defaults sponsors to an empty array', () => {
    const parsed = OpeningTimerFields.parse({ hours: 0, minutes: 5, seconds: 0, main_text: 'Soon' })
    expect(parsed.sponsors).toEqual([])
  })

  it('rejects minutes above 59', () => {
    expect(OpeningTimerFields.safeParse({ hours: 0, minutes: 60, seconds: 0, main_text: 'x' }).success).toBe(false)
  })

  it('rejects a non-integer hour', () => {
    expect(OpeningTimerFields.safeParse({ hours: 1.5, minutes: 0, seconds: 0, main_text: 'x' }).success).toBe(false)
  })

  it('declares start/stop/reset as its command actions', () => {
    expect(OpeningTimerActions).toEqual(['start', 'stop', 'reset'])
  })
})

describe('LowerThirdFields', () => {
  it('requires a player name', () => {
    expect(LowerThirdFields.safeParse({ teamName: 'Boom Squad' }).success).toBe(false)
  })

  it('accepts name only', () => {
    expect(LowerThirdFields.safeParse({ playerName: 'Casey Liu' }).success).toBe(true)
  })

  it('declares no command actions', () => {
    expect(LowerThirdActions).toEqual([])
  })
})

describe('composition', () => {
  it('supports the per-project omit/extend pattern', () => {
    const composed = OpeningTimerFields.omit({ sponsors: true }).extend({
      subtitle: LowerThirdFields.shape.teamName,
    })
    const r = composed.safeParse({ hours: 0, minutes: 1, seconds: 2, main_text: 'x', subtitle: 'y' })
    expect(r.success).toBe(true)
    expect(Object.keys(composed.shape)).not.toContain('sponsors')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/models/shared-models.test.ts`
Expected: FAIL — cannot resolve `@/models/OpeningTimer`.

- [ ] **Step 3: Implement**

```ts
// models/OpeningTimer.ts
// Reusable OpeningTimer contract. A package's model.ts composes this with
// .omit()/.extend() so projects can drop or add fields without forking.
import { z } from 'zod'

export const OpeningTimerFields = z.object({
  hours: z.number().int().min(0).max(99),
  minutes: z.number().int().min(0).max(59),
  seconds: z.number().int().min(0).max(59),
  main_text: z.string().max(80),
  sponsors: z.array(z.string()).default([]),
})

// Declared command actions: thread-widget buttons, and the allow-list the
// /command route validates against. Universal actions (air/preview/hide/update)
// are implicit for every title and are NOT listed here.
export const OpeningTimerActions = ['start', 'stop', 'reset'] as const

export type OpeningTimerData = z.infer<typeof OpeningTimerFields>
```

```ts
// models/LowerThird.ts
import { z } from 'zod'

export const LowerThirdFields = z.object({
  playerName: z.string().min(1).max(40),
  teamName: z.string().max(40).optional(),
  position: z.enum(['guard', 'forward', 'center']).optional(),
})

// A lower third is pure data — nothing to start or stop.
export const LowerThirdActions = [] as const

export type LowerThirdData = z.infer<typeof LowerThirdFields>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/models/shared-models.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add models test/models/shared-models.test.ts
git commit -m "feat(titles): shared models library (fields + declared command actions)"
```

---

### Task 3: The `default` overlay package with two titles

A real package proving the three-file contract, SCSS-module styling against `project.css` variables, model composition, and command handling. `lower-third` is the simple case; `opening-timer` exercises `.omit()`/`.extend()` **and** `onCommand`.

**Files:**
- Create: `projects/default/project.config.ts`, `projects/default/styles/project.css`
- Create: `projects/default/titles/lower-third/{index.tsx,model.ts,settings.ts,LowerThird.module.scss}`
- Create: `projects/default/titles/opening-timer/{index.tsx,model.ts,settings.ts,OpeningTimer.module.scss}`
- Create: `projects/default/assets/titles/{videos,backgrounds,previews}/.gitkeep`
- Test: `test/titles/default-package.test.tsx`

**Interfaces:**
- Consumes: `TitleProps` (Task 1), `OpeningTimerFields`/`OpeningTimerActions`/`LowerThirdFields`/`LowerThirdActions` (Task 2).
- Produces: package label `default`; title keys `lower-third` and `opening-timer`, each exporting `model` + `actions` from `model.ts` and a default `TitleSettings` from `settings.ts`.

- [ ] **Step 1: Write the failing test**

```tsx
// test/titles/default-package.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import LowerThird from '@/projects/default/titles/lower-third'
import lowerThirdSettings from '@/projects/default/titles/lower-third/settings'
import { model as lowerThirdModel, actions as lowerThirdActions } from '@/projects/default/titles/lower-third/model'
import OpeningTimer from '@/projects/default/titles/opening-timer'
import openingTimerSettings from '@/projects/default/titles/opening-timer/settings'
import { model as timerModel, actions as timerActions } from '@/projects/default/titles/opening-timer/model'
import { titleSettingsSchema } from '@/lib/titles/types'
import type { CommandHandler } from '@/lib/titles/types'

afterEach(() => {
  vi.useRealTimers()
})

describe('lower-third', () => {
  it('has settings that satisfy the settings schema', () => {
    expect(titleSettingsSchema.safeParse(lowerThirdSettings).success).toBe(true)
    expect(lowerThirdSettings.title_is_full_screen).toBe(false)
  })

  it('declares no command actions', () => {
    expect(lowerThirdActions).toEqual([])
  })

  it('renders the player name and team from data', () => {
    const data = lowerThirdModel.parse({ playerName: 'Casey Liu', teamName: 'Boom Squad' })
    render(<LowerThird data={data} />)
    expect(screen.getByText('Casey Liu')).toBeInTheDocument()
    expect(screen.getByText('Boom Squad')).toBeInTheDocument()
  })

  it('omits the team element when teamName is absent', () => {
    render(<LowerThird data={lowerThirdModel.parse({ playerName: 'Solo' })} />)
    expect(screen.queryByText('Boom Squad')).not.toBeInTheDocument()
  })
})

describe('opening-timer model composition', () => {
  it('drops sponsors and adds subtitle', () => {
    expect(Object.keys(timerModel.shape)).not.toContain('sponsors')
    expect(Object.keys(timerModel.shape)).toContain('subtitle')
  })

  it('still enforces the shared field bounds', () => {
    expect(timerModel.safeParse({ hours: 0, minutes: 99, seconds: 0, main_text: 'x' }).success).toBe(false)
  })

  it('re-declares the shared command actions', () => {
    expect(timerActions).toEqual(['start', 'stop', 'reset'])
  })

  it('is marked full-screen in settings', () => {
    expect(titleSettingsSchema.safeParse(openingTimerSettings).success).toBe(true)
    expect(openingTimerSettings.title_is_full_screen).toBe(true)
  })
})

describe('opening-timer commands', () => {
  it('renders the initial countdown from data', () => {
    render(<OpeningTimer data={timerModel.parse({ hours: 0, minutes: 1, seconds: 5, main_text: 'Kickoff' })} />)
    expect(screen.getByText('00:01:05')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
  })

  it('counts down after start, halts on stop, and returns to data on reset', () => {
    vi.useFakeTimers()
    let fire: CommandHandler = () => {}
    render(
      <OpeningTimer
        data={timerModel.parse({ hours: 0, minutes: 0, seconds: 10, main_text: 'Kickoff' })}
        onCommand={(handler) => {
          fire = handler
        }}
      />,
    )
    expect(screen.getByText('00:00:10')).toBeInTheDocument()

    act(() => fire('start'))
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('00:00:07')).toBeInTheDocument()

    act(() => fire('stop'))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText('00:00:07')).toBeInTheDocument()

    act(() => fire('reset'))
    expect(screen.getByText('00:00:10')).toBeInTheDocument()
  })

  it('never counts below zero', () => {
    vi.useFakeTimers()
    let fire: CommandHandler = () => {}
    render(
      <OpeningTimer
        data={timerModel.parse({ hours: 0, minutes: 0, seconds: 2, main_text: 'x' })}
        onCommand={(handler) => {
          fire = handler
        }}
      />,
    )
    act(() => fire('start'))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('ignores an action it does not declare', () => {
    vi.useFakeTimers()
    let fire: CommandHandler = () => {}
    render(
      <OpeningTimer
        data={timerModel.parse({ hours: 0, minutes: 0, seconds: 9, main_text: 'x' })}
        onCommand={(handler) => {
          fire = handler
        }}
      />,
    )
    act(() => fire('explode'))
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('00:00:09')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/titles/default-package.test.tsx`
Expected: FAIL — cannot resolve `@/projects/default/titles/lower-third`.

- [ ] **Step 3: Implement the package shell**

```ts
// projects/default/project.config.ts
import type { OverlayPackageConfig } from '@/lib/projects/types'

export default {
  label: 'default',
  name: 'Default Package',
} satisfies OverlayPackageConfig
```

```css
/* projects/default/styles/project.css */
/* Brand surface for the package. Re-skinning a project means editing this file,
   not the titles. font-display: block — never `swap` in broadcast, or frames
   paint with a fallback font. Drop .woff2 files in assets/fonts/ and point the
   @font-face src at /projects/default/assets/fonts/<file>.woff2. */
:root {
  --color-primary: #ff4d2e;
  --color-secondary: rgb(12 14 20 / 90%);
  --color-accent: #7fd1ff;
  --color-fg: #ffffff;
  --font-display: 'DefaultDisplay', system-ui, sans-serif;
  --font-body: 'DefaultBody', system-ui, sans-serif;
}
```

- [ ] **Step 4: Implement `lower-third`**

```ts
// projects/default/titles/lower-third/model.ts
import { LowerThirdFields, LowerThirdActions } from '@/models/LowerThird'

// This package uses the shared contract unchanged.
export const model = LowerThirdFields
export const actions = LowerThirdActions
export type Data = typeof model._output
```

```tsx
// projects/default/titles/lower-third/index.tsx
import type { TitleProps } from '@/lib/titles/types'
import type { Data } from './model'
import styles from './LowerThird.module.scss'

export default function LowerThird({ data }: TitleProps<Data>) {
  return (
    <div className={styles.root}>
      <span className={styles.name}>{data.playerName}</span>
      {data.teamName && <span className={styles.team}>{data.teamName}</span>}
    </div>
  )
}
```

```scss
// projects/default/titles/lower-third/LowerThird.module.scss
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
  color: var(--color-fg);
}

.team {
  font-family: var(--font-body);
  font-size: 1.25rem;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

```ts
// projects/default/titles/lower-third/settings.ts
import type { TitleSettings } from '@/lib/titles/types'

export default {
  title_name: 'Lower Third',
  title_color: 'red',
  title_is_full_screen: false,
} satisfies TitleSettings
```

- [ ] **Step 5: Implement `opening-timer`**

```ts
// projects/default/titles/opening-timer/model.ts
import { z } from 'zod'
import { OpeningTimerFields, OpeningTimerActions } from '@/models/OpeningTimer'

// This package drops sponsors and adds a subtitle — the omit/extend pattern.
export const model = OpeningTimerFields.omit({ sponsors: true }).extend({
  subtitle: z.string().max(60).optional(),
})

export const actions = OpeningTimerActions
export type Data = z.infer<typeof model>
```

```tsx
// projects/default/titles/opening-timer/index.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { TitleProps } from '@/lib/titles/types'
import type { Data } from './model'
import styles from './OpeningTimer.module.scss'

function toSeconds(data: Data) {
  return data.hours * 3600 + data.minutes * 60 + data.seconds
}

function format(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function OpeningTimer({ data, onCommand }: TitleProps<Data>) {
  const [remaining, setRemaining] = useState(() => toSeconds(data))
  const [running, setRunning] = useState(false)

  // Latest data without re-registering the handler on every tick.
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    setRemaining(toSeconds(data))
  }, [data])

  useEffect(() => {
    if (!onCommand) return
    onCommand((action) => {
      if (action === 'start') setRunning(true)
      if (action === 'stop') setRunning(false)
      if (action === 'reset') {
        setRunning(false)
        setRemaining(toSeconds(dataRef.current))
      }
    })
  }, [onCommand])

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  return (
    <div className={styles.root}>
      <span className={styles.clock}>{format(remaining)}</span>
      <span className={styles.main}>{data.main_text}</span>
      {data.subtitle && <span className={styles.subtitle}>{data.subtitle}</span>}
    </div>
  )
}
```

```scss
// projects/default/titles/opening-timer/OpeningTimer.module.scss
.root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: var(--color-secondary);
}

.clock {
  font-family: var(--font-display);
  font-size: 10rem;
  line-height: 1;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.main {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--color-fg);
}

.subtitle {
  font-family: var(--font-body);
  font-size: 1.5rem;
  color: var(--color-accent);
}
```

```ts
// projects/default/titles/opening-timer/settings.ts
import type { TitleSettings } from '@/lib/titles/types'

export default {
  title_name: 'Opening Timer',
  title_color: 'blue',
  title_is_full_screen: true,
} satisfies TitleSettings
```

- [ ] **Step 6: Create the asset folders**

```bash
mkdir -p projects/default/assets/titles/videos \
         projects/default/assets/titles/backgrounds \
         projects/default/assets/titles/previews \
         projects/default/assets/fonts
touch projects/default/assets/titles/videos/.gitkeep \
      projects/default/assets/titles/backgrounds/.gitkeep \
      projects/default/assets/titles/previews/.gitkeep \
      projects/default/assets/fonts/.gitkeep
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/titles/default-package.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add projects/default test/titles/default-package.test.tsx
git commit -m "feat(titles): default overlay package with lower-third and opening-timer"
```

---

### Task 4: Overlay-package scan

Feeds the Add Project dropdown (P5a) and server-side validation of `project_label`. A `root` parameter keeps it testable against a fixture directory instead of the real `projects/`.

**Files:**
- Create: `lib/projects/packages.ts`
- Test: `test/projects/packages.test.ts`

**Interfaces:**
- Consumes: `overlayPackageConfigSchema` (Task 1); the `projects/default/` package (Task 3).
- Produces: `packageExists(label, root?)`, `listOverlayPackageLabels(root?)`, `listOverlayPackages(root?)` (async, returns validated `OverlayPackageConfig[]`), `PROJECTS_DIR`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
// test/projects/packages.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packageExists, listOverlayPackageLabels, listOverlayPackages } from '@/lib/projects/packages'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ets-packages-'))
  mkdirSync(join(root, 'alpha'))
  writeFileSync(join(root, 'alpha', 'project.config.ts'), 'export default { label: "alpha", name: "Alpha" }')
  mkdirSync(join(root, 'beta'))
  writeFileSync(join(root, 'beta', 'project.config.ts'), 'export default { label: "beta", name: "Beta" }')
  // A directory without a config is NOT a package.
  mkdirSync(join(root, 'not-a-package'))
  // A stray file is not a package either.
  writeFileSync(join(root, 'README.md'), '# nope')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('packageExists', () => {
  it('is true for a folder holding project.config.ts', () => {
    expect(packageExists('alpha', root)).toBe(true)
  })
  it('is false for a folder without one', () => {
    expect(packageExists('not-a-package', root)).toBe(false)
  })
  it('is false for a label that does not exist', () => {
    expect(packageExists('ghost', root)).toBe(false)
  })
  it('refuses to escape the packages root', () => {
    expect(packageExists('../../etc', root)).toBe(false)
  })
})

describe('listOverlayPackageLabels', () => {
  it('returns only real packages, sorted', () => {
    expect(listOverlayPackageLabels(root)).toEqual(['alpha', 'beta'])
  })
  it('returns an empty list when the root is missing', () => {
    expect(listOverlayPackageLabels(join(root, 'nope'))).toEqual([])
  })
})

describe('listOverlayPackages', () => {
  it('loads and validates the real repo packages', async () => {
    const packages = await listOverlayPackages()
    expect(packages.map((p) => p.label)).toContain('default')
    expect(packages.every((p) => p.label && p.name)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/projects/packages.test.ts`
Expected: FAIL — cannot resolve `@/lib/projects/packages`.

- [ ] **Step 3: Implement**

```ts
// lib/projects/packages.ts
// Packages are file-system only — there is no projects:sync script and no
// per-folder DB row. A folder is a package iff it holds project.config.ts.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { overlayPackageConfigSchema, type OverlayPackageConfig } from './types'

export const PROJECTS_DIR = join(process.cwd(), 'projects')

const CONFIG_FILE = 'project.config.ts'

// A label comes from user input (POST /api/projects), so it must not be able to
// address anything outside the packages root.
function resolveWithin(root: string, label: string) {
  const base = resolve(root)
  const target = resolve(base, label)
  return target === base || target.startsWith(`${base}/`) ? target : null
}

export function packageExists(label: string, root: string = PROJECTS_DIR) {
  const dir = resolveWithin(root, label)
  return dir !== null && existsSync(join(dir, CONFIG_FILE))
}

export function listOverlayPackageLabels(root: string = PROJECTS_DIR) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, CONFIG_FILE)))
    .map((d) => d.name)
    .sort()
}

export async function listOverlayPackages(root: string = PROJECTS_DIR): Promise<OverlayPackageConfig[]> {
  const labels = listOverlayPackageLabels(root)
  const configs = await Promise.all(
    labels.map(async (label) => {
      const mod = await import(join(root, label, CONFIG_FILE))
      return overlayPackageConfigSchema.parse(mod.default)
    }),
  )
  return configs
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/projects/packages.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/projects/packages.ts test/projects/packages.test.ts
git commit -m "feat(projects): overlay-package scan (packageExists, listOverlayPackages)"
```

---

### Task 5: Title-registry codegen

Discovery must work under both Turbopack and Vitest, so neither `import.meta.glob` nor `require.context` is usable. Instead a **pure** scanner + source emitter produces `lib/titles/generated.ts` full of ordinary static imports. Keeping the logic pure and the script a thin IO shell is what makes this testable.

**Files:**
- Create: `lib/titles/codegen.ts`, `scripts/generate-title-registry.ts`, `lib/titles/generated.ts` (emitted, committed)
- Modify: `package.json` (`titles:generate`, `predev`, `prebuild`)
- Test: `test/titles/codegen.test.ts`

**Interfaces:**
- Consumes: `PROJECTS_DIR` (Task 4); the package from Task 3.
- Produces: `scanTitleDirs(root?)` → `TitleLocation[]` (`{ packageLabel, key }`, sorted); `buildRegistrySource(locations)` → string; `generatedTitles: TitleEntry[]` from `@/lib/titles/generated`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
// test/titles/codegen.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanTitleDirs, buildRegistrySource } from '@/lib/titles/codegen'

let root: string

function makeTitle(pkg: string, key: string, files: string[]) {
  const dir = join(root, pkg, 'titles', key)
  mkdirSync(dir, { recursive: true })
  files.forEach((f) => writeFileSync(join(dir, f), ''))
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ets-codegen-'))
  mkdirSync(join(root, 'alpha'), { recursive: true })
  writeFileSync(join(root, 'alpha', 'project.config.ts'), '')
  makeTitle('alpha', 'scoreboard', ['index.tsx', 'model.ts', 'settings.ts'])
  makeTitle('alpha', 'lower-third', ['index.tsx', 'model.ts', 'settings.ts'])
  // Incomplete: missing settings.ts — must be skipped, not half-registered.
  makeTitle('alpha', 'broken', ['index.tsx', 'model.ts'])
  // A package with no titles/ directory at all.
  mkdirSync(join(root, 'empty'), { recursive: true })
  writeFileSync(join(root, 'empty', 'project.config.ts'), '')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scanTitleDirs', () => {
  it('finds every complete three-file title, sorted', () => {
    expect(scanTitleDirs(root)).toEqual([
      { packageLabel: 'alpha', key: 'lower-third' },
      { packageLabel: 'alpha', key: 'scoreboard' },
    ])
  })

  it('skips a title missing one of the three files', () => {
    expect(scanTitleDirs(root).some((t) => t.key === 'broken')).toBe(false)
  })

  it('returns an empty list for a missing root', () => {
    expect(scanTitleDirs(join(root, 'nope'))).toEqual([])
  })
})

describe('buildRegistrySource', () => {
  const source = buildRegistrySource([
    { packageLabel: 'alpha', key: 'lower-third' },
    { packageLabel: 'alpha', key: 'scoreboard' },
  ])

  it('marks the file as generated', () => {
    expect(source).toContain('AUTO-GENERATED')
  })

  it('emits a static import per title file', () => {
    expect(source).toContain("import Component0 from '@/projects/alpha/titles/lower-third'")
    expect(source).toContain("import * as model0 from '@/projects/alpha/titles/lower-third/model'")
    expect(source).toContain("import settings0 from '@/projects/alpha/titles/lower-third/settings'")
    expect(source).toContain("import Component1 from '@/projects/alpha/titles/scoreboard'")
  })

  it('emits one entry per title with its key and package', () => {
    expect(source).toContain("key: 'lower-third'")
    expect(source).toContain("packageLabel: 'alpha'")
    expect(source).toContain('actions: model0.actions')
  })

  it('emits valid empty output for no titles', () => {
    const empty = buildRegistrySource([])
    expect(empty).toContain('export const generatedTitles')
    expect(empty).not.toContain('import Component0')
  })

  it('writes no semicolons, matching house style', () => {
    expect(source.split('\n').some((line) => line.trimEnd().endsWith(';'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/titles/codegen.test.ts`
Expected: FAIL — cannot resolve `@/lib/titles/codegen`.

- [ ] **Step 3: Implement the pure codegen**

```ts
// lib/titles/codegen.ts
// Title discovery is build-time codegen, not a runtime glob: import.meta.glob is
// Vite-only and require.context is webpack-only, but this app must resolve titles
// under BOTH Turbopack and Vitest. Emitting plain static imports works everywhere.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECTS_DIR } from '@/lib/projects/packages'

export type TitleLocation = {
  packageLabel: string
  key: string
}

const REQUIRED_FILES = ['index.tsx', 'model.ts', 'settings.ts']

export function scanTitleDirs(root: string = PROJECTS_DIR): TitleLocation[] {
  if (!existsSync(root)) return []

  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((pkg) => {
      const titlesDir = join(root, pkg.name, 'titles')
      if (!existsSync(titlesDir)) return []
      return readdirSync(titlesDir, { withFileTypes: true })
        .filter((t) => t.isDirectory())
        .filter((t) => REQUIRED_FILES.every((f) => existsSync(join(titlesDir, t.name, f))))
        .map((t) => ({ packageLabel: pkg.name, key: t.name }))
    })
    .sort((a, b) => `${a.packageLabel}/${a.key}`.localeCompare(`${b.packageLabel}/${b.key}`))
}

export function buildRegistrySource(locations: TitleLocation[]) {
  const imports = locations
    .map((loc, i) => {
      const path = `@/projects/${loc.packageLabel}/titles/${loc.key}`
      return [
        `import Component${i} from '${path}'`,
        `import * as model${i} from '${path}/model'`,
        `import settings${i} from '${path}/settings'`,
      ].join('\n')
    })
    .join('\n')

  const entries = locations
    .map(
      (loc, i) => `  {
    key: '${loc.key}',
    packageLabel: '${loc.packageLabel}',
    Component: Component${i} as TitleEntry['Component'],
    model: model${i}.model,
    actions: model${i}.actions,
    settings: titleSettingsSchema.parse(settings${i}),
  },`,
    )
    .join('\n')

  return `// AUTO-GENERATED by scripts/generate-title-registry.ts — do not edit.
// Regenerate with: npm run titles:generate
import { titleSettingsSchema, type TitleEntry } from './types'
${imports}

export const generatedTitles: TitleEntry[] = [
${entries}
]
`
}
```

- [ ] **Step 4: Implement the script and wire the npm scripts**

```ts
// scripts/generate-title-registry.ts
// Thin IO shell around lib/titles/codegen.ts (which holds the testable logic).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanTitleDirs, buildRegistrySource } from '../lib/titles/codegen'

const locations = scanTitleDirs()
const out = join(process.cwd(), 'lib', 'titles', 'generated.ts')
writeFileSync(out, buildRegistrySource(locations))
console.log(`Generated ${locations.length} title(s) -> lib/titles/generated.ts`)
```

Add to `package.json` `scripts` (keep the existing entries):

```json
{
  "titles:generate": "tsx scripts/generate-title-registry.ts",
  "predev": "npm run titles:generate",
  "prebuild": "npm run titles:generate"
}
```

> `predev`/`prebuild` gain `assets:sync` in Task 7 — chain them there, don't duplicate.

- [ ] **Step 5: Generate the file and verify it matches the package**

Run: `npm run titles:generate`
Expected: prints `Generated 2 title(s) -> lib/titles/generated.ts`.

Run: `npx vitest run test/titles/codegen.test.ts && npm run typecheck && npm run lint`
Expected: PASS, and `lib/titles/generated.ts` type-checks and lints (it is committed, so it must satisfy both).

- [ ] **Step 6: Commit**

```bash
git add lib/titles/codegen.ts lib/titles/generated.ts scripts/generate-title-registry.ts \
        package.json test/titles/codegen.test.ts
git commit -m "feat(titles): build-time registry codegen (works under Turbopack and Vitest)"
```

---

### Task 6: Registry accessors

The runtime surface every consumer uses: the Add-Template modal (list titles), API mutation handlers (validate `data`), the `/command` route (allow-list actions), and the broadcast renderer (resolve `Component`).

**Files:**
- Create: `lib/titles/registry.ts`
- Test: `test/titles/registry.test.ts`

**Interfaces:**
- Consumes: `generatedTitles` (Task 5), `TitleEntry`/`TitleRegistry` (Task 1).
- Produces: `getTitleRegistry(packageLabel)`, `getTitleEntry(packageLabel, titleKey)`, `getTitleModel(packageLabel, titleKey)`, `getTitleActions(packageLabel, titleKey)`, `isDeclaredAction(packageLabel, titleKey, action)`, `listTitles(packageLabel)`.

- [ ] **Step 1: Write the failing test**

```ts
// test/titles/registry.test.ts
import { describe, it, expect } from 'vitest'
import {
  getTitleRegistry,
  getTitleEntry,
  getTitleModel,
  getTitleActions,
  isDeclaredAction,
  listTitles,
} from '@/lib/titles/registry'

describe('getTitleRegistry', () => {
  it('indexes the default package by title key', () => {
    const registry = getTitleRegistry('default')
    expect(Object.keys(registry).sort()).toEqual(['lower-third', 'opening-timer'])
  })

  it('returns an empty registry for an unknown package', () => {
    expect(getTitleRegistry('ghost')).toEqual({})
  })
})

describe('getTitleEntry', () => {
  it('resolves the full title entity', () => {
    const entry = getTitleEntry('default', 'opening-timer')
    expect(entry?.settings.title_name).toBe('Opening Timer')
    expect(entry?.settings.title_is_full_screen).toBe(true)
    expect(typeof entry?.Component).toBe('function')
    expect(entry?.actions).toEqual(['start', 'stop', 'reset'])
  })

  it('is undefined for an unknown title', () => {
    expect(getTitleEntry('default', 'ghost')).toBeUndefined()
  })
})

describe('getTitleModel', () => {
  it('validates data for the title it belongs to', () => {
    const model = getTitleModel('default', 'lower-third')
    expect(model?.safeParse({ playerName: 'Casey Liu' }).success).toBe(true)
    expect(model?.safeParse({ teamName: 'no name' }).success).toBe(false)
  })

  it('is undefined for an unknown title', () => {
    expect(getTitleModel('default', 'ghost')).toBeUndefined()
  })
})

describe('getTitleActions / isDeclaredAction', () => {
  it('returns the declared actions', () => {
    expect(getTitleActions('default', 'opening-timer')).toEqual(['start', 'stop', 'reset'])
    expect(getTitleActions('default', 'lower-third')).toEqual([])
  })

  it('returns an empty list for an unknown title rather than throwing', () => {
    expect(getTitleActions('default', 'ghost')).toEqual([])
  })

  it('accepts a declared action', () => {
    expect(isDeclaredAction('default', 'opening-timer', 'start')).toBe(true)
  })

  it('rejects an undeclared action — this is what the /command route 400s on', () => {
    expect(isDeclaredAction('default', 'opening-timer', 'explode')).toBe(false)
    expect(isDeclaredAction('default', 'lower-third', 'start')).toBe(false)
  })

  it('rejects a universal action — those are routes, not commands', () => {
    expect(isDeclaredAction('default', 'opening-timer', 'air')).toBe(false)
    expect(isDeclaredAction('default', 'opening-timer', 'update')).toBe(false)
  })
})

describe('listTitles', () => {
  it('lists entries for the Add Template modal, sorted by display name', () => {
    expect(listTitles('default').map((t) => t.settings.title_name)).toEqual(['Lower Third', 'Opening Timer'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/titles/registry.test.ts`
Expected: FAIL — cannot resolve `@/lib/titles/registry`.

- [ ] **Step 3: Implement**

```ts
// lib/titles/registry.ts
import { generatedTitles } from './generated'
import type { TitleEntry, TitleRegistry } from './types'

// Built once at module load from the generated static imports.
const byPackage = generatedTitles.reduce<Record<string, TitleRegistry>>((acc, entry) => {
  acc[entry.packageLabel] ??= {}
  acc[entry.packageLabel][entry.key] = entry
  return acc
}, {})

export function getTitleRegistry(packageLabel: string): TitleRegistry {
  return byPackage[packageLabel] ?? {}
}

export function getTitleEntry(packageLabel: string, titleKey: string): TitleEntry | undefined {
  return getTitleRegistry(packageLabel)[titleKey]
}

export function getTitleModel(packageLabel: string, titleKey: string) {
  return getTitleEntry(packageLabel, titleKey)?.model
}

export function getTitleActions(packageLabel: string, titleKey: string): readonly string[] {
  return getTitleEntry(packageLabel, titleKey)?.actions ?? []
}

// The allow-list POST .../items/[itemId]/command validates against. Universal
// actions (air/preview/hide/update) are separate routes and are never commands.
export function isDeclaredAction(packageLabel: string, titleKey: string, action: string) {
  return getTitleActions(packageLabel, titleKey).includes(action)
}

export function listTitles(packageLabel: string): TitleEntry[] {
  return Object.values(getTitleRegistry(packageLabel)).sort((a, b) =>
    a.settings.title_name.localeCompare(b.settings.title_name),
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/titles/registry.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/titles/registry.ts test/titles/registry.test.ts
git commit -m "feat(titles): registry accessors (entry, model, actions, isDeclaredAction)"
```

---

### Task 7: Static-asset pipeline

Next only serves static files from `public/`, but fonts, logos, stingers and `project.css` live beside title source. Copy them at build time. Uses Node built-ins (`cpSync`, `fs.watch`) rather than `fs-extra` + `chokidar` — two fewer dependencies for ~15 lines of code.

**Files:**
- Create: `lib/projects/assets.ts`, `scripts/sync-project-assets.ts`
- Modify: `package.json` (`assets:sync`, `dev:assets`, `predev`, `prebuild`), `.gitignore`
- Test: `test/projects/assets.test.ts`

**Interfaces:**
- Consumes: `listOverlayPackageLabels` (Task 4).
- Produces: `syncProjectAssets({ src, dst })` → `string[]` of copied `"<label>/<subdir>"` pairs.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
// test/projects/assets.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncProjectAssets } from '@/lib/projects/assets'

let src: string
let dst: string

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'ets-assets-'))
  src = join(base, 'projects')
  dst = join(base, 'public', 'projects')
  mkdirSync(join(src, 'alpha', 'assets', 'fonts'), { recursive: true })
  mkdirSync(join(src, 'alpha', 'styles'), { recursive: true })
  writeFileSync(join(src, 'alpha', 'project.config.ts'), '')
  writeFileSync(join(src, 'alpha', 'assets', 'fonts', 'Display.woff2'), 'FONT')
  writeFileSync(join(src, 'alpha', 'styles', 'project.css'), ':root{--x:1}')
  // A package with no assets/ or styles/ must not crash the sync.
  mkdirSync(join(src, 'bare'), { recursive: true })
  writeFileSync(join(src, 'bare', 'project.config.ts'), '')
})

afterEach(() => {
  rmSync(join(src, '..'), { recursive: true, force: true })
})

describe('syncProjectAssets', () => {
  it('copies assets and styles into the public tree', () => {
    syncProjectAssets({ src, dst })
    expect(readFileSync(join(dst, 'alpha', 'assets', 'fonts', 'Display.woff2'), 'utf8')).toBe('FONT')
    expect(readFileSync(join(dst, 'alpha', 'styles', 'project.css'), 'utf8')).toBe(':root{--x:1}')
  })

  it('reports what it copied', () => {
    expect(syncProjectAssets({ src, dst }).sort()).toEqual(['alpha/assets', 'alpha/styles'])
  })

  it('skips a package with neither assets nor styles', () => {
    syncProjectAssets({ src, dst })
    expect(existsSync(join(dst, 'bare'))).toBe(false)
  })

  it('overwrites a stale copy on re-run', () => {
    syncProjectAssets({ src, dst })
    writeFileSync(join(src, 'alpha', 'styles', 'project.css'), ':root{--x:2}')
    syncProjectAssets({ src, dst })
    expect(readFileSync(join(dst, 'alpha', 'styles', 'project.css'), 'utf8')).toBe(':root{--x:2}')
  })

  it('returns an empty list when there are no packages', () => {
    expect(syncProjectAssets({ src: join(src, 'nowhere'), dst })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/projects/assets.test.ts`
Expected: FAIL — cannot resolve `@/lib/projects/assets`.

- [ ] **Step 3: Implement**

```ts
// lib/projects/assets.ts
// public/projects/ is a derived artifact (git-ignored): Next only serves static
// files from public/, but package assets live beside their title source.
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { listOverlayPackageLabels } from './packages'

const SYNCED_SUBDIRS = ['assets', 'styles']

export function syncProjectAssets({ src, dst }: { src: string; dst: string }): string[] {
  return listOverlayPackageLabels(src).flatMap((label) =>
    SYNCED_SUBDIRS.filter((sub) => existsSync(join(src, label, sub))).map((sub) => {
      cpSync(join(src, label, sub), join(dst, label, sub), { recursive: true, force: true })
      return `${label}/${sub}`
    }),
  )
}
```

```ts
// scripts/sync-project-assets.ts
import { join } from 'node:path'
import { watch } from 'node:fs'
import { syncProjectAssets } from '../lib/projects/assets'

const src = join(process.cwd(), 'projects')
const dst = join(process.cwd(), 'public', 'projects')

function run() {
  const copied = syncProjectAssets({ src, dst })
  console.log(`Synced ${copied.length} folder(s) -> public/projects/`)
}

run()

if (process.argv.includes('--watch')) {
  // Recursive watch is supported on macOS and Windows (the dev platforms);
  // CI/Netlify only ever runs the one-shot prebuild path.
  watch(src, { recursive: true }, () => run())
  console.log('Watching project assets…')
}
```

- [ ] **Step 4: Wire the npm scripts and git-ignore the output**

`package.json` `scripts` — note `predev`/`prebuild` now chain **both** generators:

```json
{
  "assets:sync": "tsx scripts/sync-project-assets.ts",
  "dev:assets": "tsx scripts/sync-project-assets.ts --watch",
  "titles:generate": "tsx scripts/generate-title-registry.ts",
  "predev": "npm run titles:generate && npm run assets:sync",
  "prebuild": "npm run titles:generate && npm run assets:sync"
}
```

Append to `.gitignore`:

```
# Derived: synced from projects/*/{assets,styles}
public/projects/
```

- [ ] **Step 5: Verify end to end**

Run: `npm run assets:sync`
Expected: prints `Synced 2 folder(s) -> public/projects/`, and `public/projects/default/styles/project.css` exists.

Run: `npx vitest run test/projects/assets.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

Run: `git status --short public/`
Expected: no output — the synced tree is ignored.

- [ ] **Step 6: Commit**

```bash
git add lib/projects/assets.ts scripts/sync-project-assets.ts package.json .gitignore \
        test/projects/assets.test.ts
git commit -m "feat(projects): static-asset sync (node built-ins, no fs-extra/chokidar)"
```

---

### Task 8: Dev title-preview page

Lets a title author iterate visually before the rundown editor exists — mounts every registered title against sample data, with the package's `project.css` loaded so CSS variables actually resolve.

**Files:**
- Create: `app/_dev/title-preview/page.tsx`
- Delete: `app/_dev/scss-check/SampleTitle.tsx`, `app/_dev/scss-check/SampleTitle.module.scss`, `test/scss/sample-title.test.tsx`
- Test: `test/app/title-preview.test.tsx`

**Interfaces:**
- Consumes: `listTitles` (Task 6).
- Produces: the dev-only route `/_dev/title-preview`.

> The P0 `scss-check` sample existed only to prove the SCSS pipeline compiled. Task 3's real titles supersede it — remove it rather than leaving two SCSS demos.

- [ ] **Step 1: Write the failing test**

```tsx
// test/app/title-preview.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TitlePreviewPage, { SAMPLE_DATA } from '@/app/_dev/title-preview/page'

describe('TitlePreviewPage', () => {
  it('renders a section per registered title', () => {
    render(<TitlePreviewPage />)
    expect(screen.getByRole('heading', { name: 'Lower Third' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Opening Timer' })).toBeInTheDocument()
  })

  it('renders each title against its sample data', () => {
    render(<TitlePreviewPage />)
    expect(screen.getByText('Casey Liu')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
  })

  it('keeps sample data valid against every title model', async () => {
    const { getTitleModel } = await import('@/lib/titles/registry')
    Object.entries(SAMPLE_DATA).forEach(([key, data]) => {
      expect(getTitleModel('default', key)?.safeParse(data).success).toBe(true)
    })
  })

  it('loads the package stylesheet so CSS variables resolve', () => {
    const { container } = render(<TitlePreviewPage />)
    const link = container.querySelector('link[rel="stylesheet"]')
    expect(link?.getAttribute('href')).toBe('/projects/default/styles/project.css')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/app/title-preview.test.tsx`
Expected: FAIL — cannot resolve `@/app/_dev/title-preview/page`.

- [ ] **Step 3: Implement**

```tsx
// app/_dev/title-preview/page.tsx
// DEV ONLY — iterate on titles visually before the rundown editor exists.
// Visit http://localhost:3000/_dev/title-preview
'use client'

import { listTitles } from '@/lib/titles/registry'

const PACKAGE_LABEL = 'default'

export const SAMPLE_DATA: Record<string, unknown> = {
  'lower-third': { playerName: 'Casey Liu', teamName: 'Boom Squad' },
  'opening-timer': { hours: 0, minutes: 15, seconds: 0, main_text: 'Kickoff', subtitle: 'Main Stage' },
}

export default function TitlePreviewPage() {
  return (
    <>
      <link
        rel="stylesheet"
        href={`/projects/${PACKAGE_LABEL}/styles/project.css`}
      />
      {listTitles(PACKAGE_LABEL).map((entry) => {
        const Title = entry.Component as (props: { data: unknown }) => React.ReactNode
        return (
          <section key={entry.key}>
            <h2>{entry.settings.title_name}</h2>
            <Title data={SAMPLE_DATA[entry.key]} />
          </section>
        )
      })}
    </>
  )
}
```

- [ ] **Step 4: Remove the superseded P0 SCSS sample**

```bash
git rm app/_dev/scss-check/SampleTitle.tsx \
       app/_dev/scss-check/SampleTitle.module.scss \
       test/scss/sample-title.test.tsx
```

- [ ] **Step 5: Run the full verification**

Run: `npx vitest run test/app/title-preview.test.tsx`
Expected: PASS.

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green; `next build` lists `/_dev/title-preview` and runs no migrations.

- [ ] **Step 6: Commit**

```bash
git add app/_dev test/app/title-preview.test.tsx
git commit -m "feat(titles): dev title-preview page; drop the superseded scss-check sample"
```

---

### Task 9: Sync docs to what P3 shipped

`docs/` is the source of truth for later plans — record the codegen decision and the `models/` layer so P4/P5a build against reality.

**Files:**
- Modify: `docs/titles-system.md`, `docs/projects-system.md`, `docs/superpowers/specs/2026-06-18-base-app-scope.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything Tasks 1–8 produced.
- Produces: docs P4 and P5a can trust.

- [ ] **Step 1: Update `docs/titles-system.md`**

- Replace the "How titles are discovered" sketch (the `import.meta.glob` / webpack note) with the shipped design: `scripts/generate-title-registry.ts` → `lib/titles/generated.ts` → `lib/titles/registry.ts`, and **why** (neither `import.meta.glob` nor `require.context` works in both Turbopack and Vitest). State that `npm run titles:generate` runs automatically via `predev`/`prebuild`, and that adding a title requires re-running it.
- Add a **shared models** section: `models/<TitleType>.ts` exports reusable fields + declared command actions; a package's `model.ts` composes with `.omit()`/`.extend()` and re-exports `actions`.
- Record the contract reconciliation: `settings.ts` default-exports presentation only; the **registry entry** is the full title entity (`{ Component, model, actions, settings }`).
- Update the registry sketch to the shipped `TitleEntry` (it now carries `actions`).
- Note that a title is skipped by the scan unless all three files are present.

- [ ] **Step 2: Update `docs/projects-system.md`**

- Replace the `listOverlayPackages` sketch with the shipped `lib/projects/packages.ts` (including `listOverlayPackageLabels` and the path-escape guard on `label`).
- Replace the `fs-extra`/`chokidar` asset-sync script with the shipped `lib/projects/assets.ts` + `scripts/sync-project-assets.ts` (Node built-ins), and correct the `package.json` block to the shipped `predev`/`prebuild` chain.

- [ ] **Step 3: Update the scope doc and CLAUDE.md**

`docs/superpowers/specs/2026-06-18-base-app-scope.md`:
- Flip **P3** to ✅ done with a one-line summary of what shipped; mark **P4** as next.

`CLAUDE.md`:
- In the "load-bearing decisions" section, extend decision 3 to mention the shared `models/` layer and declared command actions.
- Add `npm run titles:generate` to the commands table, and correct the `assets:sync`/`dev:assets` rows to say they are chained from `predev`/`prebuild` alongside the title codegen.

- [ ] **Step 4: Sweep for contradictions**

Run: `grep -rn "import.meta.glob\|require.context\|fs-extra\|chokidar" docs CLAUDE.md --exclude-dir=superpowers`
Expected: no matches.

- [ ] **Step 5: Final verification**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs(titles): sync titles/projects docs to the shipped P3 contract"
```

---

## Self-review notes

- **Spec coverage.** `models/<TitleType>.ts` with fields + actions → T2. Per-package `model.ts` composing via `.omit()`/`.extend()` → T3. `settings.ts` presentation → T1 (schema) + T3 (instances). `index.tsx` rendering `data` with `onCommand` → T1 (`TitleProps`) + T3 (OpeningTimer). Registry returning `{ Component, model, settings, actions }` → T5/T6. `project.config.ts` + package scan feeding Add Project → T4. Example package styled in SCSS against `project.css` → T3. `assets:sync` → T7. Dev preview page → T8.
- **Deliberately deferred, and to where.** The **widget / thread-widget UI** is P5a+P5b (this plan ships only the declarations they read). `TitleRenderer` wiring `onCommand` to a filtered command stream is **P4** (`useTitleStream`); `TitleProps.onCommand` is the seam it plugs into. The **entity-reference field type** (the player picker) stays an open question in the title-contract spec — it needs `players`, which is P6; `model.ts` composition doesn't block on it.
- **Type consistency.** `TitleEntry` is defined once (T1) and used verbatim by the emitted source (T5) and the accessors (T6). `TitleProps<TData>`/`CommandHandler` are used by T3's components and T3's tests. `PROJECTS_DIR` is defined in T4 and imported by T5. `listOverlayPackageLabels` is defined in T4 and reused by T7 — the asset sync and the package dropdown therefore agree on what counts as a package.
- **`isDeclaredAction` is the P5b seam.** The `/command` route's 400-on-unknown-action requirement reduces to one call; the tests pin that universal actions (`air`, `update`) are *not* commands.
- **Why the `layer` column is absent here.** It belongs to `rundown_items`, not to the title contract, and remains Task 1 of the multi-layer plan.
