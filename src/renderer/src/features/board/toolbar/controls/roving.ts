import type { KeyboardEvent } from 'react'

const isRtl = (el: Element): boolean => getComputedStyle(el).direction === 'rtl'

/**
 * Arrow-key navigation for a radio group (selection follows focus, as ARIA radio groups expect).
 * Attach to the element carrying role="radiogroup"; it moves between its [role="radio"] children.
 */
export function onRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)'))
  if (radios.length === 0) return
  const current = radios.indexOf(document.activeElement as HTMLElement)
  const rtl = isRtl(e.currentTarget)
  let next: number
  switch (e.key) {
    case 'ArrowDown':
      next = current + 1
      break
    case 'ArrowUp':
      next = current - 1
      break
    case 'ArrowRight':
      next = rtl ? current - 1 : current + 1
      break
    case 'ArrowLeft':
      next = rtl ? current + 1 : current - 1
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = radios.length - 1
      break
    default:
      return
  }
  e.preventDefault()
  e.stopPropagation()
  const target = radios[(next + radios.length) % radios.length]
  target.focus()
  target.click()
}

/** Roving tab index: the checked radio is the group's single tab stop (the first one when none is). */
export const radioTabIndex = (checked: boolean, index: number, anyChecked: boolean): number =>
  checked || (!anyChecked && index === 0) ? 0 : -1
