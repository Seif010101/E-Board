// Cases, boards and the board change-set writer. Every operation is scoped to the calling user;
// ids that belong to someone else behave exactly like ids that do not exist.

import { randomUUID } from 'node:crypto'
import type { CaseInput } from '@shared/api'
import type { BoardBundle, BoardChanges, BoardItem, BoardRecord, BoardTheme, CaseRecord, Viewport } from '@shared/types'
import { transaction, type Database } from '../db'
import { AppError, fail } from '../errors'
import { hashPassword, verifyPassword } from '../password'
import { createBoardsRepo } from '../repos/boards'
import { createCasesRepo } from '../repos/cases'
import { createItemsRepo } from '../repos/items'
import { createLinksRepo } from '../repos/links'
import { createMediaRepo } from '../repos/media'

const BAD_REFERENCE = ['validation.invalid_id']

/** Wrong PINs: after this many, further attempts on the item wait, doubling each time. */
const PIN_FREE_ATTEMPTS = 5
const PIN_BASE_BLOCK_MS = 60_000
const PIN_MAX_BLOCK_MS = 15 * 60_000

/** Media ids an item points at; these must belong to the board's owner. */
export function mediaIdsOf(item: BoardItem): string[] {
  switch (item.type) {
    case 'person':
      return [...(item.data.photoMediaId ? [item.data.photoMediaId] : []), ...item.data.album.map((a) => a.mediaId)]
    case 'company':
      return item.data.logoMediaId ? [item.data.logoMediaId] : []
    case 'entity':
      return item.data.mediaId ? [item.data.mediaId] : []
    case 'image':
      return [item.data.mediaId]
    default:
      return []
  }
}

const defined = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>

export function createWorkspaceService({ db, now = Date.now }: { db: Database; now?: () => number }) {
  const cases = createCasesRepo(db)
  const boards = createBoardsRepo(db)
  const items = createItemsRepo(db)
  const links = createLinksRepo(db)
  const media = createMediaRepo(db)

  const ownedCase = (userId: string, id: string): CaseRecord => cases.get(userId, id) ?? fail('not_found')
  const ownedBoard = (userId: string, id: string): BoardRecord => boards.get(userId, id) ?? fail('not_found')

  return {
    listCases: (userId: string): CaseRecord[] => cases.list(userId),

    createCase(userId: string, input: CaseInput): CaseRecord {
      const id = randomUUID()
      cases.insert(userId, id, input, now())
      return ownedCase(userId, id)
    },

    updateCase(userId: string, input: Partial<CaseInput> & { id: string }): CaseRecord {
      const { id, ...patch } = input
      const current = ownedCase(userId, id)
      const next: CaseInput = {
        title: current.title,
        description: current.description,
        category: current.category,
        status: current.status,
        priority: current.priority,
        color: current.color,
        ...defined(patch)
      }
      if (!cases.update(userId, id, next, now())) fail('not_found')
      return ownedCase(userId, id)
    },

    removeCase(userId: string, id: string): null {
      ownedCase(userId, id)
      // Deleting around a PIN lock would be a way to destroy what the PIN protects.
      if (items.caseHasPinLocked(id)) fail('pin_locked')
      if (!cases.remove(userId, id)) fail('not_found')
      return null
    },

    listBoards(userId: string, caseId: string): BoardRecord[] {
      ownedCase(userId, caseId)
      return boards.list(userId, caseId)
    },

    createBoard(userId: string, input: { caseId: string; title: string; theme: BoardTheme }): BoardRecord {
      const id = randomUUID()
      transaction(db, () => {
        ownedCase(userId, input.caseId)
        const t = now()
        boards.insert(id, input.caseId, input.title, input.theme, t)
        cases.touch(input.caseId, t)
      })
      return ownedBoard(userId, id)
    },

    updateBoard(userId: string, input: { id: string; title?: string; theme?: BoardTheme; viewport?: Viewport }): BoardRecord {
      transaction(db, () => {
        const current = ownedBoard(userId, input.id)
        const next = {
          title: input.title ?? current.title,
          theme: input.theme ?? current.theme,
          viewport: input.viewport ?? current.viewport
        }
        // The viewport is view state, not content: panning must not reorder "recently modified" lists.
        const contentChanged = next.title !== current.title || next.theme !== current.theme
        const t = now()
        boards.update(userId, input.id, next, contentChanged ? t : current.updatedAt)
        if (contentChanged) cases.touch(current.caseId, t)
      })
      return ownedBoard(userId, input.id)
    },

    removeBoard(userId: string, id: string): null {
      transaction(db, () => {
        const current = ownedBoard(userId, id)
        if (items.boardHasPinLocked(id)) fail('pin_locked')
        boards.remove(userId, id)
        cases.touch(current.caseId, now())
      })
      return null
    },

    loadBoard(userId: string, id: string): BoardBundle {
      const board = ownedBoard(userId, id)
      return {
        caseRecord: ownedCase(userId, board.caseId),
        board,
        items: items.list(id),
        links: links.list(id)
      }
    },

    /**
     * Applies one change-set atomically. Any invalid record rejects (and rolls back) the whole batch.
     * `changes` must already be the parsed output of `schemas.boardChanges`.
     */
    applyChanges(userId: string, changes: BoardChanges): null {
      const { boardId } = changes
      const reject = (): never => fail('invalid_input', BAD_REFERENCE)

      if (changes.upsertItems.some((i) => i.boardId !== boardId)) reject()
      if (changes.upsertLinks.some((l) => l.boardId !== boardId)) reject()
      const deletedItems = new Set(changes.deleteItemIds)
      const deletedLinks = new Set(changes.deleteLinkIds)
      if (changes.upsertItems.some((i) => deletedItems.has(i.id))) reject()
      if (changes.upsertLinks.some((l) => deletedLinks.has(l.id))) reject()

      transaction(db, () => {
        const board = ownedBoard(userId, boardId)

        // PIN-locked items (and the threads attached to them) cannot be changed or deleted, whatever
        // the renderer sends: the whole batch is refused.
        for (const id of [...deletedItems, ...changes.upsertItems.map((i) => i.id)]) {
          if (items.isPinLocked(id)) fail('pin_locked')
        }
        for (const link of changes.upsertLinks) {
          if (items.isPinLocked(link.fromId) || items.isPinLocked(link.toId)) fail('pin_locked')
        }
        for (const id of deletedLinks) {
          const ends = links.endsOf(id)
          if (!ends) continue
          // A thread that goes with a deleted (unlocked) item is fine; deleting it on its own is not.
          const goesWithItem = deletedItems.has(ends.fromId) || deletedItems.has(ends.toId)
          if (!goesWithItem && (items.isPinLocked(ends.fromId) || items.isPinLocked(ends.toId))) fail('pin_locked')
        }

        for (const item of changes.upsertItems) {
          const owner = items.boardOf(item.id)
          if (owner !== null && owner !== boardId) reject()
          for (const mediaId of mediaIdsOf(item)) if (!media.ownedBy(userId, mediaId)) reject()
        }
        for (const link of changes.upsertLinks) {
          const owner = links.boardOf(link.id)
          if (owner !== null && owner !== boardId) reject()
        }

        for (const id of deletedLinks) links.remove(boardId, id)
        // Deleting an item cascades to every thread attached to it.
        for (const id of deletedItems) items.remove(boardId, id)
        for (const item of changes.upsertItems) items.upsert(item)
        for (const link of changes.upsertLinks) {
          if (link.fromId === link.toId) reject()
          if (!items.existsOnBoard(boardId, link.fromId) || !items.existsOnBoard(boardId, link.toId)) reject()
          links.upsert(link)
        }

        const touched = changes.upsertItems.length + changes.upsertLinks.length + deletedItems.size + deletedLinks.size
        if (touched > 0) {
          const t = now()
          boards.touch(boardId, t)
          cases.touch(board.caseId, t)
        }
      })
      return null
    },

    /** Locks the item and protects it with `pin` (the stored value is a salted scrypt hash). */
    async lockItemWithPin(userId: string, input: { boardId: string; itemId: string; pin: string }): Promise<null> {
      ownedBoard(userId, input.boardId)
      const state = items.pinState(input.boardId, input.itemId) ?? fail('not_found')
      if (state.hash !== null) fail('pin_locked')
      const hash = await hashPassword(input.pin)
      transaction(db, () => {
        if (!items.lockWithPin(input.boardId, input.itemId, hash, now())) fail('pin_locked')
        boards.touch(input.boardId, now())
      })
      return null
    },

    /** Removes the lock and the PIN. Failures are counted per item and stay counted across restarts. */
    async unlockItemWithPin(userId: string, input: { boardId: string; itemId: string; pin: string }): Promise<null> {
      ownedBoard(userId, input.boardId)
      const state = items.pinState(input.boardId, input.itemId) ?? fail('not_found')
      if (state.hash === null) return null
      const wait = state.blockedUntil - now()
      if (wait > 0) throw new AppError('rate_limited', undefined, wait)
      if (!(await verifyPassword(input.pin, state.hash))) {
        const fails = state.fails + 1
        const blockMs =
          fails >= PIN_FREE_ATTEMPTS ? Math.min(PIN_BASE_BLOCK_MS * 2 ** Math.min(fails - PIN_FREE_ATTEMPTS, 20), PIN_MAX_BLOCK_MS) : 0
        items.recordPinFailure(input.boardId, input.itemId, fails, blockMs ? now() + blockMs : 0)
        if (blockMs) throw new AppError('rate_limited', undefined, blockMs)
        fail('invalid_pin')
      }
      transaction(db, () => {
        items.clearPin(input.boardId, input.itemId, now())
        boards.touch(input.boardId, now())
      })
      return null
    }
  }
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>
