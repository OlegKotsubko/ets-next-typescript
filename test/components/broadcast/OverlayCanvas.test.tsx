import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayCanvas } from '@/components/broadcast/OverlayCanvas'
import type { OverlayPayload } from '@/lib/broadcast/types'

const text = (id: number, t: string): OverlayPayload => ({
  id, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: t } },
})

describe('OverlayCanvas', () => {
  it('renders one overlay component per payload', () => {
    render(<OverlayCanvas overlays={[text(1, 'Hello'), text(2, 'World')]} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
  })
  it('renders nothing for an empty set', () => {
    const { container } = render(<OverlayCanvas overlays={[]} />)
    expect(container.textContent).toBe('')
  })
})
