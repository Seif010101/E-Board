import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

/** A callback with a stable identity that always runs the latest closure. */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}

/** Current time, refreshed periodically so relative timestamps stay accurate. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Arrow-key navigation between the focusable items of a CSS grid (attach to the grid element).
 * Columns are read from the computed grid template, so it follows responsive layouts and RTL.
 */
export function useGridKeyboard(itemSelector: string) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const grid = e.currentTarget
      const items = Array.from(grid.querySelectorAll<HTMLElement>(itemSelector))
      const index = items.indexOf(e.target as HTMLElement)
      if (index < 0) return
      const style = getComputedStyle(grid)
      const cols = Math.max(1, style.gridTemplateColumns.split(' ').filter(Boolean).length)
      const forward = style.direction === 'rtl' ? -1 : 1
      const lastRow = Math.floor((items.length - 1) / cols)
      let next: number
      switch (e.key) {
        case 'ArrowRight':
          next = index + forward
          break
        case 'ArrowLeft':
          next = index - forward
          break
        case 'ArrowDown':
          next = Math.floor(index / cols) < lastRow ? Math.min(index + cols, items.length - 1) : index
          break
        case 'ArrowUp':
          next = index - cols
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = items.length - 1
          break
        default:
          return
      }
      e.preventDefault()
      const target = items[next]
      if (!target) return
      target.focus()
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    },
    [itemSelector]
  )
}

/** Remembers the focused element before a dialog opens and restores it afterwards. */
export function useReturnFocus() {
  const ref = useRef<HTMLElement | null>(null)
  const remember = useCallback(() => {
    ref.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [])
  const restore = useCallback((fallback?: () => HTMLElement | null | undefined) => {
    const el = ref.current
    ref.current = null
    requestAnimationFrame(() => {
      if (el && el.isConnected) el.focus()
      else fallback?.()?.focus()
    })
  }, [])
  return { remember, restore }
}
