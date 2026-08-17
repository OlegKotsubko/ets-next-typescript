import type { OverlayPayload } from './types'

type Row = {
  id: number
  model: string
  category: string | null
  template: string | null
  layer: number
  displayFilter: string | null
  isFullscreen: boolean
  data: { widget: Record<string, unknown> }
}

export function toOverlayPayload(row: Row): OverlayPayload {
  return {
    id: row.id,
    model: row.model,
    category: row.category,
    template: row.template,
    layer: row.layer,
    displayFilter: row.displayFilter,
    isFullscreen: row.isFullscreen,
    data: { widget: row.data?.widget ?? {} },
  }
}
