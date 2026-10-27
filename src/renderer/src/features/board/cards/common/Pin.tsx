import type { CSSProperties } from 'react'

interface PinProps {
  /** Overrides the theme pin colour (used by the normal theme for entity accents). */
  color?: string
}

/**
 * Push pin centred on the thread anchor (top centre, 12px below the card top, see anchor.ts).
 * Detective: glossy plastic push pin with a cast shadow; hacker: glowing node; normal: coloured dot.
 */
export function Pin({ color }: PinProps) {
  const style = color ? ({ '--cd-pin': color } as CSSProperties) : undefined
  return (
    <span className="cd-pin" aria-hidden="true" style={style}>
      <span className="cd-pin__head" />
    </span>
  )
}
