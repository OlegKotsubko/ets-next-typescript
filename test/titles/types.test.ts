import { describe, it, expect } from 'vitest'
import { titleSettingsSchema } from '@/lib/titles/types'
import { overlayPackageConfigSchema } from '@/lib/projects/types'

describe('titleSettingsSchema', () => {
  it('accepts a minimal settings object and defaults the full-screen flag', () => {
    const parsed = titleSettingsSchema.parse({ title_name: 'Lower Third' })
    expect(parsed.title_is_full_screen).toBe(false)
  })

  it('keeps the media filenames it is given', () => {
    const parsed = titleSettingsSchema.parse({
      title_name: 'Opening Timer',
      title_is_full_screen: true,
      title_stinger_in: 'timer-in.webm',
      title_preview: 'timer.png',
      title_color: 'blue',
    })
    expect(parsed.title_stinger_in).toBe('timer-in.webm')
    expect(parsed.title_color).toBe('blue')
  })

  it('rejects an empty title_name', () => {
    expect(titleSettingsSchema.safeParse({ title_name: '' }).success).toBe(false)
  })

  it('rejects a colour outside the four UI tags', () => {
    expect(titleSettingsSchema.safeParse({ title_name: 'X', title_color: 'purple' }).success).toBe(false)
  })
})

describe('overlayPackageConfigSchema', () => {
  it('accepts a package config', () => {
    const parsed = overlayPackageConfigSchema.parse({ label: 'default', name: 'Default Package' })
    expect(parsed.label).toBe('default')
  })

  it('rejects a config with no label', () => {
    expect(overlayPackageConfigSchema.safeParse({ name: 'No Label' }).success).toBe(false)
  })
})
