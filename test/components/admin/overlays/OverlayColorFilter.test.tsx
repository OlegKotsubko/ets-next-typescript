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
