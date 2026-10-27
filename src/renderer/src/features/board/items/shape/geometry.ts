// Geometry of shape items: outlines of closed shapes, endpoints of lines / arrows, hit testing.
//
// Lines and arrows keep their two endpoints in data.points (relative to the item origin). They are
// drawn by mapping the endpoints' bounding box onto the item box inset by linePad(), so a line
// stretches with its box when the item is resized.

import type { LineStyle, ShapeData, ShapeKind } from '@shared/types'
import { distToSegment, pointInRect } from '../../core/geometry'
import type { Point, Rect } from '../../core/types'

export type ClosedShapeKind = Exclude<ShapeKind, 'line' | 'arrow'>

export const isLineKind = (k: ShapeKind): k is 'line' | 'arrow' => k === 'line' || k === 'arrow'

const fmt = (n: number): string => String(Math.round(n * 100) / 100)
export const roundCoord = (n: number): number => Math.round(n * 100) / 100

/** Path of a closed shape filling w × h, inset so a stroke of width `sw` stays inside. */
export function closedShapePath(kind: ClosedShapeKind, w: number, h: number, sw: number): string {
  const i = Math.min(sw / 2, w / 2, h / 2)
  const x0 = i
  const y0 = i
  const x1 = w - i
  const y1 = h - i
  const cx = w / 2
  const cy = h / 2
  switch (kind) {
    case 'rect':
      return `M${fmt(x0)},${fmt(y0)}H${fmt(x1)}V${fmt(y1)}H${fmt(x0)}Z`
    case 'roundRect': {
      const r = Math.max(0, Math.min(18, (x1 - x0) / 4, (y1 - y0) / 4))
      return (
        `M${fmt(x0 + r)},${fmt(y0)}H${fmt(x1 - r)}A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(x1)},${fmt(y0 + r)}` +
        `V${fmt(y1 - r)}A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(x1 - r)},${fmt(y1)}` +
        `H${fmt(x0 + r)}A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(x0)},${fmt(y1 - r)}` +
        `V${fmt(y0 + r)}A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(x0 + r)},${fmt(y0)}Z`
      )
    }
    case 'ellipse': {
      const rx = Math.max(0, cx - i)
      const ry = Math.max(0, cy - i)
      return `M${fmt(x0)},${fmt(cy)}A${fmt(rx)},${fmt(ry)} 0 1 0 ${fmt(x1)},${fmt(cy)}A${fmt(rx)},${fmt(ry)} 0 1 0 ${fmt(x0)},${fmt(cy)}Z`
    }
    case 'triangle':
      return `M${fmt(cx)},${fmt(y0)}L${fmt(x1)},${fmt(y1)}L${fmt(x0)},${fmt(y1)}Z`
    case 'diamond':
      return `M${fmt(cx)},${fmt(y0)}L${fmt(x1)},${fmt(cy)}L${fmt(cx)},${fmt(y1)}L${fmt(x0)},${fmt(cy)}Z`
  }
}

/** Area for the centred label of a closed shape (fractions of the box), roughly its inscribed rectangle. */
export const LABEL_INSET: Record<ClosedShapeKind, { x: number; top: number; bottom: number }> = {
  rect: { x: 0.06, top: 0.08, bottom: 0.08 },
  roundRect: { x: 0.08, top: 0.08, bottom: 0.08 },
  ellipse: { x: 0.15, top: 0.15, bottom: 0.15 },
  triangle: { x: 0.24, top: 0.42, bottom: 0.08 },
  diamond: { x: 0.25, top: 0.25, bottom: 0.25 }
}

export function dashArray(dash: LineStyle, sw: number): string | undefined {
  if (dash === 'dashed') return `${fmt(sw * 3.2)} ${fmt(sw * 2.4)}`
  if (dash === 'dotted') return `0 ${fmt(sw * 2.2)}`
  return undefined
}

// ---------------------------------------------------------------------------
// Lines and arrows

/** Space kept around a line's endpoints (room for the stroke and the arrow head). */
export const linePad = (sw: number): number => Math.max(10, sw * 3)

/** Item box and box-relative endpoints for a line between two world points. */
export function lineBox(a: Point, b: Point, sw: number): Rect & { points: [number, number][] } {
  const pad = linePad(sw)
  const x = roundCoord(Math.min(a.x, b.x) - pad)
  const y = roundCoord(Math.min(a.y, b.y) - pad)
  return {
    x,
    y,
    w: roundCoord(Math.abs(a.x - b.x) + pad * 2),
    h: roundCoord(Math.abs(a.y - b.y) + pad * 2),
    points: [
      [roundCoord(a.x - x), roundCoord(a.y - y)],
      [roundCoord(b.x - x), roundCoord(b.y - y)]
    ]
  }
}

/** Endpoints of a line inside its box (box-relative), following the box when it was resized. */
export function lineEnds(w: number, h: number, data: Pick<ShapeData, 'points' | 'strokeWidth'>): [Point, Point] {
  const pts: [number, number][] =
    data.points.length === 2
      ? data.points
      : [
          [0, h / 2],
          [w, h / 2]
        ]
  const pad = Math.min(linePad(data.strokeWidth), w / 2, h / 2)
  const [[ax, ay], [bx, by]] = pts
  const map = (v: number, lo: number, hi: number, size: number) =>
    hi - lo < 0.5 ? size / 2 : pad + ((v - lo) / (hi - lo)) * (size - pad * 2)
  const minX = Math.min(ax, bx)
  const maxX = Math.max(ax, bx)
  const minY = Math.min(ay, by)
  const maxY = Math.max(ay, by)
  return [
    { x: map(ax, minX, maxX, w), y: map(ay, minY, maxY, h) },
    { x: map(bx, minX, maxX, w), y: map(by, minY, maxY, h) }
  ]
}

export interface LineGeometry {
  /** The visible shaft (shortened under an arrow head). */
  shaft: string
  /** Full segment, used for the hit area. */
  full: string
  /** Filled arrow head, if any. */
  head: string | null
}

export function lineGeometry(a: Point, b: Point, sw: number, arrow: boolean): LineGeometry {
  const full = `M${fmt(a.x)},${fmt(a.y)}L${fmt(b.x)},${fmt(b.y)}`
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (!arrow || len < 0.5) return { shaft: full, full, head: null }
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const headLen = Math.min(Math.max(10, sw * 3.2), len * 0.6)
  const half = headLen * 0.45
  const bx = b.x - ux * headLen
  const by = b.y - uy * headLen
  const head =
    `M${fmt(b.x)},${fmt(b.y)}L${fmt(bx - uy * half)},${fmt(by + ux * half)}` +
    `L${fmt(bx + uy * half)},${fmt(by - ux * half)}Z`
  // The shaft stops inside the head so its cap never pokes through the tip.
  const sx = b.x - ux * headLen * 0.7
  const sy = b.y - uy * headLen * 0.7
  return { shaft: `M${fmt(a.x)},${fmt(a.y)}L${fmt(sx)},${fmt(sy)}`, full, head }
}

/** Snap the direction a → b to multiples of 45°. */
export function snapAngle(a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const step = Math.PI / 4
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: a.x + Math.cos(angle) * len, y: a.y + Math.sin(angle) * len }
}

// ---------------------------------------------------------------------------

interface ShapeLike {
  x: number
  y: number
  w: number
  h: number
  data: ShapeData
}

/** World-space hit test: lines by distance to the segment, closed shapes by their box. */
export function shapeHit(item: ShapeLike, p: Point, radius: number): boolean {
  if (!isLineKind(item.data.shape)) return pointInRect(p, item, radius)
  const [a, b] = lineEnds(item.w, item.h, item.data)
  const pa = { x: item.x + a.x, y: item.y + a.y }
  const pb = { x: item.x + b.x, y: item.y + b.y }
  return distToSegment(p, pa, pb) <= radius + item.data.strokeWidth / 2 + 2
}

/** Threads attach to the middle of a line, and to the top centre of closed shapes. */
export function shapeAnchor(item: ShapeLike): Point {
  if (!isLineKind(item.data.shape)) return { x: item.x + item.w / 2, y: item.y + Math.min(12, item.h / 2) }
  const [a, b] = lineEnds(item.w, item.h, item.data)
  return { x: item.x + (a.x + b.x) / 2, y: item.y + (a.y + b.y) / 2 }
}
