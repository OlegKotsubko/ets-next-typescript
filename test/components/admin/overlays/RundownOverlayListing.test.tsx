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
