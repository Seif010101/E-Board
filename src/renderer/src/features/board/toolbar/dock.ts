// Dock geometry: the edges the toolbar can sit on and which one a dragged dock snaps to.
// Edges are physical (the dock stays on the left in Arabic too), like the user setting.

import type { DockEdge } from '@shared/types'

export const DOCK_EDGES: readonly DockEdge[] = ['top', 'bottom', 'left', 'right']

export const isVerticalEdge = (edge: DockEdge): boolean => edge === 'left' || edge === 'right'

/** The edge of `rect` closest to the client point (x, y). */
export function nearestEdge(rect: DOMRect, x: number, y: number): DockEdge {
  const distance: Record<DockEdge, number> = {
    top: y - rect.top,
    bottom: rect.bottom - y,
    left: x - rect.left,
    right: rect.right - x
  }
  return DOCK_EDGES.reduce((best, edge) => (distance[edge] < distance[best] ? edge : best))
}

/** Respect the user's "animations" setting and the OS reduced-motion preference. */
export const motionAllowed = (animations: boolean): boolean =>
  animations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
