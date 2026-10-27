// Pointer, wheel, context-menu and drag & drop routing for the canvas element.
//
// Pointer gestures are dispatched to the active tool (registry.getTool) with pointer capture;
// middle mouse, Space+drag and two-finger touch pan/zoom regardless of the tool. Controls inside
// items (buttons, inputs, [data-interactive]) never reach the tools.

import type { Viewport } from '@shared/types'
import { useSession } from '@renderer/stores/session'
import { board, useBoard } from '../core/store'
import { getTool } from '../core/registry'
import { screenToWorld, zoomAt } from '../core/geometry'
import type { Point, ToolId } from '../core/types'
import { useCanvasUi, type ContextMenuTarget } from './uiStore'
import { endPan, endPinch, isPinching, startPan, startPinch, updatePan, updatePinch } from './pan'
import { cancelViewportAnimation } from './viewport'
import {
  countClick,
  isEditableTarget,
  isInteractiveTarget,
  makePointer,
  pointerLeft,
  refreshCanvasRect,
  toScreen,
  trackPointer
} from './pointer'
import { importImageFiles, transferFiles, transferHasFiles } from './imageImport'

type Gesture = { kind: 'tool'; pointerId: number; detail: number } | { kind: 'pan'; pointerId: number }

/** Mouse-wheel notch zoom speed (exponential). */
const WHEEL_ZOOM = 0.0015
/** Touchpad pinch (small ctrl+wheel deltas) zoom speed. */
const PINCH_ZOOM = 0.01

let root: HTMLElement | null = null
let gesture: Gesture | null = null
const touches = new Map<number, Point>()

const asElement = (t: EventTarget | null): Element | null => (t instanceof Element ? t : null)

const capture = (id: number) => {
  try {
    root?.setPointerCapture(id)
  } catch {
    /* the pointer is already gone */
  }
}

const release = (id: number) => {
  if (root?.hasPointerCapture(id)) root.releasePointerCapture(id)
}

export const isGestureActive = (): boolean => gesture !== null || isPinching()

/** Abort the running gesture (Escape, pointercancel, unmount). */
export function cancelActiveGesture(): void {
  const g = gesture
  gesture = null
  if (g) release(g.pointerId)
  if (g?.kind === 'tool') getTool(board().tool)?.onCancel?.()
  else if (g?.kind === 'pan') endPan()
  if (isPinching()) endPinch()
}

/** The previous tool is deactivated: drop its gesture and let it clean up. */
function toolChanged(prev: ToolId): void {
  const g = gesture
  gesture = null
  if (g) release(g.pointerId)
  if (g?.kind === 'pan') endPan()
  getTool(prev)?.onCancel?.()
}

// ---------------------------------------------------------------------------
// Pointer events

function onPointerDown(e: PointerEvent) {
  const el = root
  if (!el) return
  useCanvasUi.getState().closeMenu()
  refreshCanvasRect(el)
  const screen = toScreen(e.clientX, e.clientY)

  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, screen)
    if (touches.size === 2) {
      cancelActiveGesture()
      const [a, b] = [...touches.values()]
      startPinch(a, b)
      for (const id of touches.keys()) capture(id)
      return
    }
    if (touches.size > 2 || isPinching()) return
  }

  // Recover from a gesture whose pointer silently went away.
  if (gesture && !el.hasPointerCapture(gesture.pointerId)) cancelActiveGesture()
  if (gesture) return

  const target = asElement(e.target)
  if (e.button === 1 || (e.button === 0 && useCanvasUi.getState().spaceHeld)) {
    e.preventDefault()
    startPan(screen)
    gesture = { kind: 'pan', pointerId: e.pointerId }
    capture(e.pointerId)
    return
  }
  // Right button opens the context menu; other buttons are ignored.
  if (e.button !== 0 || isInteractiveTarget(target, el)) return
  const tool = getTool(board().tool)
  if (!tool) return
  const detail = countClick(screen, e.timeStamp)
  gesture = { kind: 'tool', pointerId: e.pointerId, detail }
  capture(e.pointerId)
  tool.onPointerDown?.(makePointer(e, screen, target, el, detail))
}

function onPointerMove(e: PointerEvent) {
  const el = root
  if (!el) return
  const screen = toScreen(e.clientX, e.clientY)
  trackPointer(screen)

  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, screen)
    if (isPinching()) {
      const [a, b] = [...touches.values()]
      if (a && b) updatePinch(a, b)
      return
    }
  }

  const g = gesture
  if (g) {
    if (e.pointerId !== g.pointerId) return
    if (g.kind === 'pan') {
      updatePan(screen)
      return
    }
    const tool = getTool(board().tool)
    if (!tool?.onPointerMove) return
    // Under pointer capture e.target is the canvas itself: hit-test once for the real element.
    const hit = document.elementFromPoint(e.clientX, e.clientY)
    const events = e.getCoalescedEvents?.() ?? []
    if (events.length > 1) {
      for (const ce of events) {
        if (gesture !== g) break
        tool.onPointerMove(makePointer(ce, toScreen(ce.clientX, ce.clientY), hit, el, g.detail))
      }
    } else {
      tool.onPointerMove(makePointer(e, screen, hit, el, g.detail))
    }
    return
  }

  if (isPinching()) return
  const tool = getTool(board().tool)
  tool?.onPointerMove?.(makePointer(e, screen, asElement(e.target), el, 0))
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerType === 'touch') {
    touches.delete(e.pointerId)
    if (isPinching()) {
      if (touches.size < 2) endPinch()
      return
    }
  }
  const el = root
  const g = gesture
  if (!el || !g || e.pointerId !== g.pointerId) return
  gesture = null
  if (g.kind === 'pan') {
    endPan()
    return
  }
  const hit = document.elementFromPoint(e.clientX, e.clientY)
  getTool(board().tool)?.onPointerUp?.(makePointer(e, toScreen(e.clientX, e.clientY), hit, el, g.detail))
}

function onPointerCancel(e: PointerEvent) {
  touches.delete(e.pointerId)
  if (isPinching() && touches.size < 2) endPinch()
  if (gesture?.pointerId === e.pointerId) cancelActiveGesture()
}

function onLostPointerCapture(e: PointerEvent) {
  // Fires after every pointerup too, by which time the gesture is already finished.
  if (gesture?.pointerId === e.pointerId) cancelActiveGesture()
}

function onPointerLeave(e: PointerEvent) {
  if (e.pointerType !== 'touch') pointerLeft()
}

function onMouseDown(e: MouseEvent) {
  // Middle button: no Windows autoscroll, it pans the board.
  if (e.button === 1) e.preventDefault()
}

// ---------------------------------------------------------------------------
// Context menu

function onContextMenu(e: MouseEvent) {
  const el = root
  const target = asElement(e.target)
  if (!el || isEditableTarget(target)) return
  e.preventDefault()
  if (gesture || isPinching()) return
  const s = board()
  refreshCanvasRect(el)
  const world = screenToWorld(toScreen(e.clientX, e.clientY), s.viewport)
  const itemId = target?.closest('[data-item-id]')?.getAttribute('data-item-id')
  const linkId = target?.closest('[data-link-id]')?.getAttribute('data-link-id')
  let menuTarget: ContextMenuTarget
  if (itemId && s.items[itemId]) {
    if (!s.selection.includes(itemId)) s.setSelection([itemId])
    menuTarget = { kind: 'items', ids: board().selection }
  } else if (linkId && s.links[linkId]) {
    s.selectLink(linkId)
    menuTarget = { kind: 'link', id: linkId }
  } else {
    menuTarget = { kind: 'canvas' }
  }
  useCanvasUi.getState().openMenu({ clientX: e.clientX, clientY: e.clientY, world, target: menuTarget })
}

// ---------------------------------------------------------------------------
// Wheel: zoom / pan

/** The wheel should scroll a scrollable area inside a card (long notes…) rather than the board. */
function canScrollInside(target: Element | null, el: Element, dy: number): boolean {
  if (dy === 0 || !target?.closest('[data-item-id]')) return false
  for (let node: Element | null = target; node && node !== el; node = node.parentElement) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight + 1) {
      const overflow = getComputedStyle(node).overflowY
      if (overflow === 'auto' || overflow === 'scroll') {
        if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true
      }
    }
    if (node.hasAttribute('data-item-id')) break
  }
  return false
}

function onWheel(e: WheelEvent) {
  const el = root
  if (!el) return
  const zoomGesture = e.ctrlKey || e.metaKey
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1
  const dx = e.deltaX * unit
  const dy = e.deltaY * unit
  if (!zoomGesture && canScrollInside(asElement(e.target), el, dy)) return
  e.preventDefault()
  if (gesture?.kind === 'pan' || isPinching()) return
  cancelViewportAnimation()
  useCanvasUi.getState().closeMenu()
  const v = board().viewport
  const screen = toScreen(e.clientX, e.clientY)

  if (zoomGesture) {
    // A touchpad pinch arrives as small ctrl+wheel deltas, a mouse notch as ~100.
    const k = Math.abs(dy) >= 50 ? WHEEL_ZOOM : PINCH_ZOOM
    board().setViewport(zoomAt(v, screen, v.zoom * Math.exp(-dy * k)))
    return
  }

  const behavior = useSession.getState().user?.settings.wheelBehavior ?? 'zoom'
  let next: Viewport
  if (behavior === 'zoom' && !e.shiftKey) {
    next = dy !== 0 ? zoomAt(v, screen, v.zoom * Math.exp(-dy * WHEEL_ZOOM)) : v
    if (dx !== 0) next = { ...next, x: next.x - dx }
  } else if (e.shiftKey && dx === 0) {
    next = { ...v, x: v.x - dy }
  } else {
    next = { ...v, x: v.x - dx, y: v.y - dy }
  }
  if (next !== v) board().setViewport(next)
}

// ---------------------------------------------------------------------------
// Drag & drop of image files

function onDragStart(e: DragEvent) {
  // Native image/link drags would steal the pointer from the select tool.
  if (asElement(e.target)?.closest('img, a')) e.preventDefault()
}

function onDragEnter(e: DragEvent) {
  if (!transferHasFiles(e.dataTransfer)) return
  e.preventDefault()
  useCanvasUi.getState().setDropActive(true)
}

function onDragOver(e: DragEvent) {
  if (!transferHasFiles(e.dataTransfer)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  useCanvasUi.getState().setDropActive(true)
}

function onDragLeave(e: DragEvent) {
  const to = e.relatedTarget
  if (!(to instanceof Node) || !root?.contains(to)) useCanvasUi.getState().setDropActive(false)
}

function onDrop(e: DragEvent) {
  const el = root
  if (!el || !transferHasFiles(e.dataTransfer)) return
  e.preventDefault()
  useCanvasUi.getState().setDropActive(false)
  refreshCanvasRect(el)
  const world = screenToWorld(toScreen(e.clientX, e.clientY), board().viewport)
  void importImageFiles(transferFiles(e.dataTransfer), world)
}

/** Files dropped anywhere else in the window must never make Chromium navigate to them. */
function guardWindowDrop(e: DragEvent) {
  if (e.defaultPrevented || !transferHasFiles(e.dataTransfer)) return
  e.preventDefault()
  if (e.type === 'dragover' && e.dataTransfer) e.dataTransfer.dropEffect = 'none'
  if (e.type === 'drop') useCanvasUi.getState().setDropActive(false)
}

// ---------------------------------------------------------------------------

/** Wires all canvas input. Returns the detach function. */
export function attachCanvasInput(el: HTMLElement): () => void {
  root = el
  const listeners: [string, (e: never) => void, AddEventListenerOptions?][] = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerCancel],
    ['lostpointercapture', onLostPointerCapture],
    ['pointerleave', onPointerLeave],
    ['mousedown', onMouseDown],
    ['contextmenu', onContextMenu],
    ['wheel', onWheel, { passive: false }],
    ['dragstart', onDragStart],
    ['dragenter', onDragEnter],
    ['dragover', onDragOver],
    ['dragleave', onDragLeave],
    ['drop', onDrop]
  ]
  for (const [type, fn, opts] of listeners) el.addEventListener(type, fn as EventListener, opts)
  window.addEventListener('dragover', guardWindowDrop)
  window.addEventListener('drop', guardWindowDrop)
  const unsubTool = useBoard.subscribe((s, prev) => {
    if (s.tool !== prev.tool) toolChanged(prev.tool)
  })

  return () => {
    cancelActiveGesture()
    touches.clear()
    unsubTool()
    for (const [type, fn, opts] of listeners) el.removeEventListener(type, fn as EventListener, opts)
    window.removeEventListener('dragover', guardWindowDrop)
    window.removeEventListener('drop', guardWindowDrop)
    useCanvasUi.getState().setDropActive(false)
    if (root === el) root = null
  }
}
