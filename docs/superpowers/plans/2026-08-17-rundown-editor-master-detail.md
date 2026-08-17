# Rundown Editor — Master-Detail Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dialog-based rundown overlay editor with a master-detail two-pane editor (left listing with preview thumbnails + color filter, right pane that swaps between an add-template grid and a properties form), frontend-only.

**Architecture:** In-place refactor. Extract small presentational components under `components/admin/overlays/` (all take plain props, no RTK hooks — the page owns state and data hooks), then rewrite the editor page to compose them. Reuse the existing create-on-pick API, RTK hooks, `OverlayWidgetForm`, and the up/down reorder route unchanged. No schema or API changes.

**Tech Stack:** Next.js 16 App Router (React 19, `'use client'`), TypeScript, MUI, RTK Query, Vitest + React Testing Library (jsdom).

## Global Constraints

- **No schema or API changes.** Reuse the existing `rundownOverlaysApi` hooks and routes verbatim; no migration.
- **No new runtime dependencies.** No drag-and-drop library. Reorder stays as up/down arrows via the existing reorder route.
- All new components live in `components/admin/overlays/` and take **plain props + callbacks** (no RTK Query hooks inside them) so they unit-test without a store.
- Tests go under `test/components/admin/overlays/`, using `render`/`screen` from `@testing-library/react` (jsdom is global; setup is `test/setup.ts`).
- Lint: max line length 140, one JSX expression per line — run `npx eslint --fix <files>` before committing if formatting trips the linter.
- The reused type is `RundownOverlay` from `@/store/apis/rundownOverlaysApi`; the catalog type is `CatalogEntry` from `@/lib/overlays/types`.
- Color values are 1–7; layer values are 1–7; `displayFilter` is `'' | '1'..'10'` (string, nullable).

---

### Task 1: Shared primitives — color swatches + thumbnail

**Files:**
- Create: `components/admin/overlays/overlayColors.ts`
- Create: `components/admin/overlays/OverlayThumbnail.tsx`
- Test: `test/components/admin/overlays/OverlayThumbnail.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `OVERLAY_COLORS: string[]` (7 hex strings, index 0 = color 1).
  - `overlayColor(n: number): string` — returns the swatch for color `n` (1–7), clamped.
  - `OverlayThumbnail({ src, label, width?, height? }: { src?: string | null; label: string; width?: number; height?: number })` — renders an `<img>` when `src` is a non-empty string, otherwise a labeled fallback `<Box>` (no `<img>`).

- [ ] **Step 1: Write the color helper**

`components/admin/overlays/overlayColors.ts`:
```ts
// UI tag swatches for overlay color 1..7 (admin listing only — broadcast
// colors come from the tournament theme). Index 0 === color 1.
export const OVERLAY_COLORS = [
  '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#607d8b',
]

export function overlayColor(n: number): string {
  const i = Math.min(Math.max(Math.trunc(n) - 1, 0), OVERLAY_COLORS.length - 1)
  return OVERLAY_COLORS[i]
}
```

- [ ] **Step 2: Write the failing test for the thumbnail fallback**

`test/components/admin/overlays/OverlayThumbnail.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayThumbnail } from '@/components/admin/overlays/OverlayThumbnail'

describe('OverlayThumbnail', () => {
  it('renders an img when src is present', () => {
    const { container } = render(<OverlayThumbnail src="/x.png" label="Text" />)
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders a labeled fallback (no img) when src is absent', () => {
    const { container } = render(<OverlayThumbnail src={null} label="Text" />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/Text/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- OverlayThumbnail`
Expected: FAIL — cannot resolve `@/components/admin/overlays/OverlayThumbnail`.

- [ ] **Step 4: Implement the thumbnail**

`components/admin/overlays/OverlayThumbnail.tsx`:
```tsx
import { Box } from '@mui/material'

export function OverlayThumbnail({
  src, label, width = 128, height = 72,
}: {
  src?: string | null
  label: string
  width?: number
  height?: number
}) {
  if (src) {
    return (
      <Box component="img"
        src={src}
        alt={label}
        sx={{ width, height, objectFit: 'cover', borderRadius: 1, display: 'block' }} />
    )
  }
  return (
    <Box sx={{
      width,
      height,
      borderRadius: 1,
      border: '1px dashed',
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'text.secondary',
      fontSize: 11,
      textAlign: 'center',
      px: 0.5,
    }}>
      {label}
    </Box>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- OverlayThumbnail`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add components/admin/overlays/overlayColors.ts components/admin/overlays/OverlayThumbnail.tsx test/components/admin/overlays/OverlayThumbnail.test.tsx
git commit -m "feat(editor): overlay color swatches + thumbnail-with-fallback primitive"
```

---

### Task 2: Color filter

**Files:**
- Create: `components/admin/overlays/OverlayColorFilter.tsx`
- Test: `test/components/admin/overlays/OverlayColorFilter.test.tsx`

**Interfaces:**
- Consumes: `overlayColor` from `overlayColors.ts`.
- Produces: `OverlayColorFilter({ active, onToggle }: { active: Set<number>; onToggle: (color: number) => void })` — 7 clickable swatch chips (color 1–7); a chip reads "on" when `active.has(n)`; clicking chip `n` calls `onToggle(n)`.

- [ ] **Step 1: Write the failing test**

`test/components/admin/overlays/OverlayColorFilter.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayColorFilter } from '@/components/admin/overlays/OverlayColorFilter'

describe('OverlayColorFilter', () => {
  it('renders 7 color toggles and reports clicks', () => {
    const onToggle = vi.fn()
    render(<OverlayColorFilter active={new Set()}
      onToggle={onToggle} />)
    const toggles = screen.getAllByRole('button', { name: /color \d/i })
    expect(toggles).toHaveLength(7)
    toggles[2].click()
    expect(onToggle).toHaveBeenCalledWith(3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- OverlayColorFilter`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the filter**

`components/admin/overlays/OverlayColorFilter.tsx`:
```tsx
import { Box, IconButton, Tooltip } from '@mui/material'
import { overlayColor } from './overlayColors'

const COLORS = [1, 2, 3, 4, 5, 6, 7]

export function OverlayColorFilter({
  active, onToggle,
}: {
  active: Set<number>
  onToggle: (color: number) => void
}) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {COLORS.map((n) => (
        <Tooltip key={n}
          title={`Color ${n}`}>
          <IconButton size="small"
            aria-label={`Color ${n}`}
            onClick={() => onToggle(n)}
            sx={{
              width: 20,
              height: 20,
              p: 0,
              bgcolor: overlayColor(n),
              opacity: active.size === 0 || active.has(n) ? 1 : 0.3,
              border: active.has(n) ? '2px solid' : '2px solid transparent',
              borderColor: active.has(n) ? 'text.primary' : 'transparent',
              '&:hover': { bgcolor: overlayColor(n) },
            }} />
        </Tooltip>
      ))}
    </Box>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- OverlayColorFilter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/overlays/OverlayColorFilter.tsx test/components/admin/overlays/OverlayColorFilter.test.tsx
git commit -m "feat(editor): overlay color filter chips"
```

---

### Task 3: Overlay card

**Files:**
- Create: `components/admin/overlays/OverlayCard.tsx`
- Test: `test/components/admin/overlays/OverlayCard.test.tsx`

**Interfaces:**
- Consumes: `overlayColor` from `overlayColors.ts`; `OverlayThumbnail`; `RundownOverlay` type from `@/store/apis/rundownOverlaysApi`.
- Produces: `OverlayCard({ overlay, selected, reorderable, canMoveUp, canMoveDown, onSelect, onMoveUp, onMoveDown, onDelete })` where props are `{ overlay: RundownOverlay; selected: boolean; reorderable: boolean; canMoveUp: boolean; canMoveDown: boolean; onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void }`. Renders thumbnail (from `overlay.previewImg`, fallback label = `overlay.widgetName`), a left color stripe, `widgetName`, a category badge, an `L{layer}` chip, a `display {n}` chip when `displayFilter` is truthy, up/down icon buttons only when `reorderable`, and a delete icon button. Clicking the card body calls `onSelect`; the buttons stop propagation.

- [ ] **Step 1: Write the failing test**

`test/components/admin/overlays/OverlayCard.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayCard } from '@/components/admin/overlays/OverlayCard'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'

const overlay: RundownOverlay = {
  id: 5, rundownId: 2, projectId: 3, model: 'general-text', category: 'general',
  template: 'Text', widgetName: 'Lower Third', layer: 4, color: 2,
  displayFilter: '1', previewImg: null, isFullscreen: false, hasNextButton: false,
  order: 0, data: { widget: { text: 'hi' } },
}

function props(over: Partial<Parameters<typeof OverlayCard>[0]> = {}) {
  return {
    overlay, selected: false, reorderable: true, canMoveUp: true, canMoveDown: true,
    onSelect: vi.fn(), onMoveUp: vi.fn(), onMoveDown: vi.fn(), onDelete: vi.fn(), ...over,
  }
}

describe('OverlayCard', () => {
  it('shows name, layer chip, display chip, and a fallback thumbnail', () => {
    const { container } = render(<OverlayCard {...props()} />)
    expect(screen.getByText('Lower Third')).toBeInTheDocument()
    expect(screen.getByText(/L4/)).toBeInTheDocument()
    expect(screen.getByText(/display 1/i)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull() // previewImg is null
  })

  it('selecting fires onSelect; delete fires onDelete', () => {
    const p = props()
    render(<OverlayCard {...p} />)
    screen.getByText('Lower Third').click()
    expect(p.onSelect).toHaveBeenCalled()
    screen.getByLabelText(/delete/i).click()
    expect(p.onDelete).toHaveBeenCalled()
  })

  it('hides move buttons when not reorderable', () => {
    render(<OverlayCard {...props({ reorderable: false })} />)
    expect(screen.queryByLabelText(/move up/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- OverlayCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the card**

`components/admin/overlays/OverlayCard.tsx`:
```tsx
import {
  Box, Card, CardContent, Chip, IconButton, Typography,
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteIcon from '@mui/icons-material/Delete'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { overlayColor } from './overlayColors'
import { OverlayThumbnail } from './OverlayThumbnail'

export function OverlayCard({
  overlay, selected, reorderable, canMoveUp, canMoveDown,
  onSelect, onMoveUp, onMoveDown, onDelete,
}: {
  overlay: RundownOverlay
  selected: boolean
  reorderable: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  function stop(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      fn()
    }
  }
  return (
    <Card onClick={onSelect}
      sx={{
        mb: 1,
        cursor: 'pointer',
        position: 'relative',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
      }}>
      <Box sx={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: overlayColor(overlay.color),
      }} />
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 3 }}>
        <OverlayThumbnail src={overlay.previewImg}
          label={overlay.widgetName} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1"
            noWrap>
            {overlay.widgetName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small"
              label={overlay.category ?? overlay.model} />
            <Chip size="small"
              label={`L${overlay.layer}`} />
            {overlay.displayFilter ? (
              <Chip size="small"
                label={`display ${overlay.displayFilter}`} />
            ) : null}
          </Box>
        </Box>
        {reorderable ? (
          <>
            <IconButton size="small"
              aria-label="Move up"
              disabled={!canMoveUp}
              onClick={stop(onMoveUp)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
              aria-label="Move down"
              disabled={!canMoveDown}
              onClick={stop(onMoveDown)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </>
        ) : null}
        <IconButton size="small"
          aria-label="Delete"
          color="error"
          onClick={stop(onDelete)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- OverlayCard`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/admin/overlays/OverlayCard.tsx test/components/admin/overlays/OverlayCard.test.tsx
git commit -m "feat(editor): overlay listing card with thumbnail, color stripe, chips"
```

---

### Task 4: Listing (filter + cards + add)

**Files:**
- Create: `components/admin/overlays/RundownOverlayListing.tsx`
- Test: `test/components/admin/overlays/RundownOverlayListing.test.tsx`

**Interfaces:**
- Consumes: `OverlayColorFilter`, `OverlayCard`, `RundownOverlay`.
- Produces: `RundownOverlayListing({ overlays, activeColors, selectedId, onToggleColor, onSelect, onReorder, onDelete, onAdd })` with props `{ overlays: RundownOverlay[]; activeColors: Set<number>; selectedId: number | null; onToggleColor: (color: number) => void; onSelect: (id: number) => void; onReorder: (orderedIds: number[]) => void; onDelete: (id: number) => void; onAdd: () => void }`. When `activeColors` is non-empty it shows only matching overlays and hides the move arrows (`reorderable=false`); otherwise it shows all overlays with arrows. The "Add overlay" button calls `onAdd`. Move up/down compute a swapped id array over the full `overlays` list and call `onReorder`.

- [ ] **Step 1: Write the failing test**

`test/components/admin/overlays/RundownOverlayListing.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RundownOverlayListing } from '@/components/admin/overlays/RundownOverlayListing'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'

function ov(id: number, color: number, name: string): RundownOverlay {
  return {
    id, rundownId: 2, projectId: 3, model: 'general-text', category: 'general',
    template: 'Text', widgetName: name, layer: 1, color, displayFilter: null,
    previewImg: null, isFullscreen: false, hasNextButton: false, order: id, data: { widget: {} },
  }
}
const overlays = [ov(1, 2, 'Alpha'), ov(2, 5, 'Beta'), ov(3, 2, 'Gamma')]

function props(over = {}) {
  return {
    overlays, activeColors: new Set<number>(), selectedId: null,
    onToggleColor: vi.fn(), onSelect: vi.fn(), onReorder: vi.fn(),
    onDelete: vi.fn(), onAdd: vi.fn(), ...over,
  }
}

describe('RundownOverlayListing', () => {
  it('shows all overlays when no color is active', () => {
    render(<RundownOverlayListing {...props()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('narrows to the active color', () => {
    render(<RundownOverlayListing {...props({ activeColors: new Set([2]) })} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).toBeNull()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('add button fires onAdd', () => {
    const p = props()
    render(<RundownOverlayListing {...p} />)
    screen.getByRole('button', { name: /add overlay/i }).click()
    expect(p.onAdd).toHaveBeenCalled()
  })

  it('moving the first overlay down swaps ids 1 and 2', () => {
    const p = props()
    render(<RundownOverlayListing {...p} />)
    screen.getAllByLabelText(/move down/i)[0].click()
    expect(p.onReorder).toHaveBeenCalledWith([2, 1, 3])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- RundownOverlayListing`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the listing**

`components/admin/overlays/RundownOverlayListing.tsx`:
```tsx
import {
  Box, Button, Card, Typography,
} from '@mui/material'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { OverlayColorFilter } from './OverlayColorFilter'
import { OverlayCard } from './OverlayCard'

export function RundownOverlayListing({
  overlays, activeColors, selectedId,
  onToggleColor, onSelect, onReorder, onDelete, onAdd,
}: {
  overlays: RundownOverlay[]
  activeColors: Set<number>
  selectedId: number | null
  onToggleColor: (color: number) => void
  onSelect: (id: number) => void
  onReorder: (orderedIds: number[]) => void
  onDelete: (id: number) => void
  onAdd: () => void
}) {
  const filtering = activeColors.size > 0
  const visible = filtering ? overlays.filter((o) => activeColors.has(o.color)) : overlays

  function move(index: number, dir: -1 | 1) {
    const ids = overlays.map((o) => o.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const tmp = ids[index]
    ids[index] = ids[j]
    ids[j] = tmp
    onReorder(ids)
  }

  return (
    <Card sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6">
          Overlays
        </Typography>
        <OverlayColorFilter active={activeColors}
          onToggle={onToggleColor} />
      </Box>
      <Button variant="contained"
        fullWidth
        onClick={onAdd}
        sx={{ mb: 2 }}>
        Add overlay
      </Button>
      {visible.length === 0 ? (
        <Typography color="text.secondary"
          variant="body2">
          {filtering ? 'No overlays for this color.' : 'No overlays yet — click Add overlay.'}
        </Typography>
      ) : null}
      {visible.map((o) => (
        <OverlayCard key={o.id}
          overlay={o}
          selected={o.id === selectedId}
          reorderable={!filtering}
          canMoveUp={overlays.indexOf(o) > 0}
          canMoveDown={overlays.indexOf(o) < overlays.length - 1}
          onSelect={() => onSelect(o.id)}
          onMoveUp={() => move(overlays.indexOf(o), -1)}
          onMoveDown={() => move(overlays.indexOf(o), 1)}
          onDelete={() => onDelete(o.id)} />
      ))}
    </Card>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- RundownOverlayListing`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/admin/overlays/RundownOverlayListing.tsx test/components/admin/overlays/RundownOverlayListing.test.tsx
git commit -m "feat(editor): rundown overlay listing with color filter + reorder"
```

---

### Task 5: Template grid (add pane)

**Files:**
- Create: `components/admin/overlays/OverlayTemplateGrid.tsx`
- Test: `test/components/admin/overlays/OverlayTemplateGrid.test.tsx`

**Interfaces:**
- Consumes: `OverlayThumbnail`; `CatalogEntry` type from `@/lib/overlays/types`.
- Produces: `OverlayTemplateGrid({ entries, onPick }: { entries: CatalogEntry[]; onPick: (model: string) => void })`. Renders one clickable card per entry — thumbnail (from the first value of `entry.preview`, else fallback labelled with `entry.widgetName`), `widgetName`, and `category`. Clicking a card calls `onPick(entry.model)`.

- [ ] **Step 1: Write the failing test**

`test/components/admin/overlays/OverlayTemplateGrid.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayTemplateGrid } from '@/components/admin/overlays/OverlayTemplateGrid'
import type { CatalogEntry } from '@/lib/overlays/types'

const entries = [
  {
    model: 'general-text', category: 'general', template: 'Text', widgetName: 'Text',
    color: 1, isFullscreen: false, zodModel: {} as never, fields: [], actions: [],
  },
  {
    model: 'general-scoreboard', category: 'general', template: 'Scoreboard', widgetName: 'Scoreboard',
    color: 2, isFullscreen: false, zodModel: {} as never, fields: [], actions: [],
  },
] as CatalogEntry[]

describe('OverlayTemplateGrid', () => {
  it('renders each entry and reports the picked model', () => {
    const onPick = vi.fn()
    render(<OverlayTemplateGrid entries={entries}
      onPick={onPick} />)
    expect(screen.getByText('Scoreboard')).toBeInTheDocument()
    screen.getByText('Text').click()
    expect(onPick).toHaveBeenCalledWith('general-text')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- OverlayTemplateGrid`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the template grid**

`components/admin/overlays/OverlayTemplateGrid.tsx`:
```tsx
import {
  Box, Card, CardActionArea, CardContent, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import type { CatalogEntry } from '@/lib/overlays/types'
import { OverlayThumbnail } from './OverlayThumbnail'

function firstPreview(preview?: Record<string, string>): string | undefined {
  if (!preview) return undefined
  return Object.values(preview)[0]
}

export function OverlayTemplateGrid({
  entries, onPick,
}: {
  entries: CatalogEntry[]
  onPick: (model: string) => void
}) {
  return (
    <Box>
      <Typography variant="h6"
        sx={{ mb: 2 }}>
        Select a template
      </Typography>
      <Grid container
        spacing={2}>
        {entries.map((e) => (
          <Grid key={e.model}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea onClick={() => onPick(e.model)}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <OverlayThumbnail src={firstPreview(e.preview)}
                    label={e.widgetName} />
                  <Typography variant="subtitle2">
                    {e.widgetName}
                  </Typography>
                  <Typography variant="caption"
                    color="text.secondary">
                    {e.category}
                    {e.isFullscreen ? ' · full-screen' : ''}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- OverlayTemplateGrid`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/overlays/OverlayTemplateGrid.tsx test/components/admin/overlays/OverlayTemplateGrid.test.tsx
git commit -m "feat(editor): overlay template grid (add pane)"
```

---

### Task 6: Properties form (configure pane)

**Files:**
- Create: `components/admin/overlays/OverlayPropertiesForm.tsx`
- Test: `test/components/admin/overlays/OverlayPropertiesForm.test.tsx`

**Interfaces:**
- Consumes: `OverlayWidgetForm` from `@/components/admin/overlays/OverlayWidgetForm`; `RundownOverlay`.
- Produces: `OverlayPropertiesForm({ overlay, onSaveSettings, onSaveWidget, onDelete })` with props `{ overlay: RundownOverlay; onSaveSettings: (patch: Partial<RundownOverlay>) => void; onSaveWidget: (widget: Record<string, unknown>) => void; onDelete: () => void }`. Holds local settings state (name/layer/color/displayFilter/isFullscreen) seeded from `overlay`; "Save settings" calls `onSaveSettings` with the edited fields; renders `<OverlayWidgetForm model={overlay.model} value={overlay.data.widget} onSubmit={onSaveWidget} />`; "Delete" calls `onDelete`. **The page must mount this with `key={overlay.id}`** so it re-seeds when selection changes.

- [ ] **Step 1: Write the failing test**

`test/components/admin/overlays/OverlayPropertiesForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayPropertiesForm } from '@/components/admin/overlays/OverlayPropertiesForm'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'

const overlay: RundownOverlay = {
  id: 5, rundownId: 2, projectId: 3, model: 'general-text', category: 'general',
  template: 'Text', widgetName: 'Lower Third', layer: 4, color: 2, displayFilter: '',
  previewImg: null, isFullscreen: false, hasNextButton: false, order: 0,
  data: { widget: { text: 'hi' } },
}

describe('OverlayPropertiesForm', () => {
  it('renders the settings name and a widget field, and deletes', () => {
    const onDelete = vi.fn()
    render(<OverlayPropertiesForm overlay={overlay}
      onSaveSettings={vi.fn()}
      onSaveWidget={vi.fn()}
      onDelete={onDelete} />)
    expect(screen.getByDisplayValue('Lower Third')).toBeInTheDocument() // Name field
    expect(screen.getByDisplayValue('hi')).toBeInTheDocument() // widget text field
    screen.getByRole('button', { name: /delete/i }).click()
    expect(onDelete).toHaveBeenCalled()
  })

  it('saving settings reports the edited fields', () => {
    const onSaveSettings = vi.fn()
    render(<OverlayPropertiesForm overlay={overlay}
      onSaveSettings={onSaveSettings}
      onSaveWidget={vi.fn()}
      onDelete={vi.fn()} />)
    screen.getByRole('button', { name: /save settings/i }).click()
    expect(onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({
      widgetName: 'Lower Third', layer: 4, color: 2,
    }))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- OverlayPropertiesForm`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the properties form**

`components/admin/overlays/OverlayPropertiesForm.tsx`:
```tsx
'use client'
import { useState } from 'react'
import {
  Box, Button, Checkbox, Divider, FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { OverlayWidgetForm } from './OverlayWidgetForm'

const RANGE_1_7 = [1, 2, 3, 4, 5, 6, 7]
const DISPLAY_FILTERS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

export function OverlayPropertiesForm({
  overlay, onSaveSettings, onSaveWidget, onDelete,
}: {
  overlay: RundownOverlay
  onSaveSettings: (patch: Partial<RundownOverlay>) => void
  onSaveWidget: (widget: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [widgetName, setWidgetName] = useState(overlay.widgetName)
  const [layer, setLayer] = useState(overlay.layer)
  const [color, setColor] = useState(overlay.color)
  const [displayFilter, setDisplayFilter] = useState(overlay.displayFilter ?? '')
  const [isFullscreen, setIsFullscreen] = useState(overlay.isFullscreen)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {overlay.widgetName}
        </Typography>
        <Button color="error"
          onClick={onDelete}>
          Delete
        </Button>
      </Box>
      <TextField label="Name"
        value={widgetName}
        onChange={(e) => setWidgetName(e.target.value)} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField select
          label="Layer"
          value={layer}
          onChange={(e) => setLayer(Number(e.target.value))}
          sx={{ flex: 1 }}>
          {RANGE_1_7.map((n) => <MenuItem key={n}
            value={n}>
            {n}
          </MenuItem>)}
        </TextField>
        <TextField select
          label="Color"
          value={color}
          onChange={(e) => setColor(Number(e.target.value))}
          sx={{ flex: 1 }}>
          {RANGE_1_7.map((n) => <MenuItem key={n}
            value={n}>
            {n}
          </MenuItem>)}
        </TextField>
        <TextField select
          label="Display"
          value={displayFilter}
          onChange={(e) => setDisplayFilter(e.target.value)}
          sx={{ flex: 1 }}>
          {DISPLAY_FILTERS.map((v) => <MenuItem key={v || 'all'}
            value={v}>
            {v || 'all'}
          </MenuItem>)}
        </TextField>
      </Box>
      <FormControlLabel label="Full-screen"
        control={<Checkbox checked={isFullscreen}
          onChange={(e) => setIsFullscreen(e.target.checked)} />} />
      <Button variant="contained"
        onClick={() => onSaveSettings({
          widgetName, layer, color, displayFilter, isFullscreen,
        })}>
        Save settings
      </Button>
      <Divider />
      <Typography variant="subtitle2">
        Fields
      </Typography>
      <OverlayWidgetForm model={overlay.model}
        value={overlay.data.widget}
        onSubmit={onSaveWidget} />
    </Box>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- OverlayPropertiesForm`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/admin/overlays/OverlayPropertiesForm.tsx test/components/admin/overlays/OverlayPropertiesForm.test.tsx
git commit -m "feat(editor): overlay properties form (settings + widget fields)"
```

---

### Task 7: Rewrite the editor page (compose the two panes)

**Files:**
- Modify (full rewrite): `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`

**Interfaces:**
- Consumes: `RundownOverlayListing`, `OverlayTemplateGrid`, `OverlayPropertiesForm`; `listOverlays` from `@/lib/overlays/catalog`; the existing RTK hooks (`useGetProjectQuery`, `useListTagsQuery`, `useGetRundownQuery`, `useListRundownOverlaysQuery`, `useCreateRundownOverlayMutation`, `useUpdateRundownOverlayMutation`, `useDeleteRundownOverlayMutation`, `useReorderRundownOverlaysMutation`).
- Produces: the page (no exported symbols other than the default component).

This is an integration task — no unit test (async Next `use(params)` + RTK hooks); verified by typecheck + build in Task 9 and by browser in Task 9.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx` with:
```tsx
'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { Box, Button, Card, Typography } from '@mui/material'
import { listOverlays } from '@/lib/overlays/catalog'
import { useGetProjectQuery } from '@/store/apis/projectsApi'
import { useListTagsQuery } from '@/store/apis/tagsApi'
import { useGetRundownQuery } from '@/store/apis/rundownsApi'
import {
  useListRundownOverlaysQuery, useCreateRundownOverlayMutation, useUpdateRundownOverlayMutation,
  useDeleteRundownOverlayMutation, useReorderRundownOverlaysMutation, type RundownOverlay,
} from '@/store/apis/rundownOverlaysApi'
import { RundownOverlayListing } from '@/components/admin/overlays/RundownOverlayListing'
import { OverlayTemplateGrid } from '@/components/admin/overlays/OverlayTemplateGrid'
import { OverlayPropertiesForm } from '@/components/admin/overlays/OverlayPropertiesForm'

export default function RundownEditorPage({ params }: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: project } = useGetProjectQuery(projectId)
  const { data: tags = [] } = useListTagsQuery()
  const { data: rundown } = useGetRundownQuery({ projectId, id: Number(rundownId) })
  const { data: overlays = [] } = useListRundownOverlaysQuery({ projectId, rundownId })
  const [createOverlay] = useCreateRundownOverlayMutation()
  const [updateOverlay] = useUpdateRundownOverlayMutation()
  const [deleteOverlay] = useDeleteRundownOverlayMutation()
  const [reorderOverlays] = useReorderRundownOverlaysMutation()

  const disciplineName = tags.find((t) => t.id === project?.disciplineId)?.name
  const catalog = listOverlays(disciplineName)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeColors, setActiveColors] = useState<Set<number>>(new Set())
  const selected = overlays.find((o) => o.id === selectedId) ?? null

  function toggleColor(color: number) {
    setActiveColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }
  async function add(model: string) {
    const created = await createOverlay({ projectId, rundownId, data: { model } }).unwrap()
    setSelectedId(created.id)
  }
  function saveSettings(o: RundownOverlay, patch: Partial<RundownOverlay>) {
    updateOverlay({ projectId, rundownId, overlayId: o.id, data: patch as Record<string, unknown> })
  }
  function saveWidget(o: RundownOverlay, widget: Record<string, unknown>) {
    updateOverlay({ projectId, rundownId, overlayId: o.id, data: { widget } })
  }
  async function remove(id: number) {
    await deleteOverlay({ projectId, rundownId, overlayId: id })
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  return (
    <Box sx={{ p: 4 }}>
      <Button component={Link}
        href={`/projects/${projectId}/rundowns`}
        size="small"
        sx={{ mb: 1 }}>
        ← Rundowns
      </Button>
      <Typography variant="h4"
        sx={{ mb: 3 }}>
        {rundown?.name ?? 'Rundown'}
      </Typography>
      <Box sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: '440px 1fr' },
        alignItems: 'start',
      }}>
        <RundownOverlayListing overlays={overlays}
          activeColors={activeColors}
          selectedId={selectedId}
          onToggleColor={toggleColor}
          onSelect={setSelectedId}
          onReorder={(orderedIds) => reorderOverlays({ projectId, rundownId, orderedIds })}
          onDelete={remove}
          onAdd={() => setSelectedId(null)} />
        <Card sx={{ p: 3 }}>
          {selected ? (
            <OverlayPropertiesForm key={selected.id}
              overlay={selected}
              onSaveSettings={(patch) => saveSettings(selected, patch)}
              onSaveWidget={(widget) => saveWidget(selected, widget)}
              onDelete={() => remove(selected.id)} />
          ) : (
            <OverlayTemplateGrid entries={catalog}
              onPick={add} />
          )}
        </Card>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Typecheck the page**

Run: `npx tsc --noEmit`
Expected: no errors. (If `createOverlay(...).unwrap()` types complain, confirm the mutation's result type is `RundownOverlay` in `store/apis/rundownOverlaysApi.ts` — it is.)

- [ ] **Step 3: Run the full component test suite**

Run: `npm run test -- overlays`
Expected: all overlay component tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx"
git commit -m "feat(editor): master-detail two-pane rundown editor page"
```

---

### Task 8: Link the Rundowns list into the editor

**Files:**
- Modify: `app/(admin)/projects/[projectId]/rundowns/page.tsx`

**Interfaces:**
- Consumes: `Link` from `next/link` (already available in Next).
- Produces: rundown cards navigate to `/projects/[projectId]/rundowns/[id]`; the rename/delete menu still works (its button stops propagation).

- [ ] **Step 1: Remove the stale comment**

In `app/(admin)/projects/[projectId]/rundowns/page.tsx`, delete these two lines (currently 16–17):
```tsx
// The overlay editor + controller are rebuilt in a later pass; this page is
// list / create / rename / delete only.
```

- [ ] **Step 2: Make each card open the editor**

Add `import Link from 'next/link'` to the imports at the top of the file.

Change the card so its body links to the editor while the actions menu button stops propagation. Replace the `<Card sx={{ position: 'relative' }}>` block's contents (the `IconButton` + `CardContent`) so the `CardContent` is wrapped in a link and the menu `IconButton` calls `e.stopPropagation()` before `openMenu`:
```tsx
<Card sx={{ position: 'relative' }}>
  <IconButton size="small"
    aria-label="Rundown actions"
    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMenu(e, r) }}
    sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
    <MoreVertIcon fontSize="small" />
  </IconButton>
  <CardActionArea component={Link}
    href={`/projects/${projectId}/rundowns/${r.id}`}>
    <CardContent>
      <Typography variant="h6">
        {r.name}
      </Typography>
      <Typography variant="body2"
        color="text.secondary">
        {new Date(r.createdAt).toLocaleDateString()}
      </Typography>
    </CardContent>
  </CardActionArea>
</Card>
```

Add `CardActionArea` to the existing `@mui/material` import.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/projects/[projectId]/rundowns/page.tsx"
git commit -m "feat(editor): link rundown cards into the overlay editor"
```

---

### Task 9: Green gate + browser verification + docs note

**Files:**
- Modify: `docs/rundowns.md` (update the "Current state" note)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (the prior 105 + the ~15 new overlay component tests). Fix any failures before continuing.

- [ ] **Step 2: Lint**

Run: `npx eslint app components lib test`
Expected: 0 errors. If the new files trip formatting rules, run `npx eslint --fix` on them and re-run the tests to confirm they still pass, then re-stage.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Browser verification**

Ensure the dev server is running (`preview_start` with the `dev` config, port 3000). Log in, open a project's Rundowns, click a rundown card (confirm it navigates into the editor), click "Add overlay" → pick a template (confirm the row appears in the left listing and the right pane switches to its properties form), toggle a color chip (confirm the listing narrows), edit a field and Save. Capture a screenshot. Check `read_console_messages` for errors.

- [ ] **Step 6: Update the docs note**

In `docs/rundowns.md`, the "Current state (overlays pass)" note (around line 15) says the editor is "live; the controller section below is the target design, not yet built." Update the editor sentence to reflect the master-detail upgrade — change "the editor described below are live" to note the editor is now a **master-detail two-pane** editor (listing + template grid / properties form) with preview thumbnails and a color filter. Leave the controller-not-yet-built statement intact.

- [ ] **Step 7: Commit**

```bash
git add docs/rundowns.md
git commit -m "docs(rundowns): note master-detail editor; whole-project green"
```

---

## Self-Review

**Spec coverage:**
- Master-detail two-pane layout replacing dialogs → Tasks 4/5/6/7. ✓
- Preview thumbnails with fallback → Task 1 (`OverlayThumbnail`), used in Tasks 3 & 5. ✓
- Color filter (empty = all) → Tasks 2 & 4. ✓
- Rundowns-list → editor link + stale comment fix → Task 8. ✓
- No drag-and-drop; up/down reorder via existing route → Task 4 (`move` → `onReorder` → existing `reorderOverlays`). ✓
- No schema/API change → all tasks reuse existing hooks; no migration touched. ✓
- Testing (filter narrows, select shows form, pick calls create, fallback renders) → Tasks 2/4/6/5/1. ✓
- Green gate (test/lint/typecheck/build) + browser → Task 9. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `RundownOverlay` imported from `@/store/apis/rundownOverlaysApi` everywhere; `CatalogEntry` from `@/lib/overlays/types`; `overlayColor`/`OVERLAY_COLORS` defined in Task 1 and consumed in Tasks 2 & 3; `OverlayThumbnail` props `{ src?, label, width?, height? }` consistent across Tasks 1/3/5; listing `onReorder(orderedIds: number[])` matches `reorderOverlays({ ..., orderedIds })`; `createOverlay(...).unwrap()` returns `RundownOverlay` (has `.id`). ✓

**Note on file count:** the spec named 5 new components; this plan adds two small shared primitives (`overlayColors.ts`, `OverlayThumbnail.tsx`) to keep the thumbnail-fallback logic DRY across the card and the template grid — a refinement, same scope.
