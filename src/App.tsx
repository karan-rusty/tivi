import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Trash2, Volume2, VolumeX } from 'lucide-react'
import { useJukebox } from './useJukebox.ts'

const read = (key: string, fallback: string) => localStorage.getItem(key) ?? fallback

export default function App() {
  const { state, serverNow, add, skip, togglePause, remove } = useJukebox()
  const audio = useRef<HTMLAudioElement>(null)
  const [volume, setVolume] = useState(() => Number(read('tivi.volume', '0.8')))
  const [muted, setMuted] = useState(() => read('tivi.muted', 'no') === 'yes')
  const [name, setName] = useState(() => read('tivi.name', ''))
  const [duration, setDuration] = useState(0)
  const [sound, setSound] = useState(false) // has this tab managed to start playing
  const [, tick] = useState(0)

  const library = state?.library ?? []
  const playing = state?.playing ?? null
  const track = library.find(t => t.id === playing?.trackId)
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
    if (el.paused) void el.play().then(() => setSound(true)).catch(() => setSound(false))
  }

  useEffect(sync) // runs after every render: the server state is the only source of truth
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const addTrack = (trackId: string) => {
    setSound(true) // the click is the gesture that unblocks audio for this tab
    void add(trackId, name)
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="flex items-baseline justify-between gap-4 border-b border-neutral-800 px-4 py-3">
        <h1 className="font-display text-2xl leading-none">tivi</h1>
        <p className="text-xs text-neutral-500">
          {state ? `${state.queue.length} in line` : 'connecting…'}
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/80">Now playing</p>
          <h2 className="mt-1 truncate text-xl font-semibold">{track?.title ?? 'Nothing on the turntable'}</h2>
          <p className="text-sm text-neutral-400">
            {track ? `${track.artist} · ${track.year}` : 'Add a tune below to start the night'}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
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
                className="w-24 accent-amber-500"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium text-neutral-400">Up next</h3>
          {state?.queue.length ? (
            <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
              {state.queue.map((item, i) => {
                const t = library.find(x => x.id === item.trackId)
                return (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2">
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
            <p className="rounded-xl border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-600">
              The line is empty.
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
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
                className="w-32 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
            </label>
          </div>
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {library.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.artist} · {t.year}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addTrack(t.id)}
                  className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-amber-400"
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

      {playing && !sound && (
        <div className="fixed inset-x-0 bottom-0 border-t border-amber-500/30 bg-neutral-900/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setSound(true)
              sync()
            }}
            className="mx-auto flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400"
          >
            <Volume2 size={16} /> Tap to turn on the speakers
          </button>
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
