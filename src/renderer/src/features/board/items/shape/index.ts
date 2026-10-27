// Shapes: rectangles, ellipses, triangles, diamonds (with an optional label), lines and arrows.

import { registerItem } from '../../core/registry'
import { board } from '../../core/store'
import { isLineKind, shapeAnchor, shapeHit } from './geometry'
import { ShapeItem } from './ShapeItem'
import { ShapeInspector } from './ShapeInspector'

registerItem({
  type: 'shape',
  Component: ShapeItem,
  resize: 'free',
  minSize: { w: 8, h: 8 },
  passThrough: true,
  pinAnchor: shapeAnchor,
  hitTest: shapeHit,
  Inspector: ShapeInspector,
  onDoubleClick: (item) => {
    // Lines have no label: their details open instead.
    if (item.locked || isLineKind(item.data.shape)) board().openInspector({ kind: 'item', id: item.id })
    else board().setEditing(item.id)
  },
  searchText: (item) => item.data.text
})
