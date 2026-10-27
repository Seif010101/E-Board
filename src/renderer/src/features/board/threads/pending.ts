// Transient UI state shared by the threads layer, the connect tool and the hover label.
// Kept out of the board store so pointer moves never re-render the rest of the board.

import { create } from 'zustand'
import type { Id } from '@shared/types'
import type { Point } from '../core/types'

interface PendingLinkState {
  /** Item the thread being drawn starts from. */
  fromId: Id | null
  /** World position of the pointer while drawing. */
  cursor: Point | null
  /** Valid drop target while drawing, or the hovered connectable card while idle. */
  targetId: Id | null
}

export const usePendingLink = create<PendingLinkState>(() => ({ fromId: null, cursor: null, targetId: null }))

export const resetPendingLink = () => usePendingLink.setState({ fromId: null, cursor: null, targetId: null })

/** World point on the hovered thread closest to the pointer (anchors the hover label). */
export const useHoverPoint = create<{ linkId: Id | null; point: Point | null }>(() => ({ linkId: null, point: null }))
