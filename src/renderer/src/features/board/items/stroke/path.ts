// Geometry of freehand strokes, shared by the stroke item, the live drawing preview and the eraser.

import { getStroke } from 'perfect-freehand'
import type { LineStyle, StrokeData, StrokeTool } from '@shared/types'
import { distToSegment } from '../../core/geometry'
import type { Point, Rect } from '../../core/types'

export type StrokePoint = [x: number, y: number, pressure: number]

/** Pressure recorded for mouse and touch input; only real pens report varying values. */
export const DEFAULT_PRESSURE = 0.5

const fmt = (n: number): string => String(Math.round(n * 100) / 100)

export const roundCoord = (n: number): number => Math.round(n * 100) / 100

const hasRealPressure = (points: readonly StrokePoint[]): boolean =>
  points.some((p) => p[2] !== DEFAULT_PRESSURE)

const dotPath = (x: number, y: number, r: number): string =>
  `M${fmt(x - r)},${fmt(y)}a${fmt(r)},${fmt(r)} 0 1,0 ${fmt(r * 2)},0a${fmt(r)},${fmt(r)} 0 1,0 ${fmt(-r * 2)},0Z`

/** Filled outline of a pen stroke (perfect-freehand), as an SVG path. */
export function outlinePath(points: StrokePoint[], size: number, complete = true): string {
  if (points.length === 0) return ''
  const outline = getStroke(points, {
    size,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: !hasRealPressure(points),
    last: complete
  })
  if (outline.length < 4) return dotPath(points[0][0], points[0][1], size / 2)
  const avg = (a: number, b: number) => (a + b) / 2
  const [a, b, c] = outline
  let d = `M${fmt(a[0])},${fmt(a[1])}Q${fmt(b[0])},${fmt(b[1])} ${fmt(avg(b[0], c[0]))},${fmt(avg(b[1], c[1]))}T`
  for (let i = 2; i < outline.length - 1; i++) {
    const p = outline[i]
    const q = outline[i + 1]
    d += `${fmt(avg(p[0], q[0]))},${fmt(avg(p[1], q[1]))} `
  }
  return `${d}Z`
}

/** Smoothed centre line (quadratic curves through segment midpoints). A single point becomes a dot. */
export function centerlinePath(points: readonly StrokePoint[]): string {
  if (points.length === 0) return ''
  const [x0, y0] = points[0]
  if (points.length === 1) return `M${fmt(x0)},${fmt(y0)}l0.01,0`
  let d = `M${fmt(x0)},${fmt(y0)}`
  if (points.length === 2) return `${d}L${fmt(points[1][0])},${fmt(points[1][1])}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += `Q${fmt(x)},${fmt(y)} ${fmt((x + nx) / 2)},${fmt((y + ny) / 2)}`
  }
  const [lx, ly] = points[points.length - 1]
  return `${d}L${fmt(lx)},${fmt(ly)}`
}

/** Dash pattern for a stroke of the given thickness (used with round caps). */
export function strokeDashArray(dash: LineStyle, size: number): string | undefined {
  if (dash === 'dashed') return `${fmt(size * 1.6)} ${fmt(size * 2.4)}`
  if (dash === 'dotted') return `0 ${fmt(size * 2)}`
  return undefined
}

export const HIGHLIGHTER_OPACITY = 0.4

/** Empty space kept around the points so the painted outline stays inside the item box. */
export const strokePadding = (size: number): number => size

/** Item box and box-relative points for a stroke given in world coordinates. */
export function normalizeStroke(world: readonly StrokePoint[], size: number): Rect & { points: StrokePoint[] } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of world) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const pad = strokePadding(size)
  const x = roundCoord(minX - pad)
  const y = roundCoord(minY - pad)
  return {
    x,
    y,
    w: roundCoord(maxX - minX + pad * 2),
    h: roundCoord(maxY - minY + pad * 2),
    points: world.map(([px, py, p]) => [roundCoord(px - x), roundCoord(py - y), p])
  }
}

/** Stroke points translated to world coordinates. */
export const worldPoints = (item: { x: number; y: number; data: Pick<StrokeData, 'points'> }): StrokePoint[] =>
  item.data.points.map(([x, y, p]) => [x + item.x, y + item.y, p])

/** Distance test against the stroke's polyline; `p` is relative to the item origin. */
export function strokeNear(points: readonly StrokePoint[], p: Point, tolerance: number): boolean {
  if (points.length === 1) return Math.hypot(p.x - points[0][0], p.y - points[0][1]) <= tolerance
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (distToSegment(p, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }) <= tolerance) return true
  }
  return false
}

export interface StrokeStyle {
  tool: StrokeTool
  color: string
  size: number
  dash: LineStyle
}
