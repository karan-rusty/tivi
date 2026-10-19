# tivi

## Description

tivi is a jukebox for one room. Guests open the site on their phone and queue a song; the browser
plugged into the speakers plays it. The library starts empty and fills up as people add music.

## Screenshots

![tivi with a record playing](screenshot.png)

## Getting Started

### Dependencies

You need Bun 1.4+ (or Node 22.12+ when installing with npm). There is no database and nothing else
to set up. The only network calls go to archive.org for search and the iTunes catalogue for cover
art.

### Installing

Clone the repo and install the dependencies:

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

`PORT` moves the server off 8787. `JOIN_URL` is the address the QR code hands out; it defaults to
the machine's LAN IPv4.

## Adding music

Type a song name and tivi searches archive.org's 78rpm collection. You can also paste an archive.org,
YouTube or Spotify link. To upload a file, pick an mp3, ogg, wav, flac, m4a or aac up to 25 MB. The
library is capped at 60 tracks.

## Help

- Audio will not start until someone clicks the page once. Browsers refuse before that; the next
  gesture retries.
- If the QR code points at the wrong address, set `JOIN_URL` and restart the server.
- There is no request line and no vote-to-skip yet. The library is a single array in
  `server/library.ts`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
