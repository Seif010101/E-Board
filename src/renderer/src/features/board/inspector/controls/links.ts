import type { Id, LinkRecord } from '@shared/types'
import { board } from '../../core/store'

/** The end of a thread that is not `id`. */
export const otherEnd = (link: LinkRecord, id: Id): Id => (link.fromId === id ? link.toId : link.fromId)

/** Thread joins a and b, in either direction. */
export const connects = (link: LinkRecord, a: Id, b: Id): boolean =>
  (link.fromId === a && link.toId === b) || (link.fromId === b && link.toId === a)

export const linksBetween = (a: Id, b: Id): LinkRecord[] => Object.values(board().links).filter((l) => connects(l, a, b))

/** Run several store changes as a single undo step. */
export function inTx<T>(fn: () => T): T {
  const s = board()
  s.beginTx()
  try {
    return fn()
  } finally {
    s.endTx()
  }
}
