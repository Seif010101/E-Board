// Select a card and pan the board so it sits in the middle of the canvas.

import type { Id, Viewport } from '@shared/types'
import { board } from '../../core/store'
import { canvasSize } from '../../core/geometry'
import { animateViewport as animateCanvasViewport } from '../../canvas/viewport'

const DURATION_MS = 300

/**
 * Smooth viewport transition shared with the canvas (any direct pan / zoom by the user cancels it).
 * The canvas skips the animation when effects are turned off or the OS asks for reduced motion.
 */
export function animateViewport(target: Viewport): void {
  animateCanvasViewport(target, DURATION_MS)
}

export function focusItem(id: Id): void {
  const s = board()
  const item = s.items[id]
  if (!item) return
  s.setSelection([id])
  const { w, h } = canvasSize()
  const zoom = s.viewport.zoom < 0.5 ? 0.8 : s.viewport.zoom
  animateViewport({
    zoom,
    x: w / 2 - (item.x + item.w / 2) * zoom,
    y: h / 2 - (item.y + item.h / 2) * zoom
  })
}
