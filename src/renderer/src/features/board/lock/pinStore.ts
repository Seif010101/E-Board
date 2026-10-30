// Lock / unlock with a PIN. The PIN is checked (and the lock enforced) by the main process; this
// module only asks for it and mirrors the result into the board.

import { create } from 'zustand'
import type { Id } from '@shared/types'
import { api, call } from '@renderer/lib/api'
import { board } from '../core/store'
import { flush } from '../core/persistence'

export type PinRequest = { mode: 'lock' | 'unlock'; ids: Id[] }

export const usePinRequest = create<{ request: PinRequest | null }>(() => ({ request: null }))

export const askLockWithPin = (ids: Id[]): void => {
  if (ids.length) usePinRequest.setState({ request: { mode: 'lock', ids } })
}
export const askUnlock = (ids: Id[]): void => {
  if (ids.length) usePinRequest.setState({ request: { mode: 'unlock', ids } })
}
export const closePinRequest = (): void => usePinRequest.setState({ request: null })

/**
 * Applies the request for every item. Pending edits are saved first so the lock is never set under
 * unsaved changes. Stops at the first failure (wrong PIN, too many attempts).
 */
export async function runPinRequest(request: PinRequest, pin: string): Promise<void> {
  const boardId = board().board?.id
  if (!boardId) return
  await flush()
  for (const itemId of request.ids) {
    const item = board().items[itemId]
    if (!item) continue
    if (request.mode === 'lock') {
      if (item.pinLocked) continue
      await call(api.items.lockWithPin({ boardId, itemId, pin }))
      board().syncItemLock(itemId, { locked: true, pinLocked: true })
    } else {
      if (!item.pinLocked) continue
      await call(api.items.unlockWithPin({ boardId, itemId, pin }))
      board().syncItemLock(itemId, { locked: false, pinLocked: false })
    }
  }
}
