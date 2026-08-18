'use client'
import { useEffect, useRef, useState } from 'react'
import { applyEvent } from './liveReducer'
import type { BroadcastEvent, OverlayPayload } from './types'

// The controller's read of live state. Where the etalon persisted is_preview /
// is_air per overlay, we derive them by subscribing to the rundown's own
// preview + air SSE channels and collecting the live overlay ids (unfiltered —
// the controller lights up buttons regardless of display_filter).
function useChannelIds(uuid: string | null, channel: 'preview' | 'air'): Set<number> {
  const [ids, setIds] = useState<Set<number>>(new Set())
  const ref = useRef<OverlayPayload[]>([])

  useEffect(() => {
    if (!uuid) return undefined
    // The stream replays the current snapshot as one event on connect, so the
    // first apply() repopulates (or clears) ids — no synchronous reset needed.
    ref.current = []
    const apply = (e: BroadcastEvent) => {
      ref.current = applyEvent(ref.current, e)
      setIds(new Set(ref.current.map((o) => o.id)))
    }
    const sse = new EventSource(`/api/broadcast/${uuid}/stream?channel=${channel}`)
    const onSet = (ev: MessageEvent) => apply({ type: channel, data: JSON.parse(ev.data) })
    sse.addEventListener('air', onSet)
    sse.addEventListener('preview', onSet)
    sse.addEventListener('hide', (ev) => apply({ type: 'hide', data: JSON.parse((ev as MessageEvent).data) }))
    sse.addEventListener('hide_all', () => apply({ type: 'hide_all' }))
    return () => sse.close()
  }, [uuid, channel])

  return ids
}

export function useRundownLiveSets(uuid: string | null): { previewIds: Set<number>; airIds: Set<number> } {
  return {
    previewIds: useChannelIds(uuid, 'preview'),
    airIds: useChannelIds(uuid, 'air'),
  }
}
