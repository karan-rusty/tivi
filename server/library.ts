import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Track } from '../shared/types.ts'

const A = (id: string) => `/tracks/art/${id}.jpg`
const SEED: Track[] = [
  { id: 'that-da-da-strain', title: 'That Da-Da Strain', artist: 'The Virginians (Ross Gorman)', year: 1922, src: '/tracks/that-da-da-strain.mp3', art: A('that-da-da-strain') },
  { id: 'whoa-tillie', title: 'Whoa, Tillie, Take Your Time', artist: 'The Virginians (Ross Gorman)', year: 1923, src: '/tracks/whoa-tillie-take-your-time.mp3', art: A('whoa-tillie') },
  { id: 'jim-jams', title: 'Jim Jams', artist: 'Roy Bargy', year: 1924, src: '/tracks/jim-jams.mp3', art: A('jim-jams') },
  { id: 'swanee-river', title: "I'm Haunted by That Swanee River Song", artist: "Fred Waring's Pennsylvanians", year: 1924, src: '/tracks/i-m-haunted-by-that-swanee-river-song.mp3', art: A('swanee-river') },
  { id: 'superstitious-blues', title: 'Superstitious Blues', artist: 'The Virginians (Ross Gorman)', year: 1924, src: '/tracks/superstitious-blues.mp3', art: A('superstitious-blues') },
  { id: 'burning-sands', title: 'Burning Sands', artist: 'Yerkes Jazarimba Orchestra', year: 1922, src: '/tracks/burning-sands.mp3', art: A('burning-sands') },
]

const FILE = 'data/library.json'

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
