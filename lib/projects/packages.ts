// Packages are file-system only — there is no projects:sync script and no
// per-folder DB row. A folder is a package iff it holds project.config.ts.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { overlayPackageConfigSchema, type OverlayPackageConfig } from './types'

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

export async function listOverlayPackages(root: string = PROJECTS_DIR): Promise<OverlayPackageConfig[]> {
  const labels = listOverlayPackageLabels(root)
  const configs = await Promise.all(
    labels.map(async (label) => {
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ join(root, label, CONFIG_FILE))
      return overlayPackageConfigSchema.parse(mod.default)
    }),
  )
  return configs
}
