// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanPackageLabels, buildPackageRegistrySource } from '@/lib/projects/registry-codegen'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ets-packages-codegen-'))
  mkdirSync(join(root, 'alpha'))
  writeFileSync(join(root, 'alpha', 'project.config.ts'), 'export default { label: "alpha", name: "Alpha" }')
  mkdirSync(join(root, 'beta'))
  writeFileSync(join(root, 'beta', 'project.config.ts'), 'export default { label: "beta", name: "Beta" }')
  // A directory without a config is NOT a package.
  mkdirSync(join(root, 'not-a-package'))
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scanPackageLabels', () => {
  it('returns only real packages, sorted', () => {
    expect(scanPackageLabels(root)).toEqual(['alpha', 'beta'])
  })

  it('returns an empty list for a missing root', () => {
    expect(scanPackageLabels(join(root, 'nope'))).toEqual([])
  })
})

describe('buildPackageRegistrySource', () => {
  const source = buildPackageRegistrySource(['alpha', 'beta'])

  it('marks the file as generated', () => {
    expect(source).toContain('AUTO-GENERATED')
  })

  it('emits a static import per package label', () => {
    expect(source).toContain("import Config0 from '@/projects/alpha/project.config'")
    expect(source).toContain("import Config1 from '@/projects/beta/project.config'")
  })

  it('emits the generatedPackages export, validated through the schema', () => {
    expect(source).toContain('export const generatedPackages: OverlayPackageConfig[] = [')
    expect(source).toContain('overlayPackageConfigSchema.parse(Config0)')
    expect(source).toContain('overlayPackageConfigSchema.parse(Config1)')
  })

  it('emits valid empty output for no packages', () => {
    const empty = buildPackageRegistrySource([])
    expect(empty).toContain('export const generatedPackages')
    expect(empty).not.toContain('import Config0')
  })

  it('writes no semicolons, matching house style', () => {
    expect(source.split('\n').some((line) => line.trimEnd().endsWith(';'))).toBe(false)
  })
})
