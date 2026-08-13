// The pure event vocabulary + reducer for one broadcast channel's live set.
// No I/O, no bus, no React. lib/broadcast/bus.ts wraps this in the stateful
// in-process pub/sub; lib/broadcast/useTitleStream.ts wraps it on the client,
// replaying the identical events over SSE.

export type BroadcastEvent =
  | { type: 'show'; itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide'; itemId: string }
  | { type: 'update'; itemId: string; layer: number; position: number; data: unknown }
  | { type: 'command'; itemId: string; action: string; payload?: unknown }

export interface LiveTitle {
  itemId: string
  titleKey: string
  layer: number
  position: number
  data: unknown
}

// command events are imperative and fire-and-forget: never part of the set,
// so a late/duplicate command can never desync a reconnecting client's replay.
export function applyEvent(map: Map<string, LiveTitle>, event: BroadcastEvent): Map<string, LiveTitle> {
  if (event.type === 'command') return map

  const next = new Map(map)
  if (event.type === 'show') {
    next.set(event.itemId, {
      itemId: event.itemId,
      titleKey: event.titleKey,
      layer: event.layer,
      position: event.position,
      data: event.data,
    })
  } else if (event.type === 'hide') {
    next.delete(event.itemId)
  } else {
    const existing = next.get(event.itemId)
    if (existing) {
      next.set(event.itemId, { ...existing, layer: event.layer, position: event.position, data: event.data })
    }
  }
  return next
}

// Higher layer renders on top; position breaks ties within a layer.
export function sortLiveSet(map: Map<string, LiveTitle>): LiveTitle[] {
  return [...map.values()].sort((a, b) => a.layer - b.layer || a.position - b.position)
}
