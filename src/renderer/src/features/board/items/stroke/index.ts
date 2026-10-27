// Freehand strokes drawn with the pen and highlighter tools.

import { registerItem } from '../../core/registry'
import { strokeNear } from './path'
import { StrokeItem } from './StrokeItem'
import { StrokeInspector } from './StrokeInspector'

registerItem({
  type: 'stroke',
  Component: StrokeItem,
  resize: 'none',
  minSize: { w: 1, h: 1 },
  passThrough: true,
  hitTest: (item, p, radius) =>
    strokeNear(item.data.points, { x: p.x - item.x, y: p.y - item.y }, radius + item.data.size / 2),
  Inspector: StrokeInspector
})
