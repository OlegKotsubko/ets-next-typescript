// public/projects/ is a derived artifact (git-ignored): Next only serves static
// files from public/, but package assets live beside their title source.
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { listOverlayPackageLabels } from './packages'

const SYNCED_SUBDIRS = ['assets', 'styles']

export function syncProjectAssets({ src, dst }: { src: string; dst: string }): string[] {
  return listOverlayPackageLabels(src).flatMap((label) =>
    SYNCED_SUBDIRS.filter((sub) => existsSync(join(src, label, sub))).map((sub) => {
      cpSync(join(src, label, sub), join(dst, label, sub), { recursive: true, force: true })
      return `${label}/${sub}`
    }),
  )
}
