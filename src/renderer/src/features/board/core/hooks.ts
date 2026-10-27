import { useLayoutEffect, useRef } from 'react'
import type { Id } from '@shared/types'
import { board } from './store'

/**
 * Keeps item.h in sync with the rendered content height (for cards whose height depends on content,
 * e.g. the expandable "More" section). Attach the returned ref to the element whose height
 * defines the card. Height updates are not recorded in undo history.
 */
export function useAutoHeight<E extends HTMLElement>(id: Id, currentH: number) {
  const ref = useRef<E>(null)
  const hRef = useRef(currentH)
  hRef.current = currentH

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => {
      // offsetHeight is unaffected by the canvas zoom transform (layout px, not screen px).
      const h = Math.ceil(el.offsetHeight)
      if (h > 0 && Math.abs(h - hRef.current) > 1) board().updateItem(id, { h }, { history: false })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [id])

  return ref
}
