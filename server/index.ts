import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SSEStreamingApi } from 'hono/streaming'
import { z } from 'zod'
import { addTrack, library } from './library.ts'
import type { Playing, QueueItem, Snapshot } from '../shared/types.ts'

/* State lives in memory: one saloon, one night, one process. Restart = fresh room. */
const queue: QueueItem[] = []
let playing: Playing | null = null
const listeners = new Set<SSEStreamingApi>()

const snapshot = (): Snapshot => ({ library, queue, playing, now: Date.now() })

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

const app = new Hono()

app.get('/api/state', c => c.json(snapshot()))

app.get('/api/events', c =>
  streamSSE(c, async stream => {
    listeners.add(stream)
    stream.onAbort(() => {
      listeners.delete(stream)
    })
    await stream.writeSSE({ event: 'state', data: JSON.stringify(snapshot()) })
    await new Promise<void>(resolve => {
      stream.onAbort(resolve)
    })
  }),
)

app.post('/api/queue', async c => {
  const body = AddBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success || !library.some(t => t.id === body.data.trackId)) return c.json({ error: 'bad request' }, 400)
  queue.push({ id: crypto.randomUUID(), trackId: body.data.trackId, by: body.data.by || 'someone' })
  if (!playing) advance()
  broadcast()
  return c.json(snapshot())
})

/** Skip, or the song ended in some tab. Only the first caller's id still matches. */
app.post('/api/next', async c => {
  const body = IdBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'bad request' }, 400)
  if (playing?.id === body.data.id) {
    advance()
    broadcast()
  }
  return c.json(snapshot())
})

app.post('/api/pause', c => {
  if (playing) {
    if (playing.pausedAt === null) {
      playing.pausedAt = Date.now()
    } else {
      playing.startedAt += Date.now() - playing.pausedAt // shift the start so position math still holds
      playing.pausedAt = null
    }
    broadcast()
  }
  return c.json(snapshot())
})

app.delete('/api/queue/:id', c => {
  const i = queue.findIndex(q => q.id === c.req.param('id'))
  if (i !== -1) queue.splice(i, 1)
  broadcast()
  return c.json(snapshot())
})

const AUDIO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
}
const MAX_UPLOAD = 25 * 1024 * 1024
const MAX_TRACKS = 60

/** Anyone holding the URL can add music, so everything user-supplied is capped and rerouted. */
app.post('/api/library', async c => {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) return c.json({ error: 'send an audio file in the "file" field' }, 400)
  const ext = AUDIO_EXT[file.type]
  if (!ext) return c.json({ error: `unsupported audio type: ${file.type || 'unknown'}` }, 415)
  if (file.size > MAX_UPLOAD) return c.json({ error: 'that file is over 25 MB' }, 413)
  if (library.length >= MAX_TRACKS) return c.json({ error: 'the library is full' }, 409)
  const id = crypto.randomUUID()
  const name = `${id}.${ext}`
  mkdirSync('data/tracks', { recursive: true })
  writeFileSync(`data/tracks/${name}`, Buffer.from(await file.arrayBuffer()))
  const track = {
    id,
    title: file.name.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'untitled',
    artist: 'uploaded in the saloon',
    year: new Date().getFullYear(),
    src: `/media/${name}`,
  }
  addTrack(track)
  broadcast()
  return c.json(track)
})

/* Uploads live outside dist/, which the build wipes. */
app.use('/media/*', serveStatic({ root: './data/tracks' }))

/* One process serves the API, the audio and the built UI (after `bun run build`). */
if (existsSync('dist')) app.use('*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, info => console.log(`tivi on http://localhost:${info.port}`))
