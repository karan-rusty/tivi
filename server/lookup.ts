import { z } from 'zod'
import { credit } from './archive.ts'

export type Hit = { url: string; title: string; artist: string; year: number }

const SearchDoc = z.object({
  identifier: z.string(),
  title: z.union([z.string(), z.array(z.string())]).optional(),
  creator: z.union([z.string(), z.array(z.string())]).optional(),
  year: z.union([z.string(), z.number()]).optional(),
})
const SearchResponse = z.object({ response: z.object({ docs: z.array(SearchDoc) }) })

const Embed = z.object({ title: z.string().optional(), author_name: z.string().optional() })

const YOUTUBE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//
const SPOTIFY = /^https?:\/\/(?:open\.)?spotify\.com\//

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)" -> the song, not the ad. */
export function cleanTitle(text: string) {
  return text
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[-–|]\s*(official|lyrics?|audio|video|hd|hq|remaster(ed)?|4k)\b.*$/i, '')
    .trim()
    .slice(0, 80)
}

/** Takes the query syntax out of whatever somebody typed, so `AC/DC` cannot break the search. */
function sanitise(text: string) {
  return text
    .replace(/[\\:()[\]{}"^*~?/]/g, ' ')
    .split(/\s+/)
    .filter(word => word && !/^(AND|OR|NOT|TO)$/i.test(word))
    .slice(0, 12)
    .join(' ')
}

/**
 * Searches the public-domain 78s and nothing else. Everything it returns can actually be played
 * here, which is the whole point of letting somebody ask for a song by name.
 */
export async function searchArchive(text: string): Promise<Hit[]> {
  const query = sanitise(text)
  if (query.length < 2) return []
  const params = new URLSearchParams({
    q: `${query} AND collection:78rpm AND format:"VBR MP3"`,
    rows: '8',
    output: 'json',
  })
  for (const field of ['identifier', 'title', 'creator', 'year']) params.append('fl[]', field)
  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null)
  const parsed = SearchResponse.safeParse(res?.ok ? await res.json().catch(() => null) : null)
  if (!parsed.success) return []
  const seen = new Set<string>()
  const hits: Hit[] = []
  for (const doc of parsed.data.response.docs) {
    if (seen.has(doc.identifier)) continue // the index does repeat items
    seen.add(doc.identifier)
    hits.push({
      url: `https://archive.org/details/${doc.identifier}`,
      title: (first(doc.title) ?? doc.identifier).slice(0, 80),
      artist: credit(first(doc.creator)),
      year: Number(String(doc.year ?? '').slice(0, 4)) || 0,
    })
  }
  return hits
}

const ITunes = z.object({
  results: z.array(
    z.object({
      trackName: z.string().optional(),
      artworkUrl100: z.string().optional(),
    }),
  ),
})

/** Spaces and punctuation differ between a filename and a catalogue entry; letters do not. */
const bare = (text: string) => text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

async function searchCover(query: string, country?: string) {
  const params = new URLSearchParams({ term: query, entity: 'song', limit: '5' })
  if (country) params.set('country', country)
  const res = await fetch(`https://itunes.apple.com/search?${params}`, {
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
  const parsed = ITunes.safeParse(res?.ok ? await res.json().catch(() => null) : null)
  if (!parsed.success) return null
  const wanted = bare(query)
  for (const hit of parsed.data.results) {
    // The catalogue says "High Forever (Marlon Hoffstadt Remix)"; the song is still "High Forever".
    const name = bare(cleanTitle(hit.trackName ?? ''))
    if (name.length < 2 || !wanted.includes(name) || !hit.artworkUrl100) continue
    return hit.artworkUrl100.replace('100x100bb', '600x600bb')
  }
  return null
}

/**
 * A sleeve for a file somebody handed us, which carries no picture of its own. iTunes' catalogue
 * answers by title alone and hands back a 100px asset that is the same image as its 600px one.
 * The match has to be the song we asked for — a wrong cover is worse than the stand-in sleeve.
 * The second pass is for songs whose catalogue entry is in their own script, not romanised.
 */
export async function coverUrl(title: string): Promise<string | null> {
  const query = sanitise(cleanTitle(title))
  if (query.length < 2) return null
  return (await searchCover(query)) ?? (await searchCover(query, 'JP'))
}

/**
 * The one thing we can take from a YouTube or Spotify link is what it calls itself. That is enough
 * to go and look for a playable version of the same song, and to say why we cannot play the link.
 */
export async function titleOfLink(url: string): Promise<{ title: string; artist: string } | null> {
  const endpoint = YOUTUBE.test(url)
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    : SPOTIFY.test(url)
      ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
      : null
  if (!endpoint) return null
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  const parsed = Embed.safeParse(res?.ok ? await res.json().catch(() => null) : null)
  if (!parsed.success || !parsed.data.title) return null
  return { title: parsed.data.title, artist: parsed.data.author_name ?? '' }
}
