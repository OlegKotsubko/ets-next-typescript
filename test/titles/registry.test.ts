import { describe, it, expect } from 'vitest'
import {
  getTitleRegistry,
  getTitleEntry,
  getTitleModel,
  getTitleActions,
  isDeclaredAction,
  listTitles,
} from '@/lib/titles/registry'

describe('getTitleRegistry', () => {
  it('indexes the default package by title key', () => {
    const registry = getTitleRegistry('default')
    expect(Object.keys(registry).sort()).toEqual(['lower-third', 'opening-timer'])
  })

  it('returns an empty registry for an unknown package', () => {
    expect(getTitleRegistry('ghost')).toEqual({})
  })
})

describe('getTitleEntry', () => {
  it('resolves the full title entity', () => {
    const entry = getTitleEntry('default', 'opening-timer')
    expect(entry?.settings.title_name).toBe('Opening Timer')
    expect(entry?.settings.title_is_full_screen).toBe(true)
    expect(typeof entry?.Component).toBe('function')
    expect(entry?.actions).toEqual(['start', 'stop', 'reset'])
  })

  it('is undefined for an unknown title', () => {
    expect(getTitleEntry('default', 'ghost')).toBeUndefined()
  })
})

describe('getTitleModel', () => {
  it('validates data for the title it belongs to', () => {
    const model = getTitleModel('default', 'lower-third')
    expect(model?.safeParse({ playerName: 'Casey Liu' }).success).toBe(true)
    expect(model?.safeParse({ teamName: 'no name' }).success).toBe(false)
  })

  it('is undefined for an unknown title', () => {
    expect(getTitleModel('default', 'ghost')).toBeUndefined()
  })
})

describe('getTitleActions / isDeclaredAction', () => {
  it('returns the declared actions', () => {
    expect(getTitleActions('default', 'opening-timer')).toEqual(['start', 'stop', 'reset'])
    expect(getTitleActions('default', 'lower-third')).toEqual([])
  })

  it('returns an empty list for an unknown title rather than throwing', () => {
    expect(getTitleActions('default', 'ghost')).toEqual([])
  })

  it('accepts a declared action', () => {
    expect(isDeclaredAction('default', 'opening-timer', 'start')).toBe(true)
  })

  it('rejects an undeclared action — this is what the /command route 400s on', () => {
    expect(isDeclaredAction('default', 'opening-timer', 'explode')).toBe(false)
    expect(isDeclaredAction('default', 'lower-third', 'start')).toBe(false)
  })

  it('rejects a universal action — those are routes, not commands', () => {
    expect(isDeclaredAction('default', 'opening-timer', 'air')).toBe(false)
    expect(isDeclaredAction('default', 'opening-timer', 'update')).toBe(false)
  })
})

describe('listTitles', () => {
  it('lists entries for the Add Template modal, sorted by display name', () => {
    expect(listTitles('default').map((t) => t.settings.title_name)).toEqual(['Lower Third', 'Opening Timer'])
  })
})
