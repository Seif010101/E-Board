import { useCallback, useEffect, useRef } from 'react'
import { board } from '../../core/store'

/**
 * Groups a continuous control gesture (dragging a slider) into one undo step.
 * The transaction is always closed: on `end`, on window pointerup/cancel, and on unmount.
 */
export function useTxGesture(): { start(): void; end(): void } {
  const open = useRef(false)

  const end = useCallback(() => {
    if (!open.current) return
    open.current = false
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    board().endTx()
  }, [])

  const start = useCallback(() => {
    if (open.current) return
    open.current = true
    board().beginTx()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }, [end])

  useEffect(() => end, [end])

  return { start, end }
}
