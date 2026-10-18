import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { streamSSE } from 'hono/streaming'
import type { SSEStreamingApi } from 'hono/streaming'
import { z } from 'zod'
import qrcode from 'qrcode-generator'
import { resolveArchiveLink } from './archive.ts'
import { addTrack, library } from './library.ts'
import { cleanTitle, coverUrl, searchArchive, titleOfLink } from './lookup.ts'
import type { Playing, QueueItem, Snapshot } from '../shared/types.ts'

/* State lives in memory: one saloon, one night, one process. Restart = fresh room. */
const queue: QueueItem[] = []
let playing: Playing | null = null
const listeners = new Set<SSEStreamingApi>()

const port = Number(process.env.PORT ?? 8787)

const lan = Object.values(networkInterfaces())
  .flat()
  .find(i => i?.family === 'IPv4' && !i.internal)
const joinUrl = process.env.JOIN_URL ?? `http://${lan?.address ?? 'localhost'}:${port}`

const qr = qrcode(0, 'M')
qr.addData(joinUrl)
qr.make()
const qrSvg = qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true }).replace('fill="white"', 'fill="none"')

const snapshot = (): Snapshot => ({ library, queue, playing, joinUrl, now: Date.now() })

function broadcast() {
  const data = JSON.stringify(snapshot())
  for (const l of listeners) void l.writeSSE({ event: 'state', data }).catch(() => { })
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

app.get('/qr.svg', c =>
  c.body(qrSvg, 200, {
    'content-type': 'image/svg+xml',
    // A restart can move the address (a new network, a new tunnel), so a browser must not pin this
    // for a day and hand out a QR for wherever the saloon used to be.
    'cache-control': 'public, max-age=60',
  }),
)

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

/**
 * An uploaded file carries no picture, so the sleeve is looked up from its title and cached beside
 * the audio. Best effort: no cover found, no art, and the UI falls back to its stand-in sleeve.
 */
async function saveCover(id: string, title: string) {
  const url = await coverUrl(title)
  if (!url) return undefined
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!res?.ok || !res.headers.get('content-type')?.startsWith('image/')) return undefined
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.byteLength > 2 * 1024 * 1024) return undefined
  writeFileSync(`data/media/${id}.jpg`, bytes)
  return `/media/${id}.jpg`
}

app.use(
  '/api/library',
  bodyLimit({ maxSize: MAX_UPLOAD, onError: c => c.json({ error: 'that file is over 25 MB' }, 413) }),
)

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
  mkdirSync('data/media', { recursive: true })
  writeFileSync(`data/media/${name}`, Buffer.from(await file.arrayBuffer()))
  const stem = file.name.replace(/\.[^.]+$/, '').trim()
  const title = stem.slice(0, 80) || 'untitled'
  const track = {
    id,
    title,
    artist: 'uploaded in the saloon',
    year: new Date().getFullYear(),
    src: `/media/${name}`,
    // The sleeve is looked up from the whole name: the stored title may have been cut mid-word.
    art: await saveCover(id, stem || title),
  }
  addTrack(track)
  broadcast()
  return c.json(track)
})

const LinkBody = z.object({ url: z.string().max(2048) })

app.post('/api/library/link', async c => {
  const body = LinkBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'send { url }' }, 400)
  if (library.length >= MAX_TRACKS) return c.json({ error: 'the library is full' }, 409)
  const track = await resolveArchiveLink(body.data.url)
  if ('error' in track) return c.json(track, 400)
  const known = library.find(t => t.id === track.id)
  if (known) return c.json(known)
  addTrack(track)
  broadcast()
  return c.json(track)
})

const Lookup = z.object({ value: z.string().trim().min(2).max(2048) })

app.post('/api/inspect', async c => {
  const body = Lookup.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'type a song or paste a link' }, 400)
  const value = body.data.value
  const isLink = /^https?:\/\//i.test(value)
  const raw = isLink ? await titleOfLink(value) : null
  if (isLink && !raw) {
    return c.json({ error: 'could not read that link — archive.org, YouTube and Spotify links only' }, 400)
  }
  const link = raw ? { title: cleanTitle(raw.title), artist: cleanTitle(raw.artist) } : null
  // A YouTube title already reads "Artist - Song", so the artist is only appended when missing.
  const query = link
    ? link.artist && !link.title.toLowerCase().includes(link.artist.toLowerCase())
      ? `${link.title} ${link.artist}`
      : link.title
    : value
  return c.json({ link, query, results: await searchArchive(query) })
})

/* Uploads live outside dist/, which the build wipes. serveStatic joins the whole request path,
   so the /media prefix has to come back off before it looks on disk. */
mkdirSync('data/media', { recursive: true })
app.use(
  '/media/*',
  serveStatic({ root: './data/media', rewriteRequestPath: p => p.replace(/^\/media/, '') }),
)

/* One process serves the API, the audio and the built UI (after `bun run build`). */
if (existsSync('dist')) app.use('*', serveStatic({ root: './dist' }))

serve({ fetch: app.fetch, port }, info =>
  console.log(`tivi on http://localhost:${info.port} — phones join at ${joinUrl}`),
)
