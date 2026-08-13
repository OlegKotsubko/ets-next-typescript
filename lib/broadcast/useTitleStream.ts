'use client'

import { useEffect, useRef, useState } from 'react'
import { applyEvent, sortLiveSet, type LiveTitle, type BroadcastEvent } from './liveSet'

export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[] {
  const [titles, setTitles] = useState<LiveTitle[]>([])
  const mapRef = useRef<Map<string, LiveTitle>>(new Map())
  const key = `${rundownId}:${channel}`
  const [seenKey, setSeenKey] = useState(key)

  // Adjusting state during render when rundownId/channel changes — React's
  // documented alternative to a syncing effect, which would cascade an extra render.
  if (seenKey !== key) {
    setSeenKey(key)
    // eslint-disable-next-line react-hooks/refs
    mapRef.current = new Map()
    setTitles([])
  }

  useEffect(() => {
    const es = new EventSource(`/api/broadcast/${rundownId}/stream?channel=${channel}`)
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as BroadcastEvent
      mapRef.current = applyEvent(mapRef.current, event)
      setTitles(sortLiveSet(mapRef.current))
    }
    // EventSource auto-reconnects on network drop; no manual retry needed.
    return () => es.close()
  }, [rundownId, channel])

  return titles
}
