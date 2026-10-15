import { useEffect } from 'react'
import { Vibrant } from 'node-vibrant/browser'

/**
 * The current track's cover decides the accent colour of the whole page, the way a jukebox lights
 * up to match the record it is playing. Label scans are mostly paper and black shellac, so an
 * average is always grey — this takes a *vibrant* swatch instead. Falls back to amber with no art.
 */
export function useArtworkTheme(art?: string) {
  useEffect(() => {
    const style = document.documentElement.style
    const clear = () => {
      style.removeProperty('--accent')
      style.removeProperty('--tint')
    }
    if (!art) return clear()
    let alive = true
    Vibrant.from(art)
      .getPalette()
      .then(palette => {
        if (!alive) return
        const swatch = palette.Vibrant ?? palette.LightVibrant ?? palette.DarkVibrant ?? palette.Muted
        const tint = palette.DarkMuted ?? palette.Muted ?? swatch
        if (!swatch) return clear()
        const [r, g, b] = swatch.rgb
        // A dark cover would vanish against the near-black page, so lift it toward white.
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        const accent = lum < 0.42 ? [r, g, b].map(c => Math.round(c + (255 - c) * 0.45)) : [r, g, b]
        style.setProperty('--accent', `rgb(${accent.join(' ')})`)
        if (tint) style.setProperty('--tint', `rgb(${tint.rgb.join(' ')} / 0.16)`)
      })
      .catch(clear)
    return () => {
      alive = false
    }
  }, [art])
}
