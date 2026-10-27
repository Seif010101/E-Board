// Drawer navigation helpers.
//
// While the drawer is open it follows the board selection (click another card → its details).
// Selections made from inside the drawer (locate an employee, highlight a thread) are "quiet" so
// the drawer keeps showing the form the user is working in. Opening another target from inside the
// drawer remembers where to come back to.

import { create } from 'zustand'
import type { Id } from '@shared/types'
import { board, useBoard } from '../core/store'
import { canvasSize, getCanvasElement } from '../core/geometry'
import type { InspectorTarget } from '../core/types'
import { animateViewport } from '../cards/common/focus'

let quietDepth = 0
let navigating = false
let drawerEl: HTMLElement | null = null

/** Run a store change without the drawer reacting to the selection it causes. */
export function quietly(fn: () => void): void {
  quietDepth++
  try {
    fn()
  } finally {
    quietDepth--
  }
}

export const isQuiet = (): boolean => quietDepth > 0

export const setDrawerElement = (el: HTMLElement | null): void => {
  drawerEl = el
}

export const useInspectorNav = create<{ returnTo: InspectorTarget | null }>(() => ({ returnTo: null }))

const alive = (target: InspectorTarget): boolean => {
  const s = board()
  return target.kind === 'item' ? !!s.items[target.id] : !!s.links[target.id]
}

/** Open another target from inside the drawer; the header then offers "Back". */
export function openFromInspector(target: InspectorTarget): void {
  const current = board().inspector
  navigating = true
  try {
    quietly(() => {
      if (target.kind === 'link') board().selectLink(target.id)
      else board().setSelection([target.id])
      board().openInspector(target)
    })
    useInspectorNav.setState({ returnTo: current })
  } finally {
    navigating = false
  }
}

export function goBack(): void {
  const target = useInspectorNav.getState().returnTo
  useInspectorNav.setState({ returnTo: null })
  if (!target || !alive(target)) return
  navigating = true
  try {
    quietly(() => {
      if (target.kind === 'item') board().setSelection([target.id])
      board().openInspector(target)
    })
  } finally {
    navigating = false
  }
}

// Any other change of target (closing, double-clicking another card…) forgets the way back.
useBoard.subscribe((s, prev) => {
  if (s.inspector !== prev.inspector && !navigating && useInspectorNav.getState().returnTo) {
    useInspectorNav.setState({ returnTo: null })
  }
})

/** Select an item and pan so it sits in the middle of the part of the canvas the drawer leaves visible. */
export function locateItem(id: Id): void {
  const s = board()
  const item = s.items[id]
  if (!item) return
  quietly(() => s.setSelection([id]))
  const { w, h } = canvasSize()
  let left = 0
  let right = w
  const canvas = getCanvasElement()
  if (canvas && drawerEl) {
    const c = canvas.getBoundingClientRect()
    const d = drawerEl.getBoundingClientRect()
    const overlaps = d.right > c.left && d.left < c.right
    if (overlaps) {
      if (d.left - c.left > c.right - d.right) right = Math.max(w / 3, d.left - c.left)
      else left = Math.min((w * 2) / 3, d.right - c.left)
    }
  }
  const zoom = s.viewport.zoom < 0.5 ? 0.8 : s.viewport.zoom
  animateViewport({
    zoom,
    x: (left + right) / 2 - (item.x + item.w / 2) * zoom,
    y: h / 2 - (item.y + item.h / 2) * zoom
  })
}
