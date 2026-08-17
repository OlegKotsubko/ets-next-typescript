export type Channel = 'preview' | 'air'

export type OverlayPayload = {
  id: number
  model: string
  category: string | null
  template: string | null
  layer: number
  displayFilter: string | null
  isFullscreen: boolean
  data: { widget: Record<string, unknown> }
}

export type BroadcastEvent =
  | { type: 'air'; data: OverlayPayload[] }
  | { type: 'preview'; data: OverlayPayload[] }
  | { type: 'hide'; data: { id: number } }
  | { type: 'hide_all' }
  | { type: 'live_update'; data: { id: number; widget: Record<string, unknown> } }
