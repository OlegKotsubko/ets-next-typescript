import { generatedTitles } from './generated'
import type { TitleEntry, TitleRegistry } from './types'

// Built once at module load from the generated static imports.
const byPackage = generatedTitles.reduce<Record<string, TitleRegistry>>((acc, entry) => {
  acc[entry.packageLabel] ??= {}
  acc[entry.packageLabel][entry.key] = entry
  return acc
}, {})

export function getTitleRegistry(packageLabel: string): TitleRegistry {
  return byPackage[packageLabel] ?? {}
}

export function getTitleEntry(packageLabel: string, titleKey: string): TitleEntry | undefined {
  return getTitleRegistry(packageLabel)[titleKey]
}

export function getTitleModel(packageLabel: string, titleKey: string) {
  return getTitleEntry(packageLabel, titleKey)?.model
}

export function getTitleActions(packageLabel: string, titleKey: string): readonly string[] {
  return getTitleEntry(packageLabel, titleKey)?.actions ?? []
}

// The allow-list POST .../items/[itemId]/command validates against. Universal
// actions (air/preview/hide/update) are separate routes and are never commands.
export function isDeclaredAction(packageLabel: string, titleKey: string, action: string) {
  return getTitleActions(packageLabel, titleKey).includes(action)
}

export function listTitles(packageLabel: string): TitleEntry[] {
  return Object.values(getTitleRegistry(packageLabel)).sort((a, b) =>
    a.settings.title_name.localeCompare(b.settings.title_name),
  )
}
