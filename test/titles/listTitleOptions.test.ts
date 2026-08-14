// @vitest-environment node
import { it, expect, vi } from 'vitest'
import { z } from 'zod'
vi.mock('@/lib/titles/registry', () => ({
  listTitles: () => [
    { key: 'lower-third', model: z.object({ playerName: z.string().min(1).max(40) }),
      settings: { title_name: 'Lower Third', title_color: 'red', title_is_full_screen: false } },
  ],
}))
const { listTitleOptions } = await import('@/lib/titles/listTitleOptions')

it('maps each registry title to an option with descriptors + defaults', () => {
  const [opt] = listTitleOptions('default')
  expect(opt).toMatchObject({ key: 'lower-third', name: 'Lower Third', color: 'red', isFullScreen: false })
  expect(opt.fields[0]).toMatchObject({ name: 'playerName', kind: 'string' })
  expect(opt.defaults.playerName).toBe('')
})
