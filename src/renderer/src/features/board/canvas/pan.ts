// Shared pan / pinch gestures (hand tool, middle mouse, Space+drag, two-finger touch).

import type { Viewport } from '@shared/types'
import { board } from '../core/store'
import { clamp, MAX_ZOOM, MIN_ZOOM, screenToWorld } from '../core/geometry'
import type { Point } from '../core/types'
import { cancelViewportAnimation } from './viewport'
import { useCanvasUi } from './uiStore'

interface PanState {
  originX: number
  originY: number
  start: Viewport
}

let pan: PanState | null = null

export function startPan(screen: Point): void {
  cancelViewportAnimation()
  pan = { originX: screen.x, originY: screen.y, start: board().viewport }
  useCanvasUi.getState().setPanning(true)
}

export function updatePan(screen: Point): void {
  if (!pan) return
  const { start } = pan
  board().setViewport({ zoom: start.zoom, x: start.x + screen.x - pan.originX, y: start.y + screen.y - pan.originY })
}

export function endPan(): void {
  if (!pan) return
  pan = null
  useCanvasUi.getState().setPanning(false)
}

// ---------------------------------------------------------------------------
// Two-finger pinch: keeps the world point under the initial midpoint under the fingers.

interface PinchState {
  d0: number
  world: Point
  zoom0: number
}

let pinch: PinchState | null = null

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function startPinch(a: Point, b: Point): void {
  cancelViewportAnimation()
  const v = board().viewport
  pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), world: screenToWorld(mid(a, b), v), zoom0: v.zoom }
  useCanvasUi.getState().setPanning(true)
}

export function updatePinch(a: Point, b: Point): void {
  if (!pinch) return
  const zoom = clamp((pinch.zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d0, MIN_ZOOM, MAX_ZOOM)
  const m = mid(a, b)
  board().setViewport({ zoom, x: m.x - pinch.world.x * zoom, y: m.y - pinch.world.y * zoom })
}

export function endPinch(): void {
  if (!pinch) return
  pinch = null
  useCanvasUi.getState().setPanning(false)
}

export const isPinching = (): boolean => pinch !== null
