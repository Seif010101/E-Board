// Select tool: click / Shift-click selection, drag to move (Alt+drag duplicates), rubber-band
// marquee, resize handles, double-click to edit or open details, and thread selection.

import type { Id } from '@shared/types'
import { LIMITS } from '@shared/validation'
import { getItemRenderer, type BoardPointer, type ResizeMode, type ToolHandler } from '../../../core/registry'
import { board, type ItemPatch } from '../../../core/store'
import { clamp, itemRect, normalizeRect, rectsIntersect } from '../../../core/geometry'
import type { Point, Rect } from '../../../core/types'
import { useCanvasUi } from '../../uiStore'
import { activateItem, duplicateItems } from '../../commands'
import { HANDLE_CURSORS, lineEndsOf, type HandleId, type LineHandleId } from '../../SelectionOverlay'
import { lineBox, snapAngle } from '../../../items/shape/geometry'
import { setMarquee, useMarquee } from './marquee'
import { MarqueeOverlay } from './MarqueeOverlay'

const DRAG_THRESHOLD = 3

interface Size {
  w: number
  h: number
}

interface MoveGesture {
  kind: 'move'
  startWorld: Point
  startScreen: Point
  clickedId: Id
  /** Plain click on an already-selected item of a multi-selection: a click without drag narrows to it. */
  narrowOnClick: boolean
  duplicate: boolean
  started: boolean
  /** Selection when the drag began (the originals when Alt-duplicating). */
  sourceIds: Id[]
  /** Items being moved: the selection, or its copies when Alt-duplicating. */
  ids: Id[]
  origins: Map<Id, Point>
}

interface MarqueeGesture {
  kind: 'marquee'
  startWorld: Point
  startScreen: Point
  base: Id[]
  active: boolean
}

interface ResizeGesture {
  kind: 'resize'
  id: Id
  handle: HandleId
  startWorld: Point
  startScreen: Point
  rect: Rect
  mode: ResizeMode
  min: Size
  started: boolean
}

/** Dragging one end of a line / arrow: the other end stays where it is. */
interface LineEndGesture {
  kind: 'lineEnd'
  id: Id
  end: LineHandleId
  /** World position of the end that does not move. */
  fixed: Point
  startScreen: Point
  /** The line before the drag, for Escape. */
  before: ItemPatch
  started: boolean
}

let gesture: MoveGesture | MarqueeGesture | ResizeGesture | LineEndGesture | null = null
let txOpen = false

const openTx = () => {
  if (txOpen) return
  txOpen = true
  board().beginTx()
}

const closeTx = () => {
  if (!txOpen) return
  txOpen = false
  board().endTx()
}

const isHandle = (h: string): h is HandleId => h in HANDLE_CURSORS
const isLineHandle = (h: string): h is LineHandleId => h === 'start' || h === 'end'

const beyondThreshold = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) > DRAG_THRESHOLD

const sameIds = (a: Id[], b: Id[]) => a.length === b.length && a.every((id, i) => id === b[i])

/** Starting positions of the movable (unlocked) items. */
function originsOf(ids: Id[]): Map<Id, Point> {
  const { items } = board()
  const map = new Map<Id, Point>()
  for (const id of ids) {
    const item = items[id]
    if (item && !item.locked) map.set(id, { x: item.x, y: item.y })
  }
  return map
}

/** New rect for a handle drag; the opposite edge / corner stays put. */
export function resizeRect(r: Rect, handle: HandleId, dx: number, dy: number, mode: ResizeMode, min: Size, shift: boolean): Rect {
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.includes('n')
  const south = handle.includes('s')
  let w = r.w + (east ? dx : west ? -dx : 0)
  let h = mode === 'width' ? r.h : r.h + (south ? dy : north ? -dy : 0)
  if (mode === 'ratio' || (mode === 'free' && shift && (east || west) && (north || south))) {
    const scale = clamp(
      Math.max(w / r.w, h / r.h),
      Math.max(min.w / r.w, min.h / r.h),
      Math.min(LIMITS.size / r.w, LIMITS.size / r.h)
    )
    w = r.w * scale
    h = r.h * scale
  } else {
    w = clamp(w, min.w, LIMITS.size)
    if (mode !== 'width') h = clamp(h, min.h, LIMITS.size)
  }
  return { x: west ? r.x + r.w - w : r.x, y: north ? r.y + r.h - h : r.y, w, h }
}

function onPointerDown(p: BoardPointer) {
  const s = board()
  gesture = null

  if (p.handle && isLineHandle(p.handle) && s.selection.length === 1) {
    const item = s.items[s.selection[0]]
    const ends = item ? lineEndsOf(item) : null
    if (item?.type === 'shape' && ends && !item.locked) {
      gesture = {
        kind: 'lineEnd',
        id: item.id,
        end: p.handle,
        fixed: p.handle === 'start' ? ends[1] : ends[0],
        startScreen: p.screen,
        before: { x: item.x, y: item.y, w: item.w, h: item.h, data: { points: item.data.points } },
        started: false
      }
      useCanvasUi.getState().setGestureCursor('crosshair')
      return
    }
  }

  if (p.handle && isHandle(p.handle) && s.selection.length === 1) {
    const item = s.items[s.selection[0]]
    const renderer = item ? getItemRenderer(item.type) : undefined
    if (item && renderer && !item.locked && renderer.resize !== 'none') {
      gesture = {
        kind: 'resize',
        id: item.id,
        handle: p.handle,
        startWorld: p.world,
        startScreen: p.screen,
        rect: itemRect(item),
        mode: renderer.resize,
        min: renderer.minSize,
        started: false
      }
      useCanvasUi.getState().setGestureCursor(HANDLE_CURSORS[p.handle])
      return
    }
  }

  const additive = p.shiftKey || p.ctrlKey || p.metaKey
  const item = p.itemId ? s.items[p.itemId] : undefined
  if (item) {
    if (s.editingItemId && s.editingItemId !== item.id) s.setEditing(null)
    if (p.detail === 2) {
      activateItem(item.id)
      return
    }
    const wasSelected = s.selection.includes(item.id)
    if (additive) s.toggleSelection(item.id)
    else if (!wasSelected) s.setSelection([item.id])
    const selection = board().selection
    if (!selection.includes(item.id)) return
    gesture = {
      kind: 'move',
      startWorld: p.world,
      startScreen: p.screen,
      clickedId: item.id,
      narrowOnClick: !additive && wasSelected && selection.length > 1,
      duplicate: p.altKey,
      started: false,
      sourceIds: selection,
      ids: selection,
      origins: new Map()
    }
    return
  }

  if (s.editingItemId) s.setEditing(null)
  if (p.linkId && s.links[p.linkId]) {
    s.selectLink(p.linkId)
    s.openInspector({ kind: 'link', id: p.linkId })
    return
  }

  if (!additive) {
    s.setSelection([])
    s.selectLink(null)
    s.closeInspector()
  }
  gesture = {
    kind: 'marquee',
    startWorld: p.world,
    startScreen: p.screen,
    base: additive ? board().selection : [],
    active: false
  }
}

function moveItems(g: MoveGesture, p: BoardPointer) {
  if (!g.started) {
    if (!beyondThreshold(p.screen, g.startScreen)) return
    g.started = true
    openTx()
    useCanvasUi.getState().setGestureCursor(g.duplicate ? 'copy' : 'move')
    if (g.duplicate) g.ids = duplicateItems(g.ids, 0)
    g.origins = originsOf(g.ids)
  }
  if (!g.origins.size) return
  const dx = p.world.x - g.startWorld.x
  const dy = p.world.y - g.startWorld.y
  const patches: Record<Id, ItemPatch> = {}
  for (const [id, o] of g.origins) patches[id] = { x: o.x + dx, y: o.y + dy }
  board().updateItems(patches)
}

function updateMarquee(g: MarqueeGesture, p: BoardPointer) {
  if (!g.active) {
    if (!beyondThreshold(p.screen, g.startScreen)) return
    g.active = true
  }
  const rect = normalizeRect(g.startWorld, p.world)
  setMarquee(rect)
  const s = board()
  const hits: Id[] = []
  for (const item of Object.values(s.items)) if (rectsIntersect(itemRect(item), rect)) hits.push(item.id)
  const next = g.base.length ? [...new Set([...g.base, ...hits])] : hits
  if (!sameIds(next, s.selection)) s.setSelection(next)
}

function updateResize(g: ResizeGesture, p: BoardPointer) {
  if (!g.started) {
    if (!beyondThreshold(p.screen, g.startScreen)) return
    g.started = true
    openTx()
  }
  const dx = p.world.x - g.startWorld.x
  const dy = p.world.y - g.startWorld.y
  board().updateItem(g.id, resizeRect(g.rect, g.handle, dx, dy, g.mode, g.min, p.shiftKey))
}

function updateLineEnd(g: LineEndGesture, p: BoardPointer) {
  if (!g.started) {
    if (!beyondThreshold(p.screen, g.startScreen)) return
    g.started = true
    openTx()
  }
  const item = board().items[g.id]
  if (item?.type !== 'shape') return
  const moved = p.shiftKey ? snapAngle(g.fixed, p.world) : p.world
  const [a, b] = g.end === 'start' ? [moved, g.fixed] : [g.fixed, moved]
  const box = lineBox(a, b, item.data.strokeWidth)
  board().updateItem<'shape'>(g.id, { x: box.x, y: box.y, w: box.w, h: box.h, data: { points: box.points } })
}

function onPointerMove(p: BoardPointer) {
  const g = gesture
  if (!g || !(p.buttons & 1)) return
  if (g.kind === 'move') moveItems(g, p)
  else if (g.kind === 'marquee') updateMarquee(g, p)
  else if (g.kind === 'lineEnd') updateLineEnd(g, p)
  else updateResize(g, p)
}

function finish() {
  gesture = null
  closeTx()
  if (useMarquee.getState().rect) setMarquee(null)
  useCanvasUi.getState().setGestureCursor(null)
}

function onPointerUp() {
  const g = gesture
  if (g?.kind === 'move' && !g.started && g.narrowOnClick) board().setSelection([g.clickedId])
  finish()
}

/** Escape / pointercancel: put moved or resized items back (inside the open transaction). */
function onCancel() {
  const g = gesture
  if (g?.kind === 'move' && g.started) {
    const s = board()
    if (g.duplicate) {
      s.removeItems(g.ids)
      s.setSelection(g.sourceIds.filter((id) => s.items[id]))
    } else if (g.origins.size) s.updateItems(Object.fromEntries([...g.origins].map(([id, o]) => [id, { x: o.x, y: o.y }])))
  } else if (g?.kind === 'resize' && g.started) {
    board().updateItem(g.id, g.rect)
  } else if (g?.kind === 'lineEnd' && g.started) {
    board().updateItem(g.id, g.before)
  }
  finish()
}

export const selectTool: ToolHandler = {
  id: 'select',
  cursor: 'default',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onCancel,
  Overlay: MarqueeOverlay
}
