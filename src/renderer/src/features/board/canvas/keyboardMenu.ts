// Opening the context menu from the keyboard (Shift+F10 / the Menu key), anchored on the
// selection, the selected thread's midpoint area or the centre of the canvas.

import { board } from '../core/store'
import { clamp, getCanvasElement, itemRect, rectCenter, screenToWorld, unionRects, worldToScreen } from '../core/geometry'
import type { Point } from '../core/types'
import { useCanvasUi, type ContextMenuTarget } from './uiStore'

const EDGE = 24

export function openKeyboardMenu(): void {
  const el = getCanvasElement()
  const s = board()
  if (!el || !s.board) return
  const r = el.getBoundingClientRect()
  const centre: Point = { x: r.width / 2, y: r.height / 2 }
  const ids = s.selection.filter((id) => s.items[id])
  let screen = centre
  let target: ContextMenuTarget = { kind: 'canvas' }
  if (ids.length) {
    const bounds = unionRects(ids.map((id) => itemRect(s.items[id])))
    if (bounds) {
      const c = worldToScreen(rectCenter(bounds), s.viewport)
      screen = { x: clamp(c.x, EDGE, r.width - EDGE), y: clamp(c.y, EDGE, r.height - EDGE) }
    }
    target = { kind: 'items', ids }
  } else if (s.selectedLinkId && s.links[s.selectedLinkId]) {
    target = { kind: 'link', id: s.selectedLinkId }
  }
  useCanvasUi.getState().openMenu({
    clientX: r.left + screen.x,
    clientY: r.top + screen.y,
    world: screenToWorld(screen, s.viewport),
    target
  })
}
