import { useEffect, useRef, useState } from 'react'
import type { Snapshot } from '../shared/types.ts'

/** Subscribes to the server's state stream and exposes the shared-jukebox actions. */
export function useJukebox() {
  const [state, setState] = useState<Snapshot | null>(null)
  const skew = useRef(0) // server clock - this browser's clock

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('state', e => {
      const next: Snapshot = JSON.parse(e.data)
      skew.current = next.now - Date.now()
      setState(next)
    })
    return () => es.close()
  }, [])

  const post = (path: string, body?: unknown) =>
    fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })

  return {
    state,
    /** Track position is measured against the server's clock, not this browser's. */
    serverNow: () => Date.now() + skew.current,
    add: (trackId: string, by: string) => post('/api/queue', { trackId, by }),
    skip: (id: string) => post('/api/next', { id }),
    togglePause: () => post('/api/pause'),
    remove: (id: string) => fetch(`/api/queue/${id}`, { method: 'DELETE' }),
  }
}
