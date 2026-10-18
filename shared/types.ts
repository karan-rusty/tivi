export type Track = {
  id: string
  title: string
  artist: string
  year: number
  /** Playable path. Everything the saloon adds at runtime sits under /media. */
  src: string
  /** Cover/label scan, same origin so the browser can read its pixels. Missing for uploads. */
  art?: string
}

export type QueueItem = {
  id: string
  trackId: string
  by: string
}

/** The one song the saloon is hearing. Position = (pausedAt ?? now) - startedAt. */
export type Playing = {
  id: string
  trackId: string
  startedAt: number
  pausedAt: number | null
}

/** `now` is the server clock at send time; clients use it to correct for drift. */
export type Snapshot = {
  library: Track[]
  queue: QueueItem[]
  playing: Playing | null
  /** Where a phone should open this jukebox — the LAN address, since the saloon screen is localhost. */
  joinUrl: string
  now: number
}
