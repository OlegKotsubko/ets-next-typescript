// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packageExists, listOverlayPackageLabels, listOverlayPackages } from '@/lib/projects/packages'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ets-packages-'))
  mkdirSync(join(root, 'alpha'))
  writeFileSync(join(root, 'alpha', 'project.config.ts'), 'export default { label: "alpha", name: "Alpha" }')
  mkdirSync(join(root, 'beta'))
  writeFileSync(join(root, 'beta', 'project.config.ts'), 'export default { label: "beta", name: "Beta" }')
  // A directory without a config is NOT a package.
  mkdirSync(join(root, 'not-a-package'))
  // A stray file is not a package either.
  writeFileSync(join(root, 'README.md'), '# nope')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('packageExists', () => {
  it('is true for a folder holding project.config.ts', () => {
    expect(packageExists('alpha', root)).toBe(true)
  })
  it('is false for a folder without one', () => {
    expect(packageExists('not-a-package', root)).toBe(false)
  })
  it('is false for a label that does not exist', () => {
    expect(packageExists('ghost', root)).toBe(false)
  })
  it('refuses to escape the packages root', () => {
    expect(packageExists('../../etc', root)).toBe(false)
  })
})

describe('listOverlayPackageLabels', () => {
  it('returns only real packages, sorted', () => {
    expect(listOverlayPackageLabels(root)).toEqual(['alpha', 'beta'])
  })
  it('returns an empty list when the root is missing', () => {
    expect(listOverlayPackageLabels(join(root, 'nope'))).toEqual([])
  })
})

describe('listOverlayPackages', () => {
  it('loads and validates the real repo packages', async () => {
    const packages = await listOverlayPackages()
    expect(packages.map((p) => p.label)).toContain('default')
    expect(packages.every((p) => p.label && p.name)).toBe(true)
  })
})
