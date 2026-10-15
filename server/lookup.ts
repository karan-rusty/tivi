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
