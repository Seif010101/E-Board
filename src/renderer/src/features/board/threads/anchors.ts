// Where threads attach and which item is under a world point (for the connect tool).

import { CONNECTABLE_TYPES, type BoardItem, type Id } from '@shared/types'
import { lineEndsOf } from '../canvas/SelectionOverlay'
import type { Point } from '../core/types'

export const isConnectable = (item: BoardItem): boolean => CONNECTABLE_TYPES.includes(item.type)

export const centerOf = (item: Pick<BoardItem, 'x' | 'y' | 'w' | 'h'>): Point => ({ x: item.x + item.w / 2, y: item.y + item.h / 2 })

/**
 * Attachment point on `item` for a thread heading toward `toward`: the middle of the side facing
 * it (left / right / top / bottom of the possibly tilted card). Lines and arrows attach at their middle.
 */
export function anchorToward(item: BoardItem, toward: Point): Point {
  const ends = lineEndsOf(item)
  if (ends) return { x: (ends[0].x + ends[1].x) / 2, y: (ends[0].y + ends[1].y) / 2 }
  const c = centerOf(item)
  const rad = (item.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // Direction to the target in the card's own (untilted) frame.
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  const lx = dx * cos + dy * sin
  const ly = -dx * sin + dy * cos
  const halfW = item.w / 2
  const halfH = item.h / 2
  // Compare in units of the half sizes, so a wide card prefers its long sides sensibly.
  const horizontal = Math.abs(lx) / halfW >= Math.abs(ly) / halfH
  const local = horizontal ? { x: Math.sign(lx || 1) * halfW, y: 0 } : { x: 0, y: Math.sign(ly || 1) * halfH }
  return { x: c.x + local.x * cos - local.y * sin, y: c.y + local.x * sin + local.y * cos }
}

/** Both ends of a thread between two items, each facing the next point of the thread. */
export function threadEnds(from: BoardItem, to: BoardItem, via: readonly Point[]): { a: Point; b: Point } {
  return {
    a: anchorToward(from, via[0] ?? centerOf(to)),
    b: anchorToward(to, via[via.length - 1] ?? centerOf(from))
  }
}

/** Point inside the item's (possibly tilted) frame, with a small tolerance in world px. */
const containsPoint = (item: BoardItem, p: Point, pad: number): boolean => {
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  const rad = (-item.rotation * Math.PI) / 180
  const dx = p.x - cx
  const dy = p.y - cy
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
  return Math.abs(lx) <= item.w / 2 + pad && Math.abs(ly) <= item.h / 2 + pad
}

/**
 * Topmost connectable item at `p`. The whole card frame counts (not a precise outline), which is
 * the forgiving behaviour you want when aiming a thread.
 */
export function connectableItemAt(items: Record<Id, BoardItem>, p: Point, pad = 0): BoardItem | null {
  let best: BoardItem | null = null
  for (const item of Object.values(items)) {
    if (!isConnectable(item)) continue
    if (best && (item.z < best.z || (item.z === best.z && item.createdAt < best.createdAt))) continue
    if (containsPoint(item, p, pad)) best = item
  }
  return best
}
