import type { BoardRecord, BoardTheme, Viewport } from '@shared/types'
import { zViewport } from '@shared/validation'
import type { Database } from '../db'

interface BoardRow {
  id: string
  case_id: string
  title: string
  theme: BoardTheme
  viewport_json: string
  created_at: number
  updated_at: number
  item_count: number
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

const readViewport = (json: string): Viewport => {
  try {
    const parsed = zViewport.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : { ...DEFAULT_VIEWPORT }
  } catch {
    return { ...DEFAULT_VIEWPORT }
  }
}

const toBoard = (r: BoardRow): BoardRecord => ({
  id: r.id,
  caseId: r.case_id,
  title: r.title,
  theme: r.theme,
  viewport: readViewport(r.viewport_json),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  itemCount: r.item_count
})

// Ownership is always enforced by joining through cases.user_id.
const SELECT = `SELECT b.*, (SELECT COUNT(*) FROM items i WHERE i.board_id = b.id) AS item_count
  FROM boards b JOIN cases c ON c.id = b.case_id`

export interface BoardPatch {
  title: string
  theme: BoardTheme
  viewport: Viewport
}

export function createBoardsRepo(db: Database) {
  const list = db.prepare(`${SELECT} WHERE b.case_id = ? AND c.user_id = ? ORDER BY b.updated_at DESC, b.created_at DESC`)
  const get = db.prepare(`${SELECT} WHERE b.id = ? AND c.user_id = ?`)
  const insert = db.prepare(
    `INSERT INTO boards (id, case_id, title, theme, viewport_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const update = db.prepare(
    `UPDATE boards SET title = ?, theme = ?, viewport_json = ?, updated_at = ?
     WHERE id = ? AND case_id IN (SELECT id FROM cases WHERE user_id = ?)`
  )
  const remove = db.prepare('DELETE FROM boards WHERE id = ? AND case_id IN (SELECT id FROM cases WHERE user_id = ?)')
  const touch = db.prepare('UPDATE boards SET updated_at = MAX(updated_at, ?) WHERE id = ?')

  return {
    list: (userId: string, caseId: string): BoardRecord[] =>
      (list.all(caseId, userId) as unknown as BoardRow[]).map(toBoard),
    get(userId: string, id: string): BoardRecord | null {
      const row = get.get(id, userId) as BoardRow | undefined
      return row ? toBoard(row) : null
    },
    /** The caller has already verified that `caseId` belongs to the user. */
    insert(id: string, caseId: string, title: string, theme: BoardTheme, now: number): void {
      insert.run(id, caseId, title, theme, JSON.stringify(DEFAULT_VIEWPORT), now, now)
    },
    update(userId: string, id: string, next: BoardPatch, updatedAt: number): boolean {
      return update.run(next.title, next.theme, JSON.stringify(next.viewport), updatedAt, id, userId).changes > 0
    },
    remove: (userId: string, id: string): boolean => remove.run(id, userId).changes > 0,
    touch: (id: string, now: number) => void touch.run(now, id)
  }
}

export type BoardsRepo = ReturnType<typeof createBoardsRepo>
