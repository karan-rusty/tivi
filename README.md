# Dustline Jukebox

A shared jukebox for the saloon. Anybody can queue a tune from their phone; one browser
plugged into the speakers plays it. No app to install — just a URL.

## What it does

- **Library of 6 tracks** — 1920s 78s, public domain, served straight from this repo.
- **Anyone can queue** — visitors hit *Add*; the queue is shared across every open tab and
  phone through a server-sent-events stream.
- **Play, pause, skip, volume** — pause/skip are shared (it is one jukebox, not six);
  volume and mute are local to the browser you are listening on.
- **Now playing** with a live progress bar, driven by the server's clock so every screen
  agrees on where the song is.
- **Survives a refresh** — a new tab picks the song up mid-play instead of restarting it.

## Run it

```bash
bun install          # or: npm install
bun run dev          # API on :8787, UI on http://localhost:5173
```

Production build (one process serves the UI, the API and the audio):

```bash
bun run build        # tsc + vite -> dist/
bun start            # http://localhost:8787   (PORT=8080 bun start to change it)
```

## Deploy the public URL

Any host that runs a Node process works — Render, Railway, Fly, a box in the corner:

1. push this repo to GitHub and create a **Web Service** from it
2. build: `npm ci && npm run build`
3. start: `npm start`
4. open the URL, put it on the machine wired to the speakers, hit *Add* once

The server binds to `$PORT`, so no host-specific config is needed. State lives in memory:
one process, no database, and a restart empties the saloon (fine for a night of requests).

Run it on more than one instance and the queue splits across them.

## How it works
