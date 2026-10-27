// Thread anchor of the card faces: the pin head, which follows the card's tilt.

import type { ItemBase } from '@shared/types'
import { defaultPinAnchor } from '../../core/registry'
import type { Point } from '../../core/types'

/**
 * The pin is drawn at the default anchor (top centre, 12px down) in the card's own coordinates.
 * The frame rotates the card about its centre, so the anchor is rotated the same way.
 */
export function pinAnchor(item: Pick<ItemBase, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Point {
  const p = defaultPinAnchor(item)
  if (!item.rotation) return p
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  const rad = (item.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - cx
  const dy = p.y - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}
