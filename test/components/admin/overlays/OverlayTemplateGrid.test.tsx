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
