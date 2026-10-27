// Where threads attach and which item is under a world point (for the connect tool).

import { CONNECTABLE_TYPES, type BoardItem, type Id } from '@shared/types'
import { defaultPinAnchor, getItemRenderer } from '../core/registry'
import type { Point } from '../core/types'

export const pinAnchorOf = (item: BoardItem): Point =>
  getItemRenderer(item.type)?.pinAnchor?.(item) ?? defaultPinAnchor(item)

export const isConnectable = (item: BoardItem): boolean => CONNECTABLE_TYPES.includes(item.type)

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
