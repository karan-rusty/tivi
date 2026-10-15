import { useCallback, useRef, useState } from 'react'

export const BARS = 48

/**
 * Taps this device's own output for a spectrum, the way cava taps a sound card.
 *
 * Built on the first user gesture, never before: an AudioContext created without one starts
 * suspended, and audio routed through a suspended graph is silent — which would kill the room's
 * sound to draw a picture of it. Until `ensure()` runs, the element plays on its own path and this
 * hook is inert.
 */
export function useSpectrum(audio: React.RefObject<HTMLAudioElement | null>) {
  const analyser = useRef<AnalyserNode | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const [online, setOnline] = useState(false)

  const ensure = useCallback(() => {
    const el = audio.current
    if (!el || analyser.current) return
    try {
      const context = new AudioContext()
      const source = context.createMediaElementSource(el)
      const node = context.createAnalyser()
      node.fftSize = 2048
      node.smoothingTimeConstant = 0.72
      node.minDecibels = -85
      node.maxDecibels = -12
      source.connect(node)
      node.connect(context.destination) // the sound still has to come out
      void context.resume()
      ctx.current = context
      analyser.current = node
      setOnline(true)
    } catch {
      setOnline(false) // no visualiser is better than no audio
    }
  }, [audio])

  /** Call from any gesture: a context can drift back to suspended (backgrounded tab, OS sleep). */
  const resume = useCallback(() => {
    if (ctx.current?.state === 'suspended') void ctx.current.resume()
  }, [])

  const sampleRate = () => ctx.current?.sampleRate ?? 0
  const buffer = useRef<Uint8Array<ArrayBuffer> | null>(null)

  return {
    ensure,
    resume,
    analyser,
    online,
    sampleRate,
    /** Mean energy right now, 0..1 — what the level meter moves to. */
    level: () => {
      const node = analyser.current
      if (!node) return 0
      if (!buffer.current || buffer.current.length !== node.frequencyBinCount) {
        buffer.current = new Uint8Array(node.frequencyBinCount)
      }
      node.getByteFrequencyData(buffer.current)
      let sum = 0
      for (const byte of buffer.current) sum += byte
      return sum / (buffer.current.length * 255)
    },
  }
}
