const SPEC = 'font-mono text-[9px] lowercase leading-none tracking-[0.3em] text-accent/70'
/* Rotated so the name reads up the gutter, the way a rack label does. */
const VERTICAL = { writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)' }

export function Logo({ vertical = false }: { vertical?: boolean }) {
  const word = (
    // One grid cell, twice: the accent pass is in flow, so DOM order alone puts the white on top.
    <span
      className="relative grid font-mono text-xl leading-none tracking-[0.4em] text-neutral-100"
      style={vertical ? VERTICAL : undefined}
    >
      {/* The rotated frame turns the step around, so its sign flips to land the same way on screen.
          Held back to 60%: at this size a full-strength pass eats the white and the name stops reading. */}
      <span aria-hidden className="col-start-1 row-start-1 text-accent/60" style={{ transform: vertical ? 'translate(-2px, -2px)' : 'translate(2px, 2px)' }}>
        tivi
      </span>
      <span className="col-start-1 row-start-1">tivi</span>
    </span>
  )
  const spec = <span className={SPEC} style={vertical ? VERTICAL : undefined}>78 rpm</span>
  return vertical ? (
    <div className="flex flex-row items-center gap-3">
      {word}
      <span className="w-px self-stretch bg-accent/70" />
      {spec}
    </div>
  ) : (
    <div className="flex flex-col gap-1.5">
      {word}
      <div className="flex items-center gap-2">
        <span className="h-px w-6 bg-accent/70" />
        {spec}
      </div>
    </div>
  )
}
