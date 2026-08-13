// In-process pub/sub, channel-aware, with a stateful snapshot per
// (rundownId, channel). Single-instance only — see CLAUDE.md's
// "Single-server pub/sub caveat".
import { applyEvent, sortLiveSet, type BroadcastEvent, type LiveTitle } from './liveSet'

export type { BroadcastEvent } from './liveSet'

export type Channel = 'preview' | 'air'
type Key = `${string}:${Channel}`

const key = (rundownId: string, channel: Channel): Key => `${rundownId}:${channel}`

const subscribers = new Map<Key, Set<(event: BroadcastEvent) => void>>()
const snapshots = new Map<Key, Map<string, LiveTitle>>()

export function publish(rundownId: string, channel: Channel, event: BroadcastEvent): void {
  const k = key(rundownId, channel)
  snapshots.set(k, applyEvent(snapshots.get(k) ?? new Map(), event))
  // Isolate each subscriber: one throwing callback (e.g. a route enqueueing
  // onto a closed/errored controller) must not stop delivery to the rest of
  // the subscribers, nor crash the publisher.
  subscribers.get(k)?.forEach((fn) => {
    try {
      fn(event)
    } catch {
      // Swallow — a single bad subscriber shouldn't break the others.
    }
  })
}

export function subscribe(rundownId: string, channel: Channel, fn: (event: BroadcastEvent) => void): () => void {
  const k = key(rundownId, channel)
  const set = subscribers.get(k) ?? new Set()
  set.add(fn)
  subscribers.set(k, set)
  // Prune the (rundownId, channel) entry once its last subscriber leaves —
  // rundownId is arbitrary, unauthenticated input, so unbounded map growth
  // is a real concern otherwise.
  return () => {
    set.delete(fn)
    if (set.size === 0) subscribers.delete(k)
  }
}

export function getSnapshot(rundownId: string, channel: Channel): LiveTitle[] {
  return sortLiveSet(snapshots.get(key(rundownId, channel)) ?? new Map())
}
