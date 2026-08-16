import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getOverlayRender } from '@/lib/overlays/render'
import { getOverlayModel } from '@/lib/overlays/catalog'

const MODELS = ['general-text', 'general-scoreboard', 'general-opening-timer', 'general-intro']
const sampleMatch = { participant_left: { name: 'Team A', score: 1 }, participant_right: { name: 'Team B', score: 2 } }

describe('overlay render', () => {
  for (const model of MODELS) {
    it(`${model} mounts with default widget + sample data`, () => {
      const r = getOverlayRender(model)!
      const widget = getOverlayModel(model)!.parse({}) as Record<string, unknown>
      const { container } = render(<r.Component data={{ widget, match: sampleMatch }} />)
      expect(container.firstChild).toBeTruthy()
    })
  }

  it('text overlay renders its widget text', () => {
    const r = getOverlayRender('general-text')!
    render(<r.Component data={{ widget: { text: 'Hello world' } }} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('scoreboard renders participant names from match data', () => {
    const r = getOverlayRender('general-scoreboard')!
    const widget = getOverlayModel('general-scoreboard')!.parse({}) as Record<string, unknown>
    render(<r.Component data={{ widget, match: sampleMatch }} />)
    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('Team B')).toBeInTheDocument()
    expect(screen.getByText('1 : 2')).toBeInTheDocument()
  })

  it('opening timer formats its duration', () => {
    const r = getOverlayRender('general-opening-timer')!
    render(<r.Component data={{ widget: { duration: 305, label: 'STARTS IN' } }} />)
    expect(screen.getByText('5:05')).toBeInTheDocument()
  })
})
