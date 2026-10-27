import type { KeyboardEvent } from 'react'

/**
 * Index of the radio option an arrow / Home / End key moves to (wrapping), or null for other keys.
 * Horizontal arrows follow the reading direction, so they are mirrored in right-to-left layouts.
 */
export function radioKeyTarget(e: KeyboardEvent<HTMLElement>, index: number, count: number): number | null {
  const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
  let next: number
  switch (e.key) {
    case 'ArrowRight':
      next = index + (rtl ? -1 : 1)
      break
    case 'ArrowLeft':
      next = index + (rtl ? 1 : -1)
      break
    case 'ArrowDown':
      next = index + 1
      break
    case 'ArrowUp':
      next = index - 1
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = count - 1
      break
    default:
      return null
  }
  return (next + count) % count
}
