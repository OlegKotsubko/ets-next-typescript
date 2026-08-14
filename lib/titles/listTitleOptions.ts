import { listTitles } from './registry'
import { describeModel, computeDefaults, type FieldDescriptor } from './describeModel'

// One selectable title for the Add Template modal + the field descriptors and
// defaults its data form renders from. All plain JSON — the Zod model never
// crosses to the client.
export type TitleOption = {
  key: string
  name: string
  color: string | null
  isFullScreen: boolean
  fields: FieldDescriptor[]
  defaults: Record<string, unknown>
}

export function listTitleOptions(packageLabel: string): TitleOption[] {
  return listTitles(packageLabel).map((t) => ({
    key: t.key,
    name: t.settings.title_name,
    color: t.settings.title_color ?? null,
    isFullScreen: t.settings.title_is_full_screen,
    fields: describeModel(t.model),
    defaults: computeDefaults(t.model),
  }))
}
