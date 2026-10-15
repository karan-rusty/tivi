import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Trash2, Volume2, VolumeX } from 'lucide-react'
import { TRACKS } from '../shared/tracks.ts'
import { useJukebox } from './useJukebox.ts'

const read = (key: string, fallback: string) => localStorage.getItem(key) ?? fallback

export default function App() {
  const { state, serverNow, add, skip, togglePause, remove } = useJukebox()
  const audio = useRef<HTMLAudioElement>(null)
  const [volume, setVolume] = useState(() => Number(read('jukebox.volume', '0.8')))
  const [muted, setMuted] = useState(() => read('jukebox.muted', 'no') === 'yes')
  const [name, setName] = useState(() => read('jukebox.name', ''))
  const [duration, setDuration] = useState(0)
  const [sound, setSound] = useState(false) // has this tab managed to start playing
  const [, tick] = useState(0)

  const playing = state?.playing ?? null
  const track = TRACKS.find(t => t.id === playing?.trackId)
  // Position comes from the shared clock, so every screen in the saloon agrees.
  const elapsed = playing ? Math.max(0, (playing.pausedAt ?? serverNow()) - playing.startedAt) / 1000 : 0
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0

  function sync() {
    const el = audio.current
    if (!el) return
    if (!playing || !track) return el.pause()
    const url = `/tracks/${track.file}`
    if (!el.currentSrc.endsWith(url)) {
      el.src = url
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
        <h1 className="text-lg font-semibold tracking-tight">🥃 Dustline Jukebox</h1>
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
                  localStorage.setItem('jukebox.muted', next ? 'yes' : 'no')
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
                  localStorage.setItem('jukebox.volume', e.target.value)
                }}
                className="w-24 accent-amber-500"
              />
            </div>
          </div>
        </section>
