// Debounced auto-save of the board store to the main process.

import type { BoardItem, LinkRecord } from '@shared/types'
import { api, ApiError, call } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import i18n from '@renderer/i18n'
import { useSession } from '@renderer/stores/session'
import { board, hasUnsavedChanges, useBoard } from './store'

const DEBOUNCE_MS = 500
const RETRY_MS = 5000

let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let lastErrorToast = 0

const schedule = (ms = DEBOUNCE_MS) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, ms)
}

const notifyError = (err: unknown) => {
  // Avoid a toast storm while offline/failing repeatedly.
  if (Date.now() - lastErrorToast < 10_000) return
  lastErrorToast = Date.now()
  const detail = err instanceof ApiError && err.details.length ? `: ${err.details.map((d) => i18n.t(d)).join(', ')}` : ''
  toast.error(`${i18n.t('board.save_failed', { defaultValue: 'Could not save changes' })}${detail}`)
}

async function saveItemsAndLinks(itemIds: string[], linkIds: string[]): Promise<string[]> {
  const s = board()
  const boardId = s.board!.id
  const upsertItems: BoardItem[] = []
  const deleteItemIds: string[] = []
  for (const id of itemIds) {
    const item = s.items[id]
    if (item) upsertItems.push(item)
    else deleteItemIds.push(id)
  }
  const upsertLinks: LinkRecord[] = []
  const deleteLinkIds: string[] = []
  for (const id of linkIds) {
    const link = s.links[id]
    if (link) upsertLinks.push(link)
    else deleteLinkIds.push(id)
  }
  try {
    await call(api.boards.applyChanges({ boardId, upsertItems, deleteItemIds, upsertLinks, deleteLinkIds }))
    return []
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== 'invalid_input' || upsertItems.length + upsertLinks.length <= 1) throw err
    // One bad record must not block the rest: retry individually and report the rejects.
    const rejected: string[] = []
    if (deleteItemIds.length || deleteLinkIds.length) {
      await call(api.boards.applyChanges({ boardId, upsertItems: [], deleteItemIds, upsertLinks: [], deleteLinkIds }))
    }
    for (const item of upsertItems) {
      try {
        await call(api.boards.applyChanges({ boardId, upsertItems: [item], deleteItemIds: [], upsertLinks: [], deleteLinkIds: [] }))
      } catch {
        rejected.push(item.id)
      }
    }
    for (const link of upsertLinks) {
      try {
        await call(api.boards.applyChanges({ boardId, upsertItems: [], deleteItemIds: [], upsertLinks: [link], deleteLinkIds: [] }))
      } catch {
        rejected.push(link.id)
      }
    }
    if (rejected.length) notifyError(err)
    return rejected
  }
}

/**
 * Save everything dirty right now. Safe to call concurrently: while a save is running the call
 * waits for it and then saves whatever changed meanwhile, so awaiting it covers every edit made
 * before the call.
 */
export function flush(): Promise<void> {
  if (inflight) return inflight.then(() => flush())
  const run = async () => {
    const s = board()
    if (!s.board) return
    const d = s.takeDirty()
    if (!d.itemIds.length && !d.linkIds.length && !d.boardMeta && !d.viewport) return
    s.setSaveStatus('saving')
    try {
      if (d.itemIds.length || d.linkIds.length) await saveItemsAndLinks(d.itemIds, d.linkIds)
      if (d.boardMeta || d.viewport) {
        const b = board().board!
        await call(
          api.boards.update({
            id: b.id,
            ...(d.boardMeta ? { title: b.title, theme: b.theme } : {}),
            ...(d.viewport ? { viewport: board().viewport } : {})
          })
        )
      }
      board().setSaveStatus('saved')
    } catch (err) {
      board().restoreDirty(d)
      board().setSaveStatus('error')
      notifyError(err)
      schedule(RETRY_MS)
    }
  }
  inflight = run().finally(() => {
    inflight = null
  })
  return inflight
}

/** Subscribe to store changes and auto-save. Returns a stop function that flushes pending work. */
export function startPersistence(): () => Promise<void> {
  const unsub = useBoard.subscribe((s, prev) => {
    if (s.dirtyVersion !== prev.dirtyVersion && s.board) schedule()
  })
  // Closing the window waits for the final save: a prevented beforeunload cancels the close in
  // Electron (no prompt is shown), and the window is closed again once everything is stored. If
  // that save fails the window stays open with the error shown, and the next close goes through.
  let letClose = false
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (letClose || useSession.getState().locked || (!inflight && !hasUnsavedChanges())) return
    e.preventDefault()
    letClose = true
    void flush().then(() => {
      if (!hasUnsavedChanges()) window.close()
    })
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  return async () => {
    unsub()
    window.removeEventListener('beforeunload', onBeforeUnload)
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    await flush()
  }
}
