import type { LineStyle } from '@shared/types'

const DASH: Record<LineStyle, string | undefined> = { solid: undefined, dashed: '5 4', dotted: '0.1 4' }

/** Tiny sample of a line style for pickers. */
export function LineStyleIcon({ style }: { style: LineStyle }) {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true" className="sc-linestyle">
      <line x1="3" y1="7" x2="23" y2="7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray={DASH[style]} />
    </svg>
  )
}

export const LINE_STYLES: readonly LineStyle[] = ['solid', 'dashed', 'dotted']
