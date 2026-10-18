import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Track } from '../shared/types.ts'

const FILE = 'data/library.json'

/** Starts empty: everything in it was added at runtime, so it is exactly what it was left holding. */
export const library: Track[] = (() => {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Track[]
  } catch {
    return []
  }
})()

export function addTrack(track: Track) {
  library.push(track)
  mkdirSync('data', { recursive: true })
  writeFileSync(FILE, JSON.stringify(library, null, 2))
}
