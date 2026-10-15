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

