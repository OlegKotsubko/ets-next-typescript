// Packages are file-system only — there is no projects:sync script and no
// per-folder DB row. A folder is a package iff it holds project.config.ts.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { OverlayPackageConfig } from './types'
import { generatedPackages } from './generated'

export const PROJECTS_DIR = join(process.cwd(), 'projects')

const CONFIG_FILE = 'project.config.ts'

// A label comes from user input (POST /api/projects), so it must not be able to
// address anything outside the packages root.
function resolveWithin(root: string, label: string) {
  const base = resolve(root)
  const target = resolve(base, label)
  return target === base || target.startsWith(`${base}/`) ? target : null
}

export function packageExists(label: string, root: string = PROJECTS_DIR) {
  const dir = resolveWithin(root, label)
  return dir !== null && existsSync(join(dir, CONFIG_FILE))
}

export function listOverlayPackageLabels(root: string = PROJECTS_DIR) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, CONFIG_FILE)))
    .map((d) => d.name)
    .sort()
}

// Static registry, not a runtime scan: see lib/projects/registry-codegen.ts for why.
export async function listOverlayPackages(): Promise<OverlayPackageConfig[]> {
  return generatedPackages
}
