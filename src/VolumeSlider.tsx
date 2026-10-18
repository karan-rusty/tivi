import { useCallback, useEffect, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

const SEGMENTS = 24
const HANDLE = 16

export function VolumeSlider({
  value,
  muted,
  onChange,
  onToggleMute,
  level,
  armed,
  orientation = 'vertical',
  className = '',
}: {
  value: number
  muted: boolean
  onChange: (value: number) => void
  onToggleMute: () => void
  level: () => number
  armed: boolean
  orientation?: 'vertical' | 'horizontal'
  className?: string
}) {
  const rail = useRef<HTMLDivElement>(null)
  const segments = useRef<(HTMLSpanElement | null)[]>([])
  const pct = Math.round(value * 100)
  const horizontal = orientation === 'horizontal'

  useEffect(() => {
    if (!armed) return
    let raf = 0
    let shown = 0
    let ceiling = 0.35
    let last = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 33) return
      last = now
      const raw = level()
      ceiling = Math.max(raw, ceiling * 0.996, 0.22)
      const want = muted ? 0 : Math.max(0, Math.min(1, raw / ceiling))
      // meter ballistics: snap up, ease down
      shown += (want - shown) * (want > shown ? 0.5 : 0.16)
      const lit = Math.round(shown * segments.current.length)
      segments.current.forEach((el, i) => {
        if (!el) return
        const on = i < lit ? '1' : '0'
        if (el.dataset.on === on) return
        el.dataset.on = on
        el.style.backgroundColor = on === '1' ? 'var(--accent, #f59e0b)' : 'rgba(255,255,255,0.10)'
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [armed, level, muted])

  const setFromPointer = useCallback(
    (client: number) => {
      const el = rail.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const t = horizontal ? (client - box.left) / box.width : 1 - (client - box.top) / box.height
      onChange(Math.min(1, Math.max(0, t)))

    },
    [onChange, horizontal],
  )

  const nudge = (delta: number) => onChange(Math.min(1, Math.max(0, value + delta)))

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05
          : e.key === 'PageUp' ? 0.1
            : e.key === 'PageDown' ? -0.1
              : 0
    if (step) {
      e.preventDefault()
      nudge(step)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      onChange(e.key === 'Home' ? 0 : 1)
    }
  }

  const sliderProps = {
    role: 'slider' as const,
    tabIndex: 0,
    'aria-label': 'Volume',
    'aria-orientation': horizontal ? ('horizontal' as const) : ('vertical' as const),
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': pct,
    'aria-valuetext': muted ? 'muted' : `${pct}%`,
    onKeyDown,
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setFromPointer(horizontal ? e.clientX : e.clientY)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.buttons === 1) setFromPointer(horizontal ? e.clientX : e.clientY)
    },
  }

  const muteButton = (
    <button
      type="button"
      onClick={onToggleMute}
      aria-label={muted ? 'Unmute' : 'Mute'}
      className='shrink-0 rounded-lg border border-white/10 p-2 text-neutral-400 hover:bg-white/5 hover:text-accent'
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </button>
  )

  const readout = (
    <span
      className={`tabular w-10 shrink-0 text-[11px] tracking-[0.15em] ${muted ? 'text-neutral-600' : 'text-accent'}`}
    >
      {muted ? 'MUTE' : `${String(pct).padStart(3, '0')}%`}
    </span>
  )

  if (horizontal) {
    return (
      <div className={`flex min-w-0 flex-1 select-none items-center gap-2 ${className}`}>
        {muteButton}
        <div ref={rail}
          {...sliderProps}
          className="relative h-9 min-w-0 flex-1 cursor-ew-resize touch-none rounded-full border border-white/10 bg-black/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] outline-none focus-visible:ring-1 focus-visible:ring-accent"
          // The rungs of the meter, kept as texture so the pill reads as a fader and not a scrollbar.
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 6px)',
          }}
        >
          <span className='absolute bottom-2 left-3 right-3 top-2 rounded-full bg-white/5' />
          <span className='absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/15 bg-neutral-800 shadow-lg'
            style={{ left: `calc(${value} * 100%)` }}
          >
            <span className='absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-accent' />
          </span>

        </div>
        {readout}
      </div>
    )
  }

  return (
    <div className="flex shrink-0 select-none flex-col items-center gap-2">
      <div className={`flex h-48 items-stretch gap-2 ${className}`}>
        <div className="flex flex-col-reverse justify-between py-0.5" aria-hidden>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              ref={el => {
                segments.current[i] = el
              }}
              className="h-1.5 w-7 rounded-[2px] bg-white/10"
            />
          ))}
        </div>
        <div
          ref={rail}
          {...sliderProps}
          className="relative w-9 cursor-ns-resize touch-none rounded-full border border-white/10 bg-black/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <span className="absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-white/10" />
          <span
            className="absolute left-1/2 h-4 w-8 -translate-x-1/2 rounded-md border border-white/15 bg-neutral-800 shadow-lg"
            style={{ bottom: `calc(${value} * (100% - ${HANDLE}px))` }}
          >
            <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-accent" />
          </span>
        </div>
      </div>
      {readout}
      {muteButton}
    </div>
  )
}

