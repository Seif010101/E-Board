import type { BoardItem } from '@shared/types'
import type { Database } from '../db'

interface ItemRow {
  id: string
  board_id: string
  type: BoardItem['type']
  x: number
  y: number
  w: number
  h: number
  z: number
  rotation: number
  locked: number
  data_json: string
  pin_hash: string | null
  created_at: number
  updated_at: number
}

// Rows are only ever written from schema-validated items, so the JSON is trusted on the way out.
const toItem = (r: ItemRow): BoardItem =>
  ({
    id: r.id,
    boardId: r.board_id,
    type: r.type,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    z: r.z,
    rotation: r.rotation,
    locked: r.locked === 1,
    pinLocked: r.pin_hash !== null,
    data: JSON.parse(r.data_json),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }) as BoardItem

export function createItemsRepo(db: Database) {
  const list = db.prepare('SELECT * FROM items WHERE board_id = ? ORDER BY z ASC, created_at ASC')
  const boardOf = db.prepare('SELECT board_id FROM items WHERE id = ?')
  const exists = db.prepare('SELECT 1 AS found FROM items WHERE id = ? AND board_id = ?')
  // created_at is kept from the first insert; the WHERE guard never lets an upsert move an item across boards.
  const upsert = db.prepare(
    `INSERT INTO items (id, board_id, type, x, y, w, h, z, rotation, locked, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type, x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, z = excluded.z,
       rotation = excluded.rotation, locked = excluded.locked, data_json = excluded.data_json,
       updated_at = excluded.updated_at
     WHERE items.board_id = excluded.board_id`
  )
  const remove = db.prepare('DELETE FROM items WHERE id = ? AND board_id = ?')
  const pinOf = db.prepare('SELECT pin_hash, pin_fails, pin_blocked_until FROM items WHERE id = ? AND board_id = ?')
  const pinLockedAny = db.prepare('SELECT 1 AS found FROM items WHERE id = ? AND pin_hash IS NOT NULL')
  const pinLockedOnBoard = db.prepare('SELECT 1 AS found FROM items WHERE board_id = ? AND pin_hash IS NOT NULL LIMIT 1')
  const pinLockedInCase = db.prepare(
    'SELECT 1 AS found FROM items WHERE pin_hash IS NOT NULL AND board_id IN (SELECT id FROM boards WHERE case_id = ?) LIMIT 1'
  )
  const setPin = db.prepare(
    `UPDATE items SET pin_hash = ?, locked = 1, pin_fails = 0, pin_blocked_until = 0, updated_at = ?
     WHERE id = ? AND board_id = ? AND pin_hash IS NULL`
  )
  const clearPin = db.prepare(
    `UPDATE items SET pin_hash = NULL, locked = 0, pin_fails = 0, pin_blocked_until = 0, updated_at = ?
     WHERE id = ? AND board_id = ?`
  )
  const failPin = db.prepare('UPDATE items SET pin_fails = ?, pin_blocked_until = ? WHERE id = ? AND board_id = ?')

  return {
    list: (boardId: string): BoardItem[] => (list.all(boardId) as unknown as ItemRow[]).map(toItem),
    boardOf: (id: string): string | null => (boardOf.get(id) as { board_id: string } | undefined)?.board_id ?? null,
    existsOnBoard: (boardId: string, id: string): boolean => exists.get(id, boardId) !== undefined,
    upsert(item: BoardItem): void {
      upsert.run(
        item.id,
        item.boardId,
        item.type,
        item.x,
        item.y,
        item.w,
        item.h,
        item.z,
        item.rotation,
        item.locked ? 1 : 0,
        JSON.stringify(item.data),
        item.createdAt,
        item.updatedAt
      )
    },
    remove: (boardId: string, id: string): boolean => remove.run(id, boardId).changes > 0,

    /** PIN state of an item on the board, or null when the item does not exist there. */
    pinState: (boardId: string, id: string): { hash: string | null; fails: number; blockedUntil: number } | null => {
      const r = pinOf.get(id, boardId) as { pin_hash: string | null; pin_fails: number; pin_blocked_until: number } | undefined
      return r ? { hash: r.pin_hash, fails: r.pin_fails, blockedUntil: r.pin_blocked_until } : null
    },
    isPinLocked: (id: string): boolean => pinLockedAny.get(id) !== undefined,
    boardHasPinLocked: (boardId: string): boolean => pinLockedOnBoard.get(boardId) !== undefined,
    caseHasPinLocked: (caseId: string): boolean => pinLockedInCase.get(caseId) !== undefined,
    lockWithPin: (boardId: string, id: string, hash: string, at: number): boolean => setPin.run(hash, at, id, boardId).changes > 0,
    clearPin: (boardId: string, id: string, at: number): void => void clearPin.run(at, id, boardId),
    recordPinFailure: (boardId: string, id: string, fails: number, blockedUntil: number): void =>
      void failPin.run(fails, blockedUntil, id, boardId)
  }
}

export type ItemsRepo = ReturnType<typeof createItemsRepo>
