import { useEffect, useRef } from 'react'

const DOT = 3
const PITCH = 5
const DECAY = 0.016
const LOW_HZ = 40
const HIGH_HZ = 16000
const TOP_SHARE = 0.72 // cava's silhouette leans upward, with a shorter reflection below the centre

function accentColour() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || 'rgb(245 158 11)'
}

/**
 * cava's bar graph: thin columns of dots, mirrored around the centre line, in the record's colour.
 * The baseline and the peak caps are always drawn, so the meter is visible before anything plays
 * and before the first gesture has armed the analyser.
 */
export function Spectrum({ analyser, online }: { analyser: React.RefObject<AnalyserNode | null>; online: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const box = el.getBoundingClientRect()
      el.width = Math.max(1, Math.round(box.width * dpr))
      el.height = Math.max(1, Math.round(box.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    let raf = 0
    let frame = 0
    let colour = accentColour()
    let node: AnalyserNode | null = null
    let bins = new Uint8Array(1024)
    let bars = 0
    let ofBar = new Uint8Array(0)
    let levels = new Float32Array(0)
    let peaks = new Float32Array(0)
    let history = new Float32Array(0)

    // Columns depend on width and the FFT depends on the analyser, so this is rebuilt whenever
    // either changes — including the first frame after the gesture brings the analyser up.
    const remap = (width: number) => {
      const next = Math.max(16, Math.min(160, Math.floor(width / PITCH)))
      if (next === bars && ofBar.length === bins.length) return
      bars = next
      levels = new Float32Array(bars)
      peaks = new Float32Array(bars)
      history = new Float32Array(bars)
      ofBar = new Uint8Array(bins.length)
      const rate = node?.context.sampleRate ?? 44100
      const binHz = rate / (node?.fftSize ?? 2048)
      for (let i = 0; i < ofBar.length; i++) {
        const t = Math.log(Math.max(i * binHz, LOW_HZ) / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ)
        ofBar[i] = Math.min(bars - 1, Math.max(0, Math.floor(t * bars)))
      }
    }

    const db = (byte: number) => (node ? node.minDecibels + (byte / 255) * (node.maxDecibels - node.minDecibels) : -60)

    const draw = () => {
      if (analyser.current !== node) {
        node = analyser.current
        bins = new Uint8Array(node?.frequencyBinCount ?? 1024)
        bars = 0 // force a remap against the new FFT size
      }
      const w = el.clientWidth
      const h = el.clientHeight
      // The backing store is dpr-scaled: without this the meter only covers 1/dpr of its own width.
      const dpr = el.width / Math.max(1, w)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      remap(w)
      const rows = Math.max(4, Math.floor(h / PITCH))
      const top = Math.round(rows * TOP_SHARE)
      const bottom = rows - top

      if (node) node.getByteFrequencyData(bins)
      else bins.fill(0)
      levels.fill(0)
      let loudest = 0
      for (let i = 0; i < bins.length; i++) {
        const value = (db(bins[i]) + 60) / 60 // -60 dB is the floor
        const bar = ofBar[i]
        if (value > levels[bar]) levels[bar] = value
        if (value > loudest) loudest = value
      }

      // Each column is scaled by its own recent peak rather than one global gain. A 1922 acoustic
      // 78 sits between 200Hz and 1.5kHz, so on a fixed scale four fifths of the width does
      // nothing and the rest barely lifts; this makes the whole bar work, and the floor stops
      // noise from amplifying itself when the room is quiet.
      const silent = loudest < 0.06

      if (frame % 24 === 0) colour = accentColour()
      frame++
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = colour

      for (let b = 0; b < bars; b++) {
        history[b] = Math.max(levels[b], history[b] * 0.97, 0.16)
        const level = silent ? 0 : Math.min(1, Math.pow(levels[b] / history[b], 0.8))
        peaks[b] = Math.max(level, peaks[b] - DECAY)
        const x = b * PITCH
        const up = Math.round(level * top)
        const down = Math.round(level * bottom)
        const cap = Math.min(top - 1, Math.round(peaks[b] * top))

        // the baseline is always there, so the meter reads as a meter when nothing is playing
        ctx.globalAlpha = 0.22
        ctx.fillRect(x, top * PITCH, DOT, DOT)

        for (let r = 1; r < down; r++) {
          ctx.globalAlpha = 0.25 + (0.35 * (down - r)) / Math.max(1, down)
          ctx.fillRect(x, top * PITCH + r * PITCH, DOT, DOT)
        }
        for (let r = 0; r < up; r++) {
          ctx.globalAlpha = 0.4 + (0.6 * r) / top
          ctx.fillRect(x, top * PITCH - (r + 1) * PITCH, DOT, DOT)
        }
        if (peaks[b] > 0.02) {
          ctx.globalAlpha = 0.95
          ctx.fillRect(x, top * PITCH - (cap + 1) * PITCH, DOT, DOT)
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [analyser])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[10px] tracking-[0.2em] text-neutral-600">
        <span>spectrum</span>
        <span className={online ? 'text-neutral-500' : 'text-accent/70'}>
          {online ? 'live ◆ 40Hz–16kHz' : 'standby ◆ click anywhere'}
        </span>
      </div>
      <canvas ref={canvas} aria-hidden className="h-24 w-full [image-rendering:pixelated]" />
    </div>
  )
}
