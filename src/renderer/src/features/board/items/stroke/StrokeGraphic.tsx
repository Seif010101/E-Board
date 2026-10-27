import { useMemo } from 'react'
import { centerlinePath, HIGHLIGHTER_OPACITY, outlinePath, strokeDashArray, type StrokePoint, type StrokeStyle } from './path'

interface StrokeGraphicProps extends StrokeStyle {
  points: StrokePoint[]
  /** False while the stroke is still being drawn (perfect-freehand tapers the end differently). */
  complete?: boolean
  /** Extra width (world units) of an invisible hit area along the stroke; omit for no hit area. */
  hitSlop?: number
}

/**
 * The painted paths of a freehand stroke, in the coordinate space of the points.
 * Solid pen strokes are a filled pressure-sensitive outline; dashed / dotted pen strokes and
 * highlighter strokes are a smoothed centre line.
 */
export function StrokeGraphic({ tool, color, size, dash, points, complete = true, hitSlop }: StrokeGraphicProps) {
  const outline = tool === 'pen' && dash === 'solid'
  const center = useMemo(() => centerlinePath(points), [points])
  const filled = useMemo(() => (outline ? outlinePath(points, size, complete) : ''), [outline, points, size, complete])

  return (
    <>
      {hitSlop !== undefined && (
        <path
          className="stk-hit"
          d={center}
          fill="none"
          stroke="transparent"
          strokeWidth={size + hitSlop}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {outline ? (
        <path className="stk-ink" d={filled} fill={color} />
      ) : (
        <path
          className={tool === 'highlighter' ? 'stk-ink stk-ink--hl' : 'stk-ink'}
          d={center}
          fill="none"
          stroke={color}
          strokeWidth={size}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={tool === 'pen' ? strokeDashArray(dash, size) : undefined}
          strokeOpacity={tool === 'highlighter' ? HIGHLIGHTER_OPACITY : undefined}
        />
      )}
    </>
  )
}
