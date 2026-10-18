# tivi

A jukebox for one room. Anybody queues a tune from their phone; the browser plugged into the
speakers plays it. No app, no accounts, one URL.

The library starts empty and the saloon fills it: upload a file off a phone, paste an archive.org
link, or type a song name and pick from the public-domain 78s. Every screen sees the same queue and
the same second of the same song.

## Run it

```bash
bun install          # or: npm install
bun run dev          # API on :8787, UI on http://localhost:5173
bun run build        # tsc + vite -> dist/
bun start            # http://localhost:8787, one process for UI + API + audio
```

- `PORT` moves the server off 8787.
- `JOIN_URL` is the address the QR and the join card hand out. Left alone it uses the machine's LAN
  IPv4, which is the address a phone can actually reach.

## Deploying

The live setup is split: UI on Vercel, API on a box, one origin from the browser's point of view.

- `vercel.json` rewrites `/api/*`, `/media/*` and `/qr.svg` to the box, so the client keeps relative
  paths and there is no CORS layer or API base URL to configure. Change the tunnel port in that file
  and in the tunnel unit together, then rebuild the frontend.
- On the box, `tivi.service` runs the server on :8787 with `JOIN_URL` pointing at the public URL,
  and `tivi-tunnel.service` carries that port out through a bore tunnel.
- One process is one room. The queue lives in memory, so a restart empties the line. The library
  does not: it is a JSON file next to the audio.

A single host that runs Node needs none of this. `bun run build && bun start` serves the UI, the API
and the audio from one port.

## How it plays

```mermaid
sequenceDiagram
    participant P as Speaker tab
    participant S as server/index.ts
    participant C as Guest phone
    S-->>P: SSE state {queue, playing, now}
    S-->>C: SSE state {queue, playing, now}
    C->>S: POST /api/queue {trackId, by}
    S-->>P: SSE state (queue +1)
    P->>P: play the track, seek to (now - startedAt)
    P->>S: POST /api/next {id} when the song ends
```

- `server/index.ts` keeps `queue` and `playing` in memory and pushes a snapshot to every subscriber
  over SSE at `GET /api/events`. `GET /api/state` is the one-shot read.
- `playing.startedAt` is the only clock. Position is `(pausedAt ?? now) - startedAt`, so pause is a
  timestamp shift and a tab that opens halfway through a song seeks to the right second instead of
  restarting it. `now` travels in every snapshot so each client cancels out its own clock drift.
- The mutations are `POST /api/queue`, `POST /api/next`, `POST /api/pause` and
  `DELETE /api/queue/:id`. `next` carries the id of the song the caller believes is playing, so the
  first tab to reach the end wins and six open tabs do not skip six songs.
- Browsers refuse audio before a gesture, so the first click or key press in a tab arms sound there.
  Volume and mute are per device (localStorage). The queue and pause are shared.

## Adding music

Four ways in, one pipeline: everything ends as a local file in `data/media/` and joins the library
over the same SSE stream.

- A song name searches archive.org scoped to `collection:78rpm`, so every row it offers can actually
  be played here. Picking one downloads the recording.
- An archive.org link skips the search. The resolver takes the largest mp3 in the item, caches it,
  and caches the label scan as the sleeve.
- A YouTube or Spotify link is read through its oEmbed endpoint for its title and then searched by
  that title, because the link itself cannot be streamed here.
- A file upload takes mp3, ogg, wav, flac, m4a or aac up to 25 MB, and the library holds 60 tracks.
  An upload carries no picture of its own, so the sleeve is looked up in the iTunes catalogue by
  title, with a second pass against the JP store for titles that are not romanised.

archive.org answers in ten seconds one moment and not at all the next, so downloads are retried
once and the panel says so while it works. `data/` is gitignored: on an ephemeral disk the library
is gone after a restart.

## The screen

```
┌───────┬──────────────────────────┬──────────────────┐
│ tivi  │  the record, sleeve size │  Up next  (line) │
│       │  (or its colour-ASCII)   │  Library         │
│ ▮▮▮▮  │                          │  ┌─────────────┐ │
│ ▮▮▮▮  │  title · artist · year   │  │ add a song  │ │
│  ▌    │  ────── progress ──────  │  └─────────────┘ │
│ 075%  │  ⏸ ⏭                    │  [Add] per song  │
│  🔈   │                          │                  │
└───────┴──────────────────────────┴──────────────────┘
```

- **Left: the sleeve**, with the name and the volume panel under it. The name runs up the gutter in
  the control-panel face, struck twice — a white pass and a second in the record's accent, stepped
  down and right like misregistered ink. No glow: the accent is pigment here, not a light source.
  A hairline and a 9px `78 rpm` spec sit beside it. The volume is a segmented ladder beside a pill
  track, drag it anywhere along its length or use the arrow keys. Both live in the record's own
  band rather than in the full-height left column, and the record is centred in that band, so the
  sign and the fader line up with the sleeve instead of with the middle of the page — at 1440×900,
  1440×1200, 1280×800 and 1152×780 their centre sits on the sleeve's centre to the pixel. The
  *Join* button sits in the Library header: it opens the QR over everything, with the address
  printed under it, and closes on Escape, on the X, or on a click outside. It is the only thing on
  screen asking to be scanned, so it stays out of the way until somebody wants it.
- **Right: everything you touch.** Add-music controls, the line, and the library.
- **The theme comes from the record.** `useArtworkTheme` runs node-vibrant over the cover and sets
  `--accent` / `--tint` on the document, so the wordmark's second pass, the progress bar, buttons
  and page glow all take the record's own colour. It takes a *vibrant* swatch rather than an
  average: a label scan is mostly paper and black shellac, and averaging those gives grey. The QR
  card rides the same variable, so it changes with the song — the six records land at 12.7–15.8:1
  against the black modules, and even a pure-black accent (which the theme lifts toward white)
  leaves 5.3:1, well past what a scanner needs. The modules themselves stay black: that is the part
  the camera reads.
- On a phone it stacks: sleeve, then line, then library.

## Not built

Search, a proper request line (a YouTube link shows as a request instead of an error), and
vote-to-skip were all considered and left out to keep this small. The library is one array
in `server/library.ts`, so any of them is additive.

## Layout

```
shared/     types shared by both sides
server/     Hono app: library + queue state, SSE stream, archive.org resolver, static hosting
src/        React UI: App.tsx, Artwork.tsx (sleeve + colour ASCII), Logo.tsx (the wordmark), useArtworkTheme.ts, useJukebox.ts
public/     the six built-in audio files and their label scans (built into dist/)
data/       runtime library: library.json + every uploaded or fetched track and cover (gitignored)
```
