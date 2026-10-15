import { useEffect } from 'react'
import { FastAverageColor } from 'fast-average-color'

const fac = new FastAverageColor()

/**
 * The current track's cover decides the accent colour of the whole page, the way a jukebox
 * lights up to match the record it is playing. Falls back to amber when a track has no art.
 */
export function useArtworkTheme(art?: string) {
  useEffect(() => {
    const root = document.documentElement.style
    if (!art) {
      root.removeProperty('--accent')
      root.removeProperty('--tint')
      return
    }
    let alive = true
    const img = new Image()
    img.onload = () => {
      if (!alive) return
      try {
        const dominant = fac.getColor(img, { algorithm: 'dominant' }).value.slice(0, 3)
        const average = fac.getColor(img).value.slice(0, 3)
        // A dark cover would vanish against the near-black page, so lift it toward white.
        const lum = (0.2126 * dominant[0] + 0.7152 * dominant[1] + 0.0722 * dominant[2]) / 255
        const accent = lum < 0.42 ? dominant.map(c => Math.round(c + (255 - c) * 0.45)) : dominant
        root.setProperty('--accent', `rgb(${accent.join(' ')})`)
        root.setProperty('--tint', `rgb(${average.join(' ')} / 0.16)`)
      } catch {
        root.removeProperty('--accent')
        root.removeProperty('--tint')
      }
    }
    img.src = art
    return () => {
      alive = false
    }
  }, [art])
}
