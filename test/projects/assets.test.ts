// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncProjectAssets } from '@/lib/projects/assets'

let src: string
let dst: string

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'ets-assets-'))
  src = join(base, 'projects')
  dst = join(base, 'public', 'projects')
  mkdirSync(join(src, 'alpha', 'assets', 'fonts'), { recursive: true })
  mkdirSync(join(src, 'alpha', 'styles'), { recursive: true })
  writeFileSync(join(src, 'alpha', 'project.config.ts'), '')
  writeFileSync(join(src, 'alpha', 'assets', 'fonts', 'Display.woff2'), 'FONT')
  writeFileSync(join(src, 'alpha', 'styles', 'project.css'), ':root{--x:1}')
  // A package with no assets/ or styles/ must not crash the sync.
  mkdirSync(join(src, 'bare'), { recursive: true })
  writeFileSync(join(src, 'bare', 'project.config.ts'), '')
})

afterEach(() => {
  rmSync(join(src, '..'), { recursive: true, force: true })
})

describe('syncProjectAssets', () => {
  it('copies assets and styles into the public tree', () => {
    syncProjectAssets({ src, dst })
    expect(readFileSync(join(dst, 'alpha', 'assets', 'fonts', 'Display.woff2'), 'utf8')).toBe('FONT')
    expect(readFileSync(join(dst, 'alpha', 'styles', 'project.css'), 'utf8')).toBe(':root{--x:1}')
  })

  it('reports what it copied', () => {
    expect(syncProjectAssets({ src, dst }).sort()).toEqual(['alpha/assets', 'alpha/styles'])
  })

  it('skips a package with neither assets nor styles', () => {
    syncProjectAssets({ src, dst })
    expect(existsSync(join(dst, 'bare'))).toBe(false)
  })

  it('overwrites a stale copy on re-run', () => {
    syncProjectAssets({ src, dst })
    writeFileSync(join(src, 'alpha', 'styles', 'project.css'), ':root{--x:2}')
    syncProjectAssets({ src, dst })
    expect(readFileSync(join(dst, 'alpha', 'styles', 'project.css'), 'utf8')).toBe(':root{--x:2}')
  })

  it('returns an empty list when there are no packages', () => {
    expect(syncProjectAssets({ src: join(src, 'nowhere'), dst })).toEqual([])
  })
})
