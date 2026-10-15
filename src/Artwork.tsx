import { useEffect, useState } from 'react'
import { ImageIcon, ScanLine } from 'lucide-react'
import type { Track } from '../shared/types.ts'

const RAMP = ' .:-=+*#%@'
const COLS = 64

/** Renders the cover as a grid of characters, each keeping the colour of the pixel it stands for. */
function useAscii(art: string | undefined, on: boolean) {
  const [lines, setLines] = useState<{ ch: string; rgb: string }[][] | null>(null)
  useEffect(() => {
    if (!art || !on) return
    let alive = true
    const img = new Image()
    img.onload = () => {
      const cols = COLS
      const rows = Math.max(1, Math.round((img.height / img.width) * cols * 0.5)) // cells are twice as tall as wide
      const canvas = document.createElement('canvas')
      canvas.width = cols
      canvas.height = rows
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx || !alive) return
      ctx.drawImage(img, 0, 0, cols, rows)
      const px = ctx.getImageData(0, 0, cols, rows).data
      const out: { ch: string; rgb: string }[][] = []
      for (let y = 0; y < rows; y++) {
        const line: { ch: string; rgb: string }[] = []
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          const luma = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
          line.push({ ch: RAMP[Math.round(luma * (RAMP.length - 1))], rgb: `${px[i]},${px[i + 1]},${px[i + 2]}` })
        }
        out.push(line)
      }
      if (alive) setLines(out)
    }
    img.src = art
    return () => {
      alive = false
    }
  }, [art, on])
  return lines
}

/**
 * The record on the turntable, at the size of a real sleeve. Falls back to a stand-in built from
 * the track's title when there is no scan — an upload off someone's phone, say.
 */
export function Artwork({ track }: { track?: Track }) {
  const [ascii, setAscii] = useState(false)
  const lines = useAscii(track?.art, ascii)

  return (
    <div className="@container relative aspect-square w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
      {ascii && lines ? (
        <pre className="flex h-full w-full flex-col items-center justify-center overflow-hidden font-mono leading-[1.02] text-[2.6cqw]">
          {lines.map((line, y) => (
            <span key={y}>
              {line.map((c, x) => (
                <span key={x} style={{ color: `rgb(${c.rgb})` }}>
                  {c.ch}
                </span>
              ))}
            </span>
          ))}
        </pre>
      ) : track?.art ? (
        <img src={track.art} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: 'radial-gradient(120% 120% at 25% 10%, var(--tint, #262626), #0a0a0a)' }}
        >
          <span className="font-display text-7xl text-neutral-600">{track ? track.title.slice(0, 2) : 'tivi'}</span>
        </div>
      )}

      {track?.art && (
        <button
          type="button"
          onClick={() => setAscii(a => !a)}
          aria-pressed={ascii}
          aria-label={ascii ? 'Show the photo' : 'Show as colour ASCII'}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md border border-neutral-700/70 bg-neutral-950/70 px-2 py-1 text-[11px] font-medium text-neutral-300 backdrop-blur hover:text-accent"
        >
          {ascii ? <ImageIcon size={13} /> : <ScanLine size={13} />}
          {ascii ? 'Photo' : 'ASCII'}
        </button>
      )}
    </div>
  )
}
