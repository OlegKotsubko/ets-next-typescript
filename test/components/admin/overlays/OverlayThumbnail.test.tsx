import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayThumbnail } from '@/components/admin/overlays/OverlayThumbnail'

describe('OverlayThumbnail', () => {
  it('renders an img when src is present', () => {
    const { container } = render(<OverlayThumbnail src="/x.png"
      label="Text" />)
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders a labeled fallback (no img) when src is absent', () => {
    const { container } = render(<OverlayThumbnail src={null}
      label="Text" />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/Text/)).toBeInTheDocument()
  })
})
