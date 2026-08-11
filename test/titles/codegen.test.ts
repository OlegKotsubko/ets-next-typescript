// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanTitleDirs, buildRegistrySource } from '@/lib/titles/codegen'

let root: string

function makeTitle(pkg: string, key: string, files: string[]) {
  const dir = join(root, pkg, 'titles', key)
  mkdirSync(dir, { recursive: true })
  files.forEach((f) => writeFileSync(join(dir, f), ''))
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ets-codegen-'))
  mkdirSync(join(root, 'alpha'), { recursive: true })
  writeFileSync(join(root, 'alpha', 'project.config.ts'), '')
  makeTitle('alpha', 'scoreboard', ['index.tsx', 'model.ts', 'settings.ts'])
  makeTitle('alpha', 'lower-third', ['index.tsx', 'model.ts', 'settings.ts'])
  // Incomplete: missing settings.ts — must be skipped, not half-registered.
  makeTitle('alpha', 'broken', ['index.tsx', 'model.ts'])
  // A package with no titles/ directory at all.
  mkdirSync(join(root, 'empty'), { recursive: true })
  writeFileSync(join(root, 'empty', 'project.config.ts'), '')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scanTitleDirs', () => {
  it('finds every complete three-file title, sorted', () => {
    expect(scanTitleDirs(root)).toEqual([
      { packageLabel: 'alpha', key: 'lower-third' },
      { packageLabel: 'alpha', key: 'scoreboard' },
    ])
  })

  it('skips a title missing one of the three files', () => {
    expect(scanTitleDirs(root).some((t) => t.key === 'broken')).toBe(false)
  })

  it('returns an empty list for a missing root', () => {
    expect(scanTitleDirs(join(root, 'nope'))).toEqual([])
  })
})

describe('buildRegistrySource', () => {
  const source = buildRegistrySource([
    { packageLabel: 'alpha', key: 'lower-third' },
    { packageLabel: 'alpha', key: 'scoreboard' },
  ])

  it('marks the file as generated', () => {
    expect(source).toContain('AUTO-GENERATED')
  })

  it('emits a static import per title file', () => {
    expect(source).toContain("import Component0 from '@/projects/alpha/titles/lower-third'")
    expect(source).toContain("import * as model0 from '@/projects/alpha/titles/lower-third/model'")
    expect(source).toContain("import settings0 from '@/projects/alpha/titles/lower-third/settings'")
    expect(source).toContain("import Component1 from '@/projects/alpha/titles/scoreboard'")
  })

  it('emits one entry per title with its key and package', () => {
    expect(source).toContain("key: 'lower-third'")
    expect(source).toContain("packageLabel: 'alpha'")
    expect(source).toContain('actions: model0.actions')
  })

  it('emits valid empty output for no titles', () => {
    const empty = buildRegistrySource([])
    expect(empty).toContain('export const generatedTitles')
    expect(empty).not.toContain('import Component0')
  })

  it('writes no semicolons, matching house style', () => {
    expect(source.split('\n').some((line) => line.trimEnd().endsWith(';'))).toBe(false)
  })
})
