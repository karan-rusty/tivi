import type { Track } from '../shared/types.ts'

/**
 * The record on the turntable, at the size of a real sleeve. Falls back to a stand-in built from
 * the track's title when there is no scan — an upload off someone's phone, say.
 */
export function Artwork({ track }: { track?: Track }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
      {track?.art ? (
        <img src={track.art} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: 'radial-gradient(120% 120% at 25% 10%, var(--tint, #262626), #0a0a0a)' }}
        >
          <span className="font-display text-7xl text-neutral-600">{track ? track.title.slice(0, 2) : 'tivi'}</span>
        </div>
      )}
    </div>
  )
}
