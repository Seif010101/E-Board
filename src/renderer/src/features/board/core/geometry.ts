import type { BoardItem, Viewport } from '@shared/types'
import type { Point, Rect } from './types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const screenToWorld = (p: Point, v: Viewport): Point => ({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom })
export const worldToScreen = (p: Point, v: Viewport): Point => ({ x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y })

/** Zoom keeping the given screen point fixed. */
export const zoomAt = (v: Viewport, screen: Point, nextZoom: number): Viewport => {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  const world = screenToWorld(screen, v)
  return { zoom, x: screen.x - world.x * zoom, y: screen.y - world.y * zoom }
}

export const itemRect = (i: Pick<BoardItem, 'x' | 'y' | 'w' | 'h'>): Rect => ({ x: i.x, y: i.y, w: i.w, h: i.h })

export const rectCenter = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export const normalizeRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y)
})

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y

export const rectContains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

export const pointInRect = (p: Point, r: Rect, pad = 0) =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad

export const unionRects = (rects: Rect[]): Rect | null => {
  if (rects.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Distance from p to segment ab. */
export const distToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Viewport that fits the given world rect inside a screen of size (sw, sh). */
export const fitRect = (r: Rect, sw: number, sh: number, padding = 80): Viewport => {
  const zoom = clamp(Math.min((sw - padding * 2) / Math.max(r.w, 1), (sh - padding * 2) / Math.max(r.h, 1)), MIN_ZOOM, 1.5)
  return { zoom, x: sw / 2 - (r.x + r.w / 2) * zoom, y: sh / 2 - (r.y + r.h / 2) * zoom }
}

// ---------------------------------------------------------------------------
// The canvas element registers itself so tools and helpers can convert coordinates.

let canvasEl: HTMLElement | null = null

export const setCanvasElement = (el: HTMLElement | null) => {
  canvasEl = el
}

export const getCanvasElement = () => canvasEl

/** Canvas size in CSS px (falls back to the window). */
export const canvasSize = (): { w: number; h: number } => {
  const r = canvasEl?.getBoundingClientRect()
  return r ? { w: r.width, h: r.height } : { w: window.innerWidth, h: window.innerHeight }
}

/** Convert a DOM clientX/Y into canvas-relative screen coordinates. */
export const clientToScreen = (clientX: number, clientY: number): Point => {
  const r = canvasEl?.getBoundingClientRect()
  return r ? { x: clientX - r.left, y: clientY - r.top } : { x: clientX, y: clientY }
}

/** World point at the centre of the visible canvas. */
export const viewCenterWorld = (v: Viewport): Point => {
  const { w, h } = canvasSize()
  return screenToWorld({ x: w / 2, y: h / 2 }, v)
}
