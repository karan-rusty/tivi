# tivi

## Description

A jukebox for one room. Anyone queues a song from their phone; the browser on the speakers plays it.

## Screenshots

![tivi with a record playing](screenshot.png)

## Getting Started

### Dependencies

Bun 1.4+ (or Node 22.12+ with npm). No database; the only network calls are archive.org search and
the iTunes catalogue.

### Installing

```bash
git clone https://github.com/karan-rusty/tivi.git
cd tivi
bun install          # or: npm install
```

### Executing program

```bash
bun run dev    # API :8787, UI on http://localhost:5173
bun run build  # tsc + vite -> dist/
bun start      # http://localhost:8787, UI + API + audio in one process
```

`PORT` moves the server off 8787. `JOIN_URL` is the address the QR hands out, defaulting to the
machine's LAN IPv4.

## Adding music

A name searches archive.org's 78s; an archive.org, YouTube or Spotify link works too. Uploads take
mp3, ogg, wav, flac, m4a or aac up to 25 MB, and the library holds 60 tracks.

## Help

- Browsers refuse audio until the page is clicked once; every later gesture retries.
- If the QR points at the wrong address, set `JOIN_URL` and restart the server.
- There is no request line or vote-to-skip yet; the library is one array in `server/library.ts`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
