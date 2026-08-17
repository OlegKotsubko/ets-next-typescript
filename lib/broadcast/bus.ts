import { applyEvent } from './liveReducer'
import type { BroadcastEvent, Channel, OverlayPayload } from './types'

type Entry = { subs: Set<(e: BroadcastEvent) => void>; snapshot: OverlayPayload[] }
const channels = new Map<string, Entry>()

function keyOf(uuid: string, channel: Channel) {
  return `${uuid}:${channel}`
}
function ensure(uuid: string, channel: Channel): Entry {
  const k = keyOf(uuid, channel)
  let e = channels.get(k)
  if (!e) {
    e = { subs: new Set(), snapshot: [] }
    channels.set(k, e)
  }
  return e
}

export function publish(uuid: string, channel: Channel, event: BroadcastEvent): void {
  const e = ensure(uuid, channel)
  e.snapshot = applyEvent(e.snapshot, event)
  for (const cb of e.subs) cb(event)
}

export function subscribe(uuid: string, channel: Channel, cb: (e: BroadcastEvent) => void): () => void {
  const e = ensure(uuid, channel)
  e.subs.add(cb)
  return () => e.subs.delete(cb)
}

export function getSnapshot(uuid: string, channel: Channel): OverlayPayload[] {
  return ensure(uuid, channel).snapshot
}

export function resetBus(): void {
  channels.clear()
}
