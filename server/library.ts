import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Track } from '../shared/types.ts'

/**
 * Public-domain 1920s 78s, from the Library of Congress "National Jukebox"
 * collection on archive.org (CC Public Domain Mark 1.0). Re-encoded to mono 96k.
 */
const SEED: Track[] = [
  { id: 'that-da-da-strain', title: 'That Da-Da Strain', artist: 'The Virginians (Ross Gorman)', year: 1922, src: '/tracks/that-da-da-strain.mp3' },
  { id: 'whoa-tillie', title: 'Whoa, Tillie, Take Your Time', artist: 'The Virginians (Ross Gorman)', year: 1923, src: '/tracks/whoa-tillie-take-your-time.mp3' },
  { id: 'jim-jams', title: 'Jim Jams', artist: 'Roy Bargy', year: 1924, src: '/tracks/jim-jams.mp3' },
  { id: 'swanee-river', title: "I'm Haunted by That Swanee River Song", artist: "Fred Waring's Pennsylvanians", year: 1924, src: '/tracks/i-m-haunted-by-that-swanee-river-song.mp3' },
  { id: 'superstitious-blues', title: 'Superstitious Blues', artist: 'The Virginians (Ross Gorman)', year: 1924, src: '/tracks/superstitious-blues.mp3' },
  { id: 'burning-sands', title: 'Burning Sands', artist: 'Yerkes Jazarimba Orchestra', year: 1922, src: '/tracks/burning-sands.mp3' },
]

const FILE = 'data/library.json'

/** Whatever was added to the saloon's library last night, or the seed on a fresh box. */
export const library: Track[] = (() => {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Track[]
  } catch {
    return structuredClone(SEED)
  }
})()

export function addTrack(track: Track) {
  library.push(track)
  mkdirSync('data', { recursive: true })
  writeFileSync(FILE, JSON.stringify(library, null, 2))
}
