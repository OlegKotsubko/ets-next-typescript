import type { BroadcastEvent, OverlayPayload } from './types'

export function upsertById(set: OverlayPayload[], item: OverlayPayload): OverlayPayload[] {
  const i = set.findIndex((o) => o.id === item.id)
  if (i === -1) return [...set, item]
  const next = set.slice()
  next[i] = item
  return next
}

export function applyEvent(set: OverlayPayload[], e: BroadcastEvent): OverlayPayload[] {
  switch (e.type) {
    case 'air':
    case 'preview':
      return e.data
    case 'hide':
      return set.filter((o) => o.id !== e.data.id)
    case 'hide_all':
      return []
    case 'live_update':
      return set.map((o) => (o.id === e.data.id
        ? { ...o, data: { ...o.data, widget: { ...o.data.widget, ...e.data.widget } } }
        : o))
    default:
      return set
  }
}

export function sortByLayer(set: OverlayPayload[]): OverlayPayload[] {
  return set.slice().sort((a, b) => a.layer - b.layer)
}

export function filterByDisplay(set: OverlayPayload[], filter: string | null): OverlayPayload[] {
  if (!filter) return set.filter((o) => !o.displayFilter)
  return set.filter((o) => o.displayFilter === filter)
}
