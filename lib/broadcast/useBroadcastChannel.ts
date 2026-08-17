'use client'
import { useEffect, useRef, useState } from 'react'
import { applyEvent, filterByDisplay, sortByLayer } from './liveReducer'
import type { BroadcastEvent, Channel, OverlayPayload } from './types'

export function useBroadcastChannel(uuid: string, channel: Channel, filter: string | null): OverlayPayload[] {
  const [set, setSet] = useState<OverlayPayload[]>([])
  const ref = useRef<OverlayPayload[]>([])

  useEffect(() => {
    const apply = (e: BroadcastEvent) => {
      ref.current = applyEvent(ref.current, e)
      setSet(ref.current)
    }
    const sse = new EventSource(`/api/broadcast/${uuid}/stream?channel=${channel}`)
    const onSet = (ev: MessageEvent) => apply({ type: channel, data: JSON.parse(ev.data) })
    sse.addEventListener('air', onSet)
    sse.addEventListener('preview', onSet)
    sse.addEventListener('hide', (ev) => apply({ type: 'hide', data: JSON.parse((ev as MessageEvent).data) }))
    sse.addEventListener('hide_all', () => apply({ type: 'hide_all' }))
    sse.addEventListener('live_update', (ev) => apply({ type: 'live_update', data: JSON.parse((ev as MessageEvent).data) }))
    return () => sse.close()
  }, [uuid, channel])

  return sortByLayer(filterByDisplay(set, filter))
}
