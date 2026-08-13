import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'
import type { LiveTitle } from '@/lib/broadcast/liveSet'

const lowerThird: LiveTitle = {
  itemId: 'i1', titleKey: 'lower-third', layer: 3, position: 0,
  data: { playerName: 'Casey Liu', teamName: 'Boom Squad' },
}
const openingTimer: LiveTitle = {
  itemId: 'i2', titleKey: 'opening-timer', layer: 0, position: 0,
  data: { hours: 0, minutes: 15, seconds: 0, main_text: 'Kickoff' },
}

describe('TitleRenderer', () => {
  it('renders each title against its data, using the real default-package registry', () => {
    render(<TitleRenderer titles={[lowerThird, openingTimer]}
      packageLabel="default" />)
    expect(screen.getByText('Casey Liu')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
  })

  it('gives a full-screen title real fixed/inset positioning and stacks by layer via zIndex', () => {
    const { container } = render(<TitleRenderer titles={[lowerThird, openingTimer]}
      packageLabel="default" />)
    const wrappers = container.querySelectorAll(':scope > div')
    // lower-third: title_is_full_screen is false — positioned, but not fixed/inset.
    expect(wrappers[0]).toHaveStyle({ zIndex: '3', position: 'relative' })
    // opening-timer: title_is_full_screen is true — real fixed/inset styles,
    // not an inert Tailwind-style class name (this project has no Tailwind).
    expect(wrappers[1]).toHaveStyle({ zIndex: '0', position: 'fixed', inset: '0px' })
  })

  it('silently skips an unknown titleKey instead of crashing', () => {
    const ghost: LiveTitle = { itemId: 'i3', titleKey: 'nonexistent', layer: 0, position: 0, data: {} }
    const { container } = render(<TitleRenderer titles={[ghost]}
      packageLabel="default" />)
    expect(container.querySelectorAll(':scope > div')).toHaveLength(0)
  })

  it('renders nothing for an empty set', () => {
    const { container } = render(<TitleRenderer titles={[]}
      packageLabel="default" />)
    expect(container).toBeEmptyDOMElement()
  })
})
