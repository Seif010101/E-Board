import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react'
import type { DockEdge } from '@shared/types'
import { isVerticalEdge } from './dock'

/** Distance between the button and the panel, and the minimum margin to the board edges. */
const GAP = 10
const MARGIN = 8
/** Never squeeze a panel below this height, even in a very short window (it scrolls instead). */
const MIN_HEIGHT = 140

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, max))

/** Where keyboard focus lands in a panel opened from the keyboard, by preference. */
const FOCUS_ORDER = ['[role="radio"][aria-checked="true"]', '[role="menuitem"]', 'button:not(:disabled)', 'input']

interface FlyoutProps {
  id: string
  title: string
  /** The dock button the panel belongs to. */
  anchor(): HTMLElement | null
  /** Element the panel is positioned in (the toolbar root covering the board). */
  root(): HTMLElement | null
  edge: DockEdge
  wide?: boolean
  /** Move focus into the panel (it was opened from the keyboard). */
  autoFocus: boolean
  panelRef: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * Non-modal panel next to a dock button, opening toward the board interior and kept inside the
 * board. Positioned by writing straight to the DOM so content changes re-place it without renders.
 */
export function Flyout({ id, title, anchor, root, edge, wide, autoFocus, panelRef, children }: FlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const el = ref.current
    const host = root()
    const button = anchor()
    if (!el || !host || !button) return
    const place = () => {
      const r = host.getBoundingClientRect()
      const a = button.getBoundingClientRect()
      const s = el.style
      let left: number
      let top: number
      if (isVerticalEdge(edge)) {
        s.maxHeight = `${Math.max(MIN_HEIGHT, r.height - MARGIN * 2)}px`
        const w = el.offsetWidth
        const h = el.offsetHeight
        left = edge === 'left' ? a.right - r.left + GAP : a.left - r.left - GAP - w
        top = clamp(a.top - r.top + a.height / 2 - h / 2, MARGIN, r.height - h - MARGIN)
      } else {
        const room = edge === 'top' ? r.bottom - a.bottom - GAP - MARGIN : a.top - r.top - GAP - MARGIN
        s.maxHeight = `${Math.max(MIN_HEIGHT, room)}px`
        const w = el.offsetWidth
        const h = el.offsetHeight
        top = edge === 'top' ? a.bottom - r.top + GAP : a.top - r.top - GAP - h
        left = clamp(a.left - r.left + a.width / 2 - w / 2, MARGIN, r.width - w - MARGIN)
      }
      s.left = `${Math.round(left)}px`
      s.top = `${Math.round(top)}px`
      el.dataset.placed = ''
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    ro.observe(host)
    return () => ro.disconnect()
  }, [anchor, root, edge])

  useEffect(() => {
    if (!autoFocus) return
    for (const selector of FOCUS_ORDER) {
      const target = ref.current?.querySelector<HTMLElement>(selector)
      if (target) {
        target.focus({ preventScroll: true })
        return
      }
    }
  }, [autoFocus])

  const setRefs = (el: HTMLDivElement | null) => {
    ref.current = el
    if (typeof panelRef === 'function') panelRef(el)
    else if (panelRef) panelRef.current = el
  }

  return (
    <div
      ref={setRefs}
      id={id}
      className={`tb-fly tb-fly--${edge}${wide ? ' tb-fly--wide' : ''}`}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="tb-fly__title" id={titleId}>
        {title}
      </div>
      {children}
    </div>
  )
}
