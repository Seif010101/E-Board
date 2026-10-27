// Shape tool: drag out a shape (Shift: square / circle, or 45° steps for lines); a click drops the
// default size. The new shape is selected and the select tool comes back.

import { create } from 'zustand'
import type { ShapeData } from '@shared/types'
import type { BoardPointer, ToolHandler } from '../../core/registry'
import { board } from '../../core/store'
import { createShape, DEFAULT_SIZES } from '../../core/factories'
import type { Point, Rect } from '../../core/types'
import { isLineKind, lineBox, roundCoord, snapAngle } from '../../items/shape/geometry'
import { ShapeGraphic } from '../../items/shape/ShapeGraphic'
import './shape.css'

/** Below this drag distance (screen px) the gesture counts as a click. */
const CLICK_PX = 8
/** Smallest side of a dragged closed shape (world units). */
const MIN_SIDE = 8
const DEFAULT_LINE_LENGTH = 160

type ShapeStyle = Pick<ShapeData, 'shape' | 'stroke' | 'fill' | 'strokeWidth' | 'dash'>

interface Draft extends Rect {
  data: ShapeStyle & Pick<ShapeData, 'points'>
}

const useDraft = create<{ draft: Draft | null }>(() => ({ draft: null }))

interface Gesture {
  pointerId: number
  start: Point
  startScreen: Point
  style: ShapeStyle
  dragged: boolean
}

let gesture: Gesture | null = null

function styleNow(): ShapeStyle {
  const o = board().toolOptions.shape
  return { shape: o.kind, stroke: o.stroke, fill: isLineKind(o.kind) ? 'none' : o.fill, strokeWidth: o.strokeWidth, dash: o.dash }
}

/** Geometry of the shape for the current pointer, or the default size for a click. */
function shapeFor(g: Gesture, end: Point, shift: boolean, click: boolean): Draft {
  const { style } = g
  if (isLineKind(style.shape)) {
    const half = DEFAULT_LINE_LENGTH / 2
    const [a, b] = click
      ? [
          { x: g.start.x - half, y: g.start.y },
          { x: g.start.x + half, y: g.start.y }
        ]
      : [g.start, shift ? snapAngle(g.start, end) : end]
    const box = lineBox(a, b, style.strokeWidth)
    return { x: box.x, y: box.y, w: box.w, h: box.h, data: { ...style, points: box.points } }
  }
  if (click) {
    const { w, h } = DEFAULT_SIZES.shape
    return { x: roundCoord(g.start.x - w / 2), y: roundCoord(g.start.y - h / 2), w, h, data: { ...style, points: [] } }
  }
  let dx = end.x - g.start.x
  let dy = end.y - g.start.y
  if (shift) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * side
    dy = Math.sign(dy || 1) * side
  }
  const w = Math.max(MIN_SIDE, Math.abs(dx))
  const h = Math.max(MIN_SIDE, Math.abs(dy))
  return {
    x: roundCoord(dx < 0 ? g.start.x - w : g.start.x),
    y: roundCoord(dy < 0 ? g.start.y - h : g.start.y),
    w: roundCoord(w),
    h: roundCoord(h),
    data: { ...style, points: [] }
  }
}

const movedFar = (g: Gesture, p: BoardPointer): boolean =>
  Math.hypot(p.screen.x - g.startScreen.x, p.screen.y - g.startScreen.y) >= CLICK_PX

function clear(): void {
  gesture = null
  if (useDraft.getState().draft) useDraft.setState({ draft: null })
}

function ShapeDraftOverlay() {
  const draft = useDraft((s) => s.draft)
  if (!draft) return null
  return (
    <div className="shpt-draft" style={{ width: draft.w, height: draft.h, transform: `translate(${draft.x}px, ${draft.y}px)` }}>
      <ShapeGraphic data={draft.data} w={draft.w} h={draft.h} />
    </div>
  )
}

export const shapeTool: ToolHandler = {
  id: 'shape',
  cursor: 'crosshair',
  onPointerDown(p) {
    if (!board().board) return
    gesture = { pointerId: p.pointerId, start: p.world, startScreen: p.screen, style: styleNow(), dragged: false }
  },
  onPointerMove(p) {
    const g = gesture
    if (!g || p.pointerId !== g.pointerId || !(p.buttons & 1)) return
    if (!g.dragged && !movedFar(g, p)) return
    g.dragged = true
    useDraft.setState({ draft: shapeFor(g, p.world, p.shiftKey, false) })
  },
  onPointerUp(p) {
    const g = gesture
    if (!g || p.pointerId !== g.pointerId) return
    clear()
    const s = board()
    const boardId = s.board?.id
    if (!boardId) return
    // Ending close to the start (even after wandering) gives a default shape rather than a speck.
    const click = !movedFar(g, p)
    const geo = shapeFor(g, p.world, p.shiftKey, click)
    const item = createShape({ boardId, z: s.nextZ(), x: geo.x, y: geo.y, w: geo.w, h: geo.h }, { ...geo.data, text: '' })
    s.addItems([item])
    s.setTool('select')
    s.setSelection([item.id])
  },
  onCancel: clear,
  Overlay: ShapeDraftOverlay
}
