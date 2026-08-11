import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import LowerThird from '@/projects/default/titles/lower-third'
import lowerThirdSettings from '@/projects/default/titles/lower-third/settings'
import { model as lowerThirdModel, actions as lowerThirdActions } from '@/projects/default/titles/lower-third/model'
import OpeningTimer from '@/projects/default/titles/opening-timer'
import openingTimerSettings from '@/projects/default/titles/opening-timer/settings'
import { model as timerModel, actions as timerActions } from '@/projects/default/titles/opening-timer/model'
import { titleSettingsSchema } from '@/lib/titles/types'
import type { CommandHandler } from '@/lib/titles/types'

afterEach(() => {
  vi.useRealTimers()
})

describe('lower-third', () => {
  it('has settings that satisfy the settings schema', () => {
    expect(titleSettingsSchema.safeParse(lowerThirdSettings).success).toBe(true)
    expect(lowerThirdSettings.title_is_full_screen).toBe(false)
  })

  it('declares no command actions', () => {
    expect(lowerThirdActions).toEqual([])
  })

  it('renders the player name and team from data', () => {
    const data = lowerThirdModel.parse({ playerName: 'Casey Liu', teamName: 'Boom Squad' })
    render(<LowerThird data={data} />)
    expect(screen.getByText('Casey Liu')).toBeInTheDocument()
    expect(screen.getByText('Boom Squad')).toBeInTheDocument()
  })

  it('omits the team element when teamName is absent', () => {
    render(<LowerThird data={lowerThirdModel.parse({ playerName: 'Solo' })} />)
    expect(screen.queryByText('Boom Squad')).not.toBeInTheDocument()
  })
})

describe('opening-timer model composition', () => {
  it('drops sponsors and adds subtitle', () => {
    expect(Object.keys(timerModel.shape)).not.toContain('sponsors')
    expect(Object.keys(timerModel.shape)).toContain('subtitle')
  })

  it('still enforces the shared field bounds', () => {
    expect(timerModel.safeParse({ hours: 0, minutes: 99, seconds: 0, main_text: 'x' }).success).toBe(false)
  })

  it('re-declares the shared command actions', () => {
    expect(timerActions).toEqual(['start', 'stop', 'reset'])
  })

  it('is marked full-screen in settings', () => {
    expect(titleSettingsSchema.safeParse(openingTimerSettings).success).toBe(true)
    expect(openingTimerSettings.title_is_full_screen).toBe(true)
  })
})

describe('opening-timer commands', () => {
  it('renders the initial countdown from data', () => {
    render(<OpeningTimer data={timerModel.parse({ hours: 0, minutes: 1, seconds: 5, main_text: 'Kickoff' })} />)
    expect(screen.getByText('00:01:05')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
  })

  it('counts down after start, halts on stop, and returns to data on reset', () => {
    vi.useFakeTimers()
    let fire: CommandHandler = () => {}
    render(
      <OpeningTimer
        data={timerModel.parse({ hours: 0, minutes: 0, seconds: 10, main_text: 'Kickoff' })}
        onCommand={(handler) => {
          fire = handler
        }}
      />,
    )
    expect(screen.getByText('00:00:10')).toBeInTheDocument()

    act(() => fire('start'))
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('00:00:07')).toBeInTheDocument()

    act(() => fire('stop'))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText('00:00:07')).toBeInTheDocument()

    act(() => fire('reset'))
    expect(screen.getByText('00:00:10')).toBeInTheDocument()
  })

  it('never counts below zero', () => {
    vi.useFakeTimers()
    let fire: CommandHandler = () => {}
    render(
      <OpeningTimer
        data={timerModel.parse({ hours: 0, minutes: 0, seconds: 2, main_text: 'x' })}
        onCommand={(handler) => {
          fire = handler
        }}
      />,
    )
    act(() => fire('start'))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('ignores an action it does not declare', () => {
    vi.useFakeTimers()
    let fire: CommandHandler = () => {}
    render(
      <OpeningTimer
        data={timerModel.parse({ hours: 0, minutes: 0, seconds: 9, main_text: 'x' })}
        onCommand={(handler) => {
          fire = handler
        }}
      />,
    )
    act(() => fire('explode'))
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('00:00:09')).toBeInTheDocument()
  })
})
