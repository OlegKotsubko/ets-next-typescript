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
