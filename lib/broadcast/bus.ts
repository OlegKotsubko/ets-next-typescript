// In-process pub/sub, channel-aware, with a stateful snapshot per
// (rundownId, channel). Single-instance only — see CLAUDE.md's
// "Single-server pub/sub caveat".
import { applyEvent, sortLiveSet, type BroadcastEvent, type LiveTitle } from './liveSet'

export type { BroadcastEvent } from './liveSet'

type Channel = 'preview' | 'air'
type Key = `${string}:${Channel}`

const key = (rundownId: string, channel: Channel): Key => `${rundownId}:${channel}`

const subscribers = new Map<Key, Set<(event: BroadcastEvent) => void>>()
const snapshots = new Map<Key, Map<string, LiveTitle>>()

export function publish(rundownId: string, channel: Channel, event: BroadcastEvent): void {
  const k = key(rundownId, channel)
  snapshots.set(k, applyEvent(snapshots.get(k) ?? new Map(), event))
  subscribers.get(k)?.forEach((fn) => fn(event))
}

export function subscribe(rundownId: string, channel: Channel, fn: (event: BroadcastEvent) => void): () => void {
  const k = key(rundownId, channel)
  const set = subscribers.get(k) ?? new Set()
  set.add(fn)
  subscribers.set(k, set)
  return () => set.delete(fn)
}

export function getSnapshot(rundownId: string, channel: Channel): LiveTitle[] {
  return sortLiveSet(snapshots.get(key(rundownId, channel)) ?? new Map())
}
