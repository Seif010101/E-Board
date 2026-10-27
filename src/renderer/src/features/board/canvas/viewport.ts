// Viewport helpers: animated transitions, zoom steps, fit-to-content and the initial view.

import type { BoardItem, Viewport } from '@shared/types'
import { useSession } from '@renderer/stores/session'
import { board } from '../core/store'
import { canvasSize, clamp, fitRect, itemRect, MAX_ZOOM, MIN_ZOOM, screenToWorld, unionRects, zoomAt } from '../core/geometry'
import type { Rect } from '../core/types'

interface Animation {
  raf: number
  target: Viewport
}

let anim: Animation | null = null

/** Transitions are skipped when the OS asks for reduced motion or the user turned effects off. */
const instant = () =>
  !(useSession.getState().user?.settings.animations ?? true) ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Stop a running transition (any direct user input on the viewport should call this). */
export function cancelViewportAnimation(): void {
  if (!anim) return
  cancelAnimationFrame(anim.raf)
  anim = null
}

/** Where the viewport is heading: the running animation's target, else the current viewport. */
export const targetViewport = (): Viewport => anim?.target ?? board().viewport

/**
 * Smoothly move to `target`. Zoom is interpolated logarithmically and the world point at the
 * screen centre linearly, which avoids the "swoop" of interpolating x/y/zoom independently.
 */
export function animateViewport(target: Viewport, duration = 320): void {
  cancelViewportAnimation()
  const from = board().viewport
  if (duration <= 0 || instant()) {
    board().setViewport(target)
    return
  }
  const { w, h } = canvasSize()
  const centre = { x: w / 2, y: h / 2 }
  const c0 = screenToWorld(centre, from)
  const c1 = screenToWorld(centre, target)
  const lz0 = Math.log(from.zoom)
  const lz1 = Math.log(target.zoom)
  const start = performance.now()

  const step = (now: number) => {
    if (!anim) return
    const t = Math.min(1, (now - start) / duration)
    if (t >= 1) {
      anim = null
      board().setViewport(target)
      return
    }
    const k = easeInOutCubic(t)
    const zoom = Math.exp(lz0 + (lz1 - lz0) * k)
    const cx = c0.x + (c1.x - c0.x) * k
    const cy = c0.y + (c1.y - c0.y) * k
    board().setViewport({ zoom, x: centre.x - cx * zoom, y: centre.y - cy * zoom })
    anim.raf = requestAnimationFrame(step)
  }
  anim = { raf: requestAnimationFrame(step), target }
}

/** Bounding box of every item, or null for an empty board. */
export function contentRect(items: Record<string, BoardItem> = board().items): Rect | null {
  return unionRects(Object.values(items).map(itemRect))
}

const centreOfCanvas = () => {
  const { w, h } = canvasSize()
  return { x: w / 2, y: h / 2 }
}

/** Viewport that shows the world origin at the centre of the canvas at 100%. */
const originView = (): Viewport => {
  const c = centreOfCanvas()
  return { x: c.x, y: c.y, zoom: 1 }
}

/** Zoom by a factor about the canvas centre (chains smoothly while a step is animating). */
export function zoomBy(factor: number): void {
  const base = targetViewport()
  animateViewport(zoomAt(base, centreOfCanvas(), base.zoom * factor), 160)
}

/** Set an absolute zoom level about the canvas centre. */
export function zoomTo(zoom: number): void {
  animateViewport(zoomAt(targetViewport(), centreOfCanvas(), clamp(zoom, MIN_ZOOM, MAX_ZOOM)), 220)
}

/** Fit all items into view; an empty board recentres the origin. */
export function fitContent(animated = true): void {
  const r = contentRect()
  const { w, h } = canvasSize()
  const target = r ? fitRect(r, w, h, Math.min(80, Math.max(24, Math.min(w, h) / 8))) : originView()
  if (animated) animateViewport(target, 380)
  else {
    cancelViewportAnimation()
    board().setViewport(target)
  }
}

/** Pan & zoom so a single item is comfortably in view. */
export function focusItem(item: BoardItem): void {
  const { w, h } = canvasSize()
  const r = itemRect(item)
  const zoom = clamp(fitRect(r, w, h, 120).zoom, 0.35, 1.25)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  animateViewport({ zoom, x: w / 2 - cx * zoom, y: h / 2 - cy * zoom }, 420)
}

/** Board opened with a never-touched viewport: fit its content, or centre the origin when empty. */
export function applyInitialView(): void {
  const v = board().viewport
  if (v.x !== 0 || v.y !== 0 || v.zoom !== 1) return
  if (Object.keys(board().items).length > 0) fitContent(false)
  else board().setViewport(originView())
}

/** Pan by a screen-space offset (keyboard / minimap navigation). */
export function panBy(dx: number, dy: number): void {
  cancelViewportAnimation()
  const v = board().viewport
  board().setViewport({ zoom: v.zoom, x: v.x + dx, y: v.y + dy })
}

/** Keep the zoom and put `world` at the centre of the canvas. */
export function centerOn(world: { x: number; y: number }): void {
  cancelViewportAnimation()
  const { zoom } = board().viewport
  const c = centreOfCanvas()
  board().setViewport({ zoom, x: c.x - world.x * zoom, y: c.y - world.y * zoom })
}

/** World rectangle currently visible on screen. */
export function visibleWorldRect(v: Viewport = board().viewport): Rect {
  const { w, h } = canvasSize()
  return { x: -v.x / v.zoom, y: -v.y / v.zoom, w: w / v.zoom, h: h / v.zoom }
}
