import type { Track } from './types.ts'

/**
 * Public-domain 1920s 78s, from the Library of Congress "National Jukebox"
 * collection on archive.org (CC Public Domain Mark 1.0). Re-encoded to mono 96k.
 */
export const TRACKS: Track[] = [
  { id: 'that-da-da-strain', title: 'That Da-Da Strain', artist: 'The Virginians (Ross Gorman)', year: 1922, file: 'that-da-da-strain.mp3' },
  { id: 'whoa-tillie', title: 'Whoa, Tillie, Take Your Time', artist: 'The Virginians (Ross Gorman)', year: 1923, file: 'whoa-tillie-take-your-time.mp3' },
  { id: 'jim-jams', title: 'Jim Jams', artist: 'Roy Bargy', year: 1924, file: 'jim-jams.mp3' },
  { id: 'swanee-river', title: "I'm Haunted by That Swanee River Song", artist: "Fred Waring's Pennsylvanians", year: 1924, file: 'i-m-haunted-by-that-swanee-river-song.mp3' },
  { id: 'superstitious-blues', title: 'Superstitious Blues', artist: 'The Virginians (Ross Gorman)', year: 1924, file: 'superstitious-blues.mp3' },
  { id: 'burning-sands', title: 'Burning Sands', artist: 'Yerkes Jazarimba Orchestra', year: 1922, file: 'burning-sands.mp3' },
]
