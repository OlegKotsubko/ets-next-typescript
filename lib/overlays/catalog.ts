import type { ZodTypeAny } from 'zod'
import { catalog } from './catalog.generated'
import type { CatalogEntry } from './types'
import type { FieldDescriptor } from './widget-schema'

// Admin/API-facing registry — no overlay components (keeps them out of this
// bundle). The kebab key comes from settings.model; zodModel is the validator.
const entries: CatalogEntry[] = catalog.map((row) => ({
  model: row.settings.model,
  category: row.category,
  template: row.template,
  widgetName: row.settings.widgetName ?? row.template,
  preview: row.settings.preview,
  color: row.settings.color,
  isFullscreen: row.settings.isFullscreen,
  allowedParticipantType: row.settings.allowedParticipantType,
  zodModel: row.zodModel as ZodTypeAny,
  fields: row.fields as FieldDescriptor[],
  actions: row.actions,
}))

const byModel = new Map(entries.map((e) => [e.model, e]))

// Available overlays for a tournament = titles whose pack (top-level overlays/
// folder = category) is one the tournament references. No 'general' fallback.
export function listOverlays(packs: string[]): CatalogEntry[] {
  return entries.filter((e) => packs.includes(e.category))
}
// The pack names a tournament can pick from — derived from the folder scan the
// codegen already baked into the catalog.
export function listCategories(): string[] {
  return Array.from(new Set(entries.map((e) => e.category))).sort()
}
export function getCatalogEntry(model: string): CatalogEntry | undefined {
  return byModel.get(model)
}
export function getOverlayModel(model: string): ZodTypeAny | undefined {
  return byModel.get(model)?.zodModel
}
export function describeModel(model: string): FieldDescriptor[] {
  return byModel.get(model)?.fields ?? []
}
export function isDeclaredAction(model: string, action: string): boolean {
  return byModel.get(model)?.actions.includes(action) ?? false
}
