import type { ItemComponentProps } from '../../core/registry'
import { StrokeGraphic } from './StrokeGraphic'
import './stroke.css'

/** Screen px added around thin strokes so they stay easy to click. */
const HIT_SLOP_PX = 10

export function StrokeItem({ item, zoom }: ItemComponentProps<'stroke'>) {
  const { tool, color, size, dash, points } = item.data
  return (
    <svg
      className={`stk stk--${tool}`}
      width={item.w}
      height={item.h}
      viewBox={`0 0 ${item.w} ${item.h}`}
      aria-hidden="true"
    >
      <StrokeGraphic
        tool={tool}
        color={color}
        size={size}
        dash={dash}
        points={points}
        hitSlop={HIT_SLOP_PX / Math.max(zoom, 0.1)}
      />
    </svg>
  )
}
