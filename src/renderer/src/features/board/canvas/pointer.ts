// Turning DOM pointer events into BoardPointers for tools.

import type { Id } from '@shared/types'
import type { BoardPointer } from '../core/registry'
import { board } from '../core/store'
import { screenToWorld, viewCenterWorld } from '../core/geometry'
import type { Point } from '../core/types'

// The canvas rect is cached (refreshed on resize and at every gesture start) so pointer moves never
// force a synchronous layout via getBoundingClientRect.
let rectLeft = 0
let rectTop = 0

export function refreshCanvasRect(el: HTMLElement): void {
  const r = el.getBoundingClientRect()
  rectLeft = r.left
  rectTop = r.top
}

export const toScreen = (clientX: number, clientY: number): Point => ({ x: clientX - rectLeft, y: clientY - rectTop })

const INTERACTIVE = 'button, input, textarea, select, a, [contenteditable="true"], [data-interactive]'
const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]'

/** Target is a control inside the canvas (a card button, an inline text field…). */
export function isInteractiveTarget(target: Element | null, root: Element): boolean {
  const el = target?.closest(INTERACTIVE)
  return !!el && el !== root && root.contains(el)
}

/** Keyboard / clipboard events coming from a text field must be left alone. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return !!target.closest(EDITABLE)
}

export const isModalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null

// ---------------------------------------------------------------------------
// Click counting (PointerEvent.detail is not reliable across pointer types).

const MULTI_CLICK_MS = 450
const MULTI_CLICK_PX = 6

let lastDownTime = 0
let lastDownX = 0
let lastDownY = 0
let clickCount = 0

export function countClick(screen: Point, timeStamp: number): number {
  const near = Math.abs(screen.x - lastDownX) <= MULTI_CLICK_PX && Math.abs(screen.y - lastDownY) <= MULTI_CLICK_PX
  clickCount = near && timeStamp - lastDownTime <= MULTI_CLICK_MS ? clickCount + 1 : 1
  lastDownTime = timeStamp
  lastDownX = screen.x
  lastDownY = screen.y
  return clickCount
}

// ---------------------------------------------------------------------------
// Last known pointer position over the canvas (paste / drop targets).

let lastX = 0
let lastY = 0
let inside = false

export function trackPointer(screen: Point): void {
  lastX = screen.x
  lastY = screen.y
  inside = true
}

export function pointerLeft(): void {
  inside = false
}

/** World point for "paste here": the cursor when it is over the canvas, else the view centre. */
export function pastePoint(): Point {
  const v = board().viewport
  return inside ? screenToWorld({ x: lastX, y: lastY }, v) : viewCenterWorld(v)
}

// ---------------------------------------------------------------------------

const attr = (el: Element | null | undefined, name: string): Id | null => el?.getAttribute(name) ?? null

/** `hit` is the element under the pointer; anything outside the canvas (toolbar, drawer…) counts as empty. */
export function makePointer(e: PointerEvent, screen: Point, target: Element | null, root: Element, detail: number): BoardPointer {
  const hit = target && root.contains(target) ? target : null
  return {
    world: screenToWorld(screen, board().viewport),
    screen,
    pressure: e.pressure,
    button: e.button,
    buttons: e.buttons,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    itemId: attr(hit?.closest('[data-item-id]'), 'data-item-id'),
    linkId: attr(hit?.closest('[data-link-id]'), 'data-link-id'),
    handle: attr(hit?.closest('[data-handle]'), 'data-handle'),
    interactive: isInteractiveTarget(hit, root),
    detail
  }
}
