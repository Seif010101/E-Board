// Dragging the toolbar dock by its grip: the dock follows the pointer, the edge it would snap to is
// reported while it moves, and on release it glides into its docked place (FLIP animation).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import type { DockEdge } from '@shared/types'
import { isVerticalEdge, motionAllowed, nearestEdge } from './dock'

/** Pointer travel (px) before a press on the grip becomes a drag. */
const DRAG_THRESHOLD = 4

interface Press {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  /** Dock size when the press started (landing preview). */
  w: number
  h: number
}

export interface DockDragPreview {
  /** Edge the dock snaps to if released now. */
  target: DockEdge
  /** Size the dock will have on that edge. */
  w: number
  h: number
}

interface Options {
  dock: RefObject<HTMLDivElement | null>
  /** Area the dock is docked in; the nearest of its edges is the drop target. */
  zone: RefObject<HTMLDivElement | null>
  edge: DockEdge
  animations: boolean
  onStart(): void
  onDrop(edge: DockEdge): void
}

export interface DockDrag {
  /** Landing preview while dragging, null otherwise. */
  preview: DockDragPreview | null
  grip: {
    onPointerDown(e: ReactPointerEvent<HTMLElement>): void
    onPointerMove(e: ReactPointerEvent<HTMLElement>): void
    onPointerUp(e: ReactPointerEvent<HTMLElement>): void
    onPointerCancel(e: ReactPointerEvent<HTMLElement>): void
    onLostPointerCapture(e: ReactPointerEvent<HTMLElement>): void
  }
  /** True once for the click that follows a drag (it must not act as a click on the grip). */
  consumeDragClick(): boolean
  /** Animate the dock from where it is now to where the next render places it. */
  glideFromHere(): void
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

export function useDockDrag({ dock, zone, edge, animations, onStart, onDrop }: Options): DockDrag {
  const press = useRef<Press | null>(null)
  const dragClick = useRef(false)
  /** Swallows the click the browser sends right after a drag (and only that one). */
  const suppressClick = useCallback(() => {
    dragClick.current = true
    window.setTimeout(() => {
      dragClick.current = false
    }, 0)
  }, [])
  const glideFrom = useRef<DOMRect | null>(null)
  const [glideSeq, setGlideSeq] = useState(0)
  const [preview, setPreview] = useState<DockDragPreview | null>(null)
  const latest = useRef({ edge, onStart, onDrop })
  latest.current = { edge, onStart, onDrop }

  const glideFromHere = useCallback(() => {
    const el = dock.current
    if (!el) return
    glideFrom.current = el.getBoundingClientRect()
    setGlideSeq((n) => n + 1)
  }, [dock])

  // FLIP: render at the new place, jump back to where the dock was, then transition to rest.
  useLayoutEffect(() => {
    const el = dock.current
    const from = glideFrom.current
    glideFrom.current = null
    if (!el || !from) return
    el.style.transition = 'none'
    el.style.transform = ''
    if (motionAllowed(animations)) {
      const a = centre(from)
      const b = centre(el.getBoundingClientRect())
      el.style.transform = `translate(${a.x - b.x}px, ${a.y - b.y}px)`
      void el.offsetWidth
    }
    el.style.transition = ''
    el.style.transform = ''
  }, [dock, glideSeq, edge, animations])

  /** Abandons a drag: the dock returns to its docked place. */
  const cancel = useCallback(() => {
    const moved = press.current?.moved ?? false
    press.current = null
    setPreview(null)
    const el = dock.current
    if (!el || !moved) return
    suppressClick()
    el.style.transition = motionAllowed(animations) ? '' : 'none'
    el.style.transform = ''
    if (el.style.transition === 'none') {
      void el.offsetWidth
      el.style.transition = ''
    }
  }, [dock, animations, suppressClick])

  const targetAt = (x: number, y: number): DockEdge | null => {
    const z = zone.current
    return z ? nearestEdge(z.getBoundingClientRect(), x, y) : null
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || press.current || !dock.current) return
    const r = dock.current.getBoundingClientRect()
    press.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, w: r.width, h: r.height }
    dragClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const p = press.current
    const el = dock.current
    if (!p || !el || e.pointerId !== p.pointerId) return
    const dx = e.clientX - p.startX
    const dy = e.clientY - p.startY
    if (!p.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      p.moved = true
      el.style.transition = 'none'
      latest.current.onStart()
    }
    el.style.transform = `translate(${dx}px, ${dy}px)`
    const target = targetAt(e.clientX, e.clientY)
    if (!target) return
    // Turning between a vertical and a horizontal edge swaps the dock's width and height.
    const swap = isVerticalEdge(target) !== isVerticalEdge(latest.current.edge)
    const w = swap ? p.h : p.w
    const h = swap ? p.w : p.h
    setPreview((prev) => (prev?.target === target && prev.w === w && prev.h === h ? prev : { target, w, h }))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const p = press.current
    if (!p || e.pointerId !== p.pointerId) return
    press.current = null
    if (!p.moved) return
    suppressClick()
    setPreview(null)
    glideFromHere()
    latest.current.onDrop(targetAt(e.clientX, e.clientY) ?? latest.current.edge)
  }

  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (press.current?.pointerId === e.pointerId) cancel()
  }

  // Escape while dragging puts the dock back where it was.
  const dragging = preview !== null
  useEffect(() => {
    if (!dragging) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      cancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [dragging, cancel])

  const consumeDragClick = useCallback(() => {
    const was = dragClick.current
    dragClick.current = false
    return was
  }, [])

  return {
    preview,
    grip: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel },
    consumeDragClick,
    glideFromHere
  }
}
