import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import type { Track } from '../shared/types.ts'

const ARCHIVE_LINK = /^https?:\/\/(?:www\.)?archive\.org\/(?:details|download|embed|metadata)\/([^/?#]+)/

const ArchiveMeta = z.object({
  metadata: z.object({
    title: z.string().optional(),
    creator: z.string().optional(),
    date: z.string().optional(),
  }),
  files: z.array(z.object({ name: z.string(), size: z.union([z.string(), z.number()]).optional() })),
})

const MAX_FETCH = 40 * 1024 * 1024

/** "gorman, ross ; williams, spencer" -> "Ross Gorman" */
function credit(raw?: string) {
  const [last, first] = (raw ?? '').split(';')[0].split(',').map(s => s.trim())
  const name = first ? `${first} ${last}` : last
  return name ? name.replace(/\b\w/g, l => l.toUpperCase()) : 'archive.org'
}

/**
 * Pulls one item off archive.org (public-domain 78s, live recordings) and caches it in the
 * saloon's library, so playback stays a local file like every other track.
 */
export async function resolveArchiveLink(link: string): Promise<Track | { error: string }> {
  const id = ARCHIVE_LINK.exec(link.trim())?.[1]
  if (!id) return { error: 'only archive.org links are supported so far' }
  const res = await fetch(`https://archive.org/metadata/${id}`).catch(() => null)
  const parsed = ArchiveMeta.safeParse(res?.ok ? await res.json().catch(() => null) : null)
  if (!parsed.success) return { error: 'archive.org did not answer with item details' }
  const { metadata, files } = parsed.data
  const mp3s = files
    .filter(f => f.name.toLowerCase().endsWith('.mp3'))
    .map(f => ({ name: f.name, bytes: Number(f.size ?? 0) }))
  // Some items carry a truncated derivative, so take the biggest mp3 rather than the first.
  const best = mp3s.sort((a, b) => b.bytes - a.bytes)[0]
  if (!best) return { error: 'that item has no mp3 to play' }
  if (best.bytes > MAX_FETCH) return { error: 'that item is over 40 MB' }
  const audio = await fetch(`https://archive.org/download/${id}/${encodeURIComponent(best.name)}`).catch(() => null)
  if (!audio?.ok) return { error: 'could not download the audio from archive.org' }
  const slug = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const name = `${slug}.mp3`
  mkdirSync('data/tracks', { recursive: true })
  writeFileSync(`data/tracks/${name}`, Buffer.from(await audio.arrayBuffer()))
  return {
    id: slug,
    title: metadata.title?.slice(0, 80) ?? slug,
    artist: credit(metadata.creator),
    year: Number(metadata.date?.slice(0, 4)) || new Date().getFullYear(),
    src: `/media/${name}`,
  }
}
