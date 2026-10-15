import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SSEStreamingApi } from 'hono/streaming'
import { z } from 'zod'
import { TRACKS } from '../shared/tracks.ts'
import type { Playing, QueueItem, Snapshot } from '../shared/types.ts'

/* State lives in memory: one saloon, one night, one process. Restart = fresh room. */
const queue: QueueItem[] = []
let playing: Playing | null = null
const listeners = new Set<SSEStreamingApi>()

const snapshot = (): Snapshot => ({ queue, playing, now: Date.now() })

function broadcast() {
  const data = JSON.stringify(snapshot())
  for (const l of listeners) void l.writeSSE({ event: 'state', data }).catch(() => {})
}

/** Pull the next request off the line and put it on the turntable. */
function advance() {
  const item = queue.shift()
  playing = item ? { id: item.id, trackId: item.trackId, startedAt: Date.now(), pausedAt: null } : null
}

const AddBody = z.object({ trackId: z.string(), by: z.string().trim().max(32).optional() })
const IdBody = z.object({ id: z.string() })
