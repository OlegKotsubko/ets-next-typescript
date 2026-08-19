import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { listOverlays, getOverlayModel, describeModel, isDeclaredAction } from '@/lib/overlays/catalog'
import { scanOverlayDirs, buildSources } from '@/lib/overlays/codegen'

describe('overlay registry', () => {
  it('lists overlays whose pack (category) is referenced', () => {
    expect(listOverlays(['general']).map((e) => e.model)).toContain('general-text')
    expect(listOverlays(['dota-2']).map((e) => e.model)).not.toContain('general-text')
    expect(listOverlays([])).toEqual([])
  })

  it('validates data.widget via the overlay model', () => {
    expect(getOverlayModel('general-text')!.parse({})).toEqual({ text: 'Text sample' })
    expect(getOverlayModel('nope')).toBeUndefined()
  })

  it('describes fields including can_live_update', () => {
    const f = describeModel('general-text').find((d) => d.name === 'text')!
    expect(f).toMatchObject({ input_type: 'text', can_live_update: true })
  })

  it('knows declared thread-widget actions', () => {
    expect(isDeclaredAction('general-text', 'next')).toBe(true)
    expect(isDeclaredAction('general-text', 'nope')).toBe(false)
  })

  it('committed generated files are in sync with the overlay tree', () => {
    const { catalog, components } = buildSources(scanOverlayDirs())
    expect(readFileSync('lib/overlays/catalog.generated.ts', 'utf8')).toBe(catalog)
    expect(readFileSync('lib/overlays/components.generated.ts', 'utf8')).toBe(components)
  })
})
