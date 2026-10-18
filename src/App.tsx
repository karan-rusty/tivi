import { useEffect, useRef, useState } from 'react'
import { Pause, Play, QrCode, SkipForward, Trash2, Upload, X } from 'lucide-react'
import { Artwork } from './Artwork.tsx'
import { Logo } from './Logo.tsx'
import { Spectrum } from './Spectrum.tsx'
import { useArtworkTheme } from './useArtworkTheme.ts'
import { useJukebox } from './useJukebox.ts'
import { useSpectrum } from './useSpectrum.ts'
import { VolumeSlider } from './VolumeSlider.tsx'

const read = (key: string, fallback: string) => localStorage.getItem(key) ?? fallback

type Hit = { url: string; title: string; artist: string; year: number }

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
  const [flash, setFlash] = useState('')
  const [asked, setAsked] = useState('')
  const [found, setFound] = useState<Hit[]>([])
  const [readLink, setReadLink] = useState<{ title: string; artist: string } | null>(null)
  const [joining, setJoining] = useState(false)
  const linkInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const lastLoad = useRef(0)
  const [, tick] = useState(0)

  const library = state?.library ?? []
  const playing = state?.playing ?? null
  const track = library.find(t => t.id === playing?.trackId)
  useArtworkTheme(track?.art)
  const spectrum = useSpectrum(audio)

  function gesture() {
    spectrum.ensure() // first click builds the analyser, inside the activation it needs
    spectrum.resume()
    sync()
  }
  // Position comes from the shared clock, so every screen in the saloon agrees.
  const elapsed = playing ? Math.max(0, (playing.pausedAt ?? serverNow()) - playing.startedAt) / 1000 : 0
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(''), 3000)
    return () => clearTimeout(timer)
  }, [flash])

  // Terminal-style shortcuts, taught by the hint row at the foot of the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        void togglePause()
      } else if (e.key === 'n') {
        if (playing) void skip(playing.id)
      } else if (e.key === 'm') {
        const next = !muted
        setMuted(next)
        localStorage.setItem('tivi.muted', next ? 'yes' : 'no')
      } else if (e.key === 'Escape') {
        setJoining(false)
      } else if (e.key === 'a') {
        e.preventDefault()
        linkInput.current?.focus()
      } else if (e.key === 'u') {
        e.preventDefault()
        fileInput.current?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function sync() {
    const el = audio.current
    if (!el) return
    if (!playing || !track) return el.pause()
    if (!el.currentSrc.endsWith(track.src)) {
      el.src = track.src
      el.load()
      lastLoad.current = Date.now()
    } else if (el.readyState === 0 && Date.now() - lastLoad.current > 4000) {
      // A load that never completed (dropped request, suspended tab) would leave this tab silent
      // for good, because the src already matches and nothing would ever retry it.
      el.load()
      lastLoad.current = Date.now()
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
    if (el.paused) void el.play().catch(() => { })
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

  /** An explicit archive.org item: cache the audio, then put it on the line. */
  async function addLink(url = link) {
    setNote('')
    setFlash('')
    setBusy('fetching the recording…')
    const res = await fetch('/api/library/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const out: { id?: string; error?: string } = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) return setNote(out.error ?? 'could not add that')
    setLink('')
    setFound([])
    setAsked('')
    if (out.id) {
      addTrack(out.id)
      setFlash('queued — it is on the line')
    }
  }

  /**
   * One box, three answers. An archive.org link is exact, so it goes straight in. Anything else
   * that looks like a link is read for its title first, because a YouTube or Spotify link cannot
   * be played here — but the song it names might exist in the public-domain catalogue. Plain text
   * is simply searched.
   */
  async function look() {
    const value = link.trim()
    if (!value) return
    if (/^https?:\/\/(?:www\.)?archive\.org\//i.test(value)) return addLink(value)
    setNote('')
    setFlash('')
    setBusy('looking it up…')
    const res = await fetch('/api/inspect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    const out: {
      link?: { title: string; artist: string } | null
      query?: string
      results?: Hit[]
      error?: string
    } = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) return setNote(out.error ?? 'could not look that up')
    setReadLink(out.link ?? null)
    setAsked(out.query ?? value)
    setFound(out.results ?? [])
  }

  return (
    <div
      className="relative isolate min-h-dvh font-mono text-neutral-100 split:flex split:h-dvh split:flex-col split:overflow-hidden"
      onPointerDownCapture={gesture}
      onKeyDownCapture={gesture}
    >
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
        className={`mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 p-3 split:min-h-0 split:flex-1 split:grid-cols-[minmax(0,1fr)_18rem] split:grid-rows-[auto_minmax(0,1fr)] split:gap-6 split:p-4 lg:grid-cols-[minmax(0,1fr)_22rem]`}
      >
        <section className="flex min-h-0 flex-col gap-3 split:row-span-2">
          <div className="top-row flex items-baseline justify-between">
            <Logo />
            <span className="text-[11px] uppercase tracking-[0.2em] text-accent/80">Now playing</span>
          </div>
          <p className="standalone-label text-[11px] uppercase tracking-[0.2em] text-accent/80">Now playing</p>
          <div className="flex min-h-0 flex-1 items-stretch gap-4 split:gap-6">
            <div className="gutter flex-col items-center justify-center gap-6">
              <Logo vertical />
              <VolumeSlider
                value={volume}
                muted={muted}
                level={spectrum.level}
                armed={spectrum.online}
                onChange={next => {
                  setVolume(next)
                  localStorage.setItem('tivi.volume', String(next))
                }}
                onToggleMute={() => {
                  const next = !muted
                  setMuted(next)
                  localStorage.setItem('tivi.muted', next ? 'yes' : 'no')
                }}
              />
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center split:[container-type:size]">
              <Artwork track={track} />
            </div>
          </div>
          <h2 className="truncate text-xl font-semibold">{track?.title ?? 'Nothing on the turntable'}</h2>
          <p className="text-sm text-neutral-400">
            {track ? `${track.artist} ◆ ${track.year}` : 'Add a tune below to start the night'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-3">
            <span className="tabular text-xs text-neutral-500">{clock(elapsed)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full bg-accent transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="tabular text-xs text-neutral-500">{duration > 0 ? clock(duration) : '--:--'}</span>
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
            <span className="tabular ml-auto hidden text-[11px] text-neutral-600 sm:inline" title="output sample rate">
              {spectrum.sampleRate() ? `SR ${(spectrum.sampleRate() / 1000).toFixed(1)}kHz` : 'SR --'}
            </span>
            <VolumeSlider
              orientation="horizontal"
              className="inline-fader"
              value={volume}
              muted={muted}
              level={spectrum.level}
              armed={spectrum.online}
              onChange={next => {
                setVolume(next)
                localStorage.setItem('tivi.volume', String(next))
              }}
              onToggleMute={() => {
                const next = !muted
                setMuted(next)
                localStorage.setItem('tivi.muted', next ? 'yes' : 'no')
              }}
            />
          </div>
          <div className="hide-short">
            <Spectrum analyser={spectrum.analyser} online={spectrum.online} />
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
                      <span className="text-neutral-600"> ◆ {t?.artist}</span>
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
            <div className="flex items-center gap-3">
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
              <button
                type="button"
                onClick={() => setJoining(true)}
                className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20"
              >
                <QrCode size={13} /> Join
              </button>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20">
              <Upload size={13} /> Add from this device
              <input
                ref={fileInput}
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
              ref={linkInput}
              value={link}
              placeholder="a song name, or a link from anywhere"
              onChange={e => setLink(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void look()}
              className="min-w-40 flex-1 rounded-md bg-white/5 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600"
            />
            <button
              type="button"
              onClick={() => void look()}
              disabled={!link.trim() || !!busy}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-neutral-950 hover:brightness-110 disabled:opacity-40"
            >
              Find
            </button>
          </div>
          {busy && <p className="mb-2 text-xs text-accent">{busy}</p>}
          {note && <p className="mb-2 text-xs text-red-400">{note}</p>}
          {flash && <p className="mb-2 text-xs text-accent">{flash}</p>}
          {found.length > 0 && (
            <ul className="mb-2 overflow-hidden rounded-lg bg-white/5">
              {found.map(hit => (
                <li key={hit.url}>
                  <button
                    type="button"
                    onClick={() => void addLink(hit.url)}
                    className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-xs hover:bg-white/10"
                  >
                    <span className="w-3 shrink-0 text-accent">+</span>
                    <span className="min-w-0 flex-1 truncate text-neutral-200">{hit.title}</span>
                    <span className="max-w-32 truncate text-neutral-500">{hit.artist}</span>
                    <span className="tabular shrink-0 text-neutral-600">{hit.year || ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {asked && !busy && found.length === 0 && (
            <p className="mb-2 text-xs text-neutral-500">
              nothing playable for “{asked}”
              {readLink
                ? ` — that link is “${readLink.title}”, and links from YouTube or Spotify cannot be streamed here. Only public-domain recordings can, so try the artist instead.`
                : ' — try fewer words, or the artist.'}
            </p>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {library.map(t => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.artist} ◆ {t.year}
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
          <p className="mt-3 text-[11px] text-neutral-500">
            <span className="text-neutral-600">[space]</span> play/pause ◆ <span className="text-neutral-600">[n]</span>{' '}
            skip ◆ <span className="text-neutral-600">[m]</span> mute ◆ <span className="text-neutral-600">[a]</span>{' '}
            link ◆ <span className="text-neutral-600">[u]</span> upload
          </p>
          <p className="mt-1 text-[11px] text-neutral-700">
            volume is per device — turn it up on the machine wired to the speakers
          </p>
        </section>
      </main>

      {/* Hidden until asked for: the QR is for the room, not for whoever is reading the panel. */}
      {joining && state && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Join this jukebox"
          onClick={() => setJoining(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/95 p-5"
          >
            <button
              type="button"
              autoFocus
              onClick={() => setJoining(false)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-accent"
            >
              <X size={15} />
            </button>
            {/* The card is the light field, so it takes the record's accent; the modules stay
                black, because that is the part a scanner reads. */}
            <img
              src="/qr.svg"
              alt=""
              className="h-64 w-64 rounded-xl border border-accent/40 bg-white p-3"
              style={{ background: 'color-mix(in oklab, var(--accent, #f59e0b) 40%, white)' }}
            />
            <p className="font-mono text-sm text-accent">{state.joinUrl}</p>
            <p className="text-xs text-neutral-500">Scan on a phone to add music from it</p>
          </div>
        </div>
      )}

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
