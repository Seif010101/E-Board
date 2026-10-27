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
    remove: (boardId: string, id: string): boolean => remove.run(id, boardId).changes > 0
  }
}

export type ItemsRepo = ReturnType<typeof createItemsRepo>
