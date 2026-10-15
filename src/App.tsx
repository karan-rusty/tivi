import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Trash2, Upload, Volume2, VolumeX } from 'lucide-react'
import { Artwork } from './Artwork.tsx'
import { useArtworkTheme } from './useArtworkTheme.ts'
import { useJukebox } from './useJukebox.ts'

const read = (key: string, fallback: string) => localStorage.getItem(key) ?? fallback

export default function App() {
  const { state, serverNow, add, skip, togglePause, remove } = useJukebox()
  const audio = useRef<HTMLAudioElement>(null)
  const [volume, setVolume] = useState(() => Number(read('tivi.volume', '0.8')))
  const [muted, setMuted] = useState(() => read('tivi.muted', 'no') === 'yes')
  const [name, setName] = useState(() => read('tivi.name', ''))
  const [duration, setDuration] = useState(0)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [, tick] = useState(0)

  const library = state?.library ?? []
  const playing = state?.playing ?? null
  const track = library.find(t => t.id === playing?.trackId)
  useArtworkTheme(track?.art)
  // Position comes from the shared clock, so every screen in the saloon agrees.
  const elapsed = playing ? Math.max(0, (playing.pausedAt ?? serverNow()) - playing.startedAt) / 1000 : 0
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0

  function sync() {
    const el = audio.current
    if (!el) return
    if (!playing || !track) return el.pause()
    if (!el.currentSrc.endsWith(track.src)) {
      el.src = track.src
      el.load()
    }
    el.volume = muted ? 0 : volume
    el.onerror = () => {
      if (playing) void skip(playing.id) // a track we cannot load must not stall the line
    }
    if (el.readyState < 1) return
    if (Number.isFinite(el.duration) && el.duration > 0) {
      const target = Math.min(elapsed, el.duration - 0.3)
      if (Math.abs(el.currentTime - target) > 1.5) el.currentTime = Math.max(0, target)
    }
    if (playing.pausedAt !== null) return el.pause()
    // Before this device's first gesture the browser refuses and this rejects — the next one retries.
    if (el.paused) void el.play().catch(() => {})
  }

  useEffect(sync) // runs after every render: the server state is the only source of truth
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const addTrack = (trackId: string) => void add(trackId, name)

  /** A file off someone's phone: upload it to the saloon, then put it straight on the line. */
  async function upload(file: File) {
    setNote('')
    setBusy(`uploading ${file.name}…`)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/library', { method: 'POST', body: form })
    const out: { id?: string; error?: string } = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) return setNote(out.error ?? 'upload failed')
    if (out.id) addTrack(out.id)
  }

  /** An archive.org link: the server caches the audio, so it plays like any other track. */
  async function addLink() {
    setNote('')
    setBusy('fetching from archive.org…')
    const res = await fetch('/api/library/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: link }),
    })
    const out: { id?: string; error?: string } = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) return setNote(out.error ?? 'could not add that link')
    setLink('')
    if (out.id) addTrack(out.id)
  }

  return (
    <div
      className="relative isolate min-h-dvh text-neutral-100 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden"
      // Browsers only allow audio after a real gesture, so the first one anywhere in the page
      // unlocks this device — no prompt, no button. Capture, so it fires before anything else.
      onPointerDownCapture={sync}
      onKeyDownCapture={sync}
    >
      {/* The room is lit by whatever is on the turntable: the cover blown up past the viewport,
          blurred, and dimmed behind a scrim so the text stays readable. */}
      <div aria-hidden className="fixed inset-0 -z-30 bg-neutral-950" />
      {track?.art && (
        <img
          key={track.art}
          src={track.art}
          alt=""
          aria-hidden
          className="fixed inset-0 -z-20 h-full w-full scale-125 object-cover opacity-35 blur-3xl"
        />
      )}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(120% 70% at 50% 0%, var(--tint, transparent), transparent 75%), linear-gradient(rgba(10,10,10,0.5), rgba(10,10,10,0.85))',
        }}
      />
      <main
        className={`mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 p-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[auto_minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6 lg:p-4`}
      >
        {/* The name, set as a sign down the gutter and lit by whatever record is on. */}
        <div className="hidden items-center justify-center lg:row-span-2 lg:flex">
          <h1
            className="font-display text-3xl leading-none tracking-[0.35em] text-neutral-400"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textShadow: '0 0 26px var(--accent, #f59e0b)' }}
          >
            tivi
          </h1>
        </div>
        <section className="flex min-h-0 flex-col gap-3 lg:row-span-2">
          <div className="flex items-baseline justify-between lg:hidden">
            <h1 className="font-display text-xl leading-none" style={{ textShadow: '0 0 22px var(--accent, #f59e0b)' }}>
              tivi
            </h1>
            <span className="text-[11px] uppercase tracking-[0.2em] text-accent/80">Now playing</span>
          </div>
          <p className="hidden text-[11px] uppercase tracking-[0.2em] text-accent/80 lg:block">Now playing</p>
          <div className="flex min-h-0 flex-1 items-center justify-center lg:[container-type:size]">
            <Artwork track={track} />
          </div>
          <h2 className="truncate text-xl font-semibold">{track?.title ?? 'Nothing on the turntable'}</h2>
          <p className="text-sm text-neutral-400">
            {track ? `${track.artist} · ${track.year}` : 'Add a tune below to start the night'}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void togglePause()}
              disabled={!playing}
              aria-label={playing?.pausedAt === null ? 'Pause' : 'Play'}
              className="rounded-lg border border-neutral-700 p-2 hover:bg-neutral-800 disabled:opacity-40"
            >
              {playing && playing.pausedAt === null ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button"
              onClick={() => playing && void skip(playing.id)}
              disabled={!playing}
              aria-label="Skip"
              className="rounded-lg border border-neutral-700 p-2 hover:bg-neutral-800 disabled:opacity-40"
            >
              <SkipForward size={16} />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !muted
                  setMuted(next)
                  localStorage.setItem('tivi.muted', next ? 'yes' : 'no')
                }}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="rounded-lg border border-neutral-700 p-2 hover:bg-neutral-800"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                onChange={e => {
                  setVolume(Number(e.target.value))
                  localStorage.setItem('tivi.volume', e.target.value)
                }}
                className="w-24 accent-[var(--accent)]"
              />
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col">
          <h3 className="mb-1 flex items-baseline gap-2 text-sm font-medium text-neutral-400">
            Up next
            {state && <span className="text-xs font-normal text-neutral-600">{state.queue.length} in line</span>}
          </h3>
          {state?.queue.length ? (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {state.queue.map((item, i) => {
                const t = library.find(x => x.id === item.trackId)
                return (
                  <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                    <span className="w-4 text-right text-xs text-neutral-600">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {t?.title ?? item.trackId}
                      <span className="text-neutral-500"> · {t?.artist}</span>
                    </span>
                    <span className="max-w-24 truncate text-xs text-neutral-500">{item.by}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${t?.title ?? item.trackId}`}
                      onClick={() => void remove(item.id)}
                      className="text-neutral-600 hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-800/70 px-3 py-6 text-center text-sm text-neutral-600">
              The line is empty.
            </p>
          )}
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-neutral-400">Library</h3>
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Adding as
              <input
                value={name}
                placeholder="a stranger"
                onChange={e => {
                  setName(e.target.value)
                  localStorage.setItem('tivi.name', e.target.value)
                }}
                className="w-32 rounded-md bg-white/5 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
            </label>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20">
              <Upload size={13} /> Add from this device
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void upload(f)
                }}
              />
            </label>
            <input
              value={link}
              placeholder="or paste an archive.org link"
              onChange={e => setLink(e.target.value)}
              className="min-w-40 flex-1 rounded-md bg-white/5 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600"
            />
            <button
              type="button"
              onClick={() => void addLink()}
              disabled={!link || !!busy}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-neutral-950 hover:brightness-110 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {busy && <p className="mb-2 text-xs text-accent">{busy}</p>}
          {note && <p className="mb-2 text-xs text-red-400">{note}</p>}
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {library.map(t => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.artist} · {t.year}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addTrack(t.id)}
                  className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-neutral-950 hover:brightness-110"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-600">
            Every browser plays the same song. Open this page on the machine wired to the saloon speakers, and tune
            its volume there.
          </p>
        </section>
      </main>

      <audio
        ref={audio}
        preload="auto"
        onLoadedMetadata={e => {
          setDuration(e.currentTarget.duration)
          sync()
        }}
        onCanPlay={sync}
        onEnded={() => playing && void skip(playing.id)}
      />
    </div>
  )
}
