import type { CaseInput } from '@shared/api'
import type { CasePriority, CaseRecord, CaseStatus } from '@shared/types'
import type { Database } from '../db'

interface CaseRow {
  id: string
  user_id: string
  title: string
  description: string
  category: string
  status: CaseStatus
  priority: CasePriority
  color: string
  created_at: number
  updated_at: number
  board_count: number
}

const toCase = (r: CaseRow): CaseRecord => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  status: r.status,
  priority: r.priority,
  color: r.color,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  boardCount: r.board_count
})

const SELECT = `SELECT c.*, (SELECT COUNT(*) FROM boards b WHERE b.case_id = c.id) AS board_count FROM cases c`

export function createCasesRepo(db: Database) {
  const list = db.prepare(`${SELECT} WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.created_at DESC`)
  const get = db.prepare(`${SELECT} WHERE c.id = ? AND c.user_id = ?`)
  const insert = db.prepare(
    `INSERT INTO cases (id, user_id, title, description, category, status, priority, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const update = db.prepare(
    `UPDATE cases SET title = ?, description = ?, category = ?, status = ?, priority = ?, color = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
  const remove = db.prepare('DELETE FROM cases WHERE id = ? AND user_id = ?')
  const touch = db.prepare('UPDATE cases SET updated_at = MAX(updated_at, ?) WHERE id = ?')

  return {
    list: (userId: string): CaseRecord[] => (list.all(userId) as unknown as CaseRow[]).map(toCase),
    get(userId: string, id: string): CaseRecord | null {
      const row = get.get(id, userId) as CaseRow | undefined
      return row ? toCase(row) : null
    },
    insert(userId: string, id: string, input: CaseInput, now: number): void {
      insert.run(id, userId, input.title, input.description, input.category, input.status, input.priority, input.color, now, now)
    },
    update(userId: string, id: string, next: CaseInput, now: number): boolean {
      const r = update.run(next.title, next.description, next.category, next.status, next.priority, next.color, now, id, userId)
      return r.changes > 0
    },
    remove: (userId: string, id: string): boolean => remove.run(id, userId).changes > 0,
    /** Bumps updated_at; the caller has already verified ownership. */
    touch: (id: string, now: number) => void touch.run(now, id)
  }
}

export type CasesRepo = ReturnType<typeof createCasesRepo>
