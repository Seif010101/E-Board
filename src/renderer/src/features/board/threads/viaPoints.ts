// Waypoints of a thread: add one by double-clicking the thread, drag to move, double-click to remove.

import type { Id, LinkRecord } from '@shared/types'
import { LIMITS } from '@shared/validation'
import { board } from '../core/store'
import type { Point } from '../core/types'
import { threadEnds } from './anchors'
import { nearestOnThread, threadShape, type ThreadShape } from './geometry'

const round = (n: number): number => Math.round(n * 100) / 100

/** The thread as drawn right now (without the spreading of parallel threads). */
export function shapeOfLink(link: LinkRecord): ThreadShape | null {
  const s = board()
  const from = s.items[link.fromId]
  const to = s.items[link.toId]
  if (!from || !to) return null
  const via = link.via.map(([x, y]) => ({ x, y }))
  const { a, b } = threadEnds(from, to, via)
  return threadShape(s.board?.theme ?? 'normal', a, b, 0, 1, via)
}

/** Adds a waypoint on the thread, at the point of it nearest `near`. */
export function addViaPoint(linkId: Id, near: Point): number | null {
  const s = board()
  const link = s.links[linkId]
  if (!link || link.via.length >= LIMITS.threadPoints) return null
  const shape = shapeOfLink(link)
  if (!shape) return null
  const { point, index } = nearestOnThread(shape, near)
  const via = [...link.via]
  via.splice(index, 0, [round(point.x), round(point.y)])
  s.updateLink(linkId, { via })
  return index
}

export function moveViaPoint(linkId: Id, index: number, to: Point): void {
  const link = board().links[linkId]
  if (!link || index < 0 || index >= link.via.length) return
  const via = link.via.map((p, i): [number, number] => (i === index ? [round(to.x), round(to.y)] : p))
  board().updateLink(linkId, { via })
}

export function removeViaPoint(linkId: Id, index: number): void {
  const link = board().links[linkId]
  if (!link || index < 0 || index >= link.via.length) return
  board().updateLink(linkId, { via: link.via.filter((_, i) => i !== index) })
}
