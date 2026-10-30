import type { LinkRecord, RelationKind } from '@shared/types'
import type { Database } from '../db'

interface LinkRow {
  id: string
  board_id: string
  from_id: string
  to_id: string
  kind: RelationKind
  label: string
  color: string | null
  via_json: string
  created_at: number
  updated_at: number
}

const toLink = (r: LinkRow): LinkRecord => ({
  id: r.id,
  boardId: r.board_id,
  fromId: r.from_id,
  toId: r.to_id,
  kind: r.kind,
  label: r.label,
  color: r.color,
  via: JSON.parse(r.via_json) as [number, number][],
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

export function createLinksRepo(db: Database) {
  const list = db.prepare('SELECT * FROM links WHERE board_id = ? ORDER BY created_at ASC')
  const boardOf = db.prepare('SELECT board_id FROM links WHERE id = ?')
  const upsert = db.prepare(
    `INSERT INTO links (id, board_id, from_id, to_id, kind, label, color, via_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       from_id = excluded.from_id, to_id = excluded.to_id, kind = excluded.kind, label = excluded.label,
       color = excluded.color, via_json = excluded.via_json, updated_at = excluded.updated_at
     WHERE links.board_id = excluded.board_id`
  )
  const remove = db.prepare('DELETE FROM links WHERE id = ? AND board_id = ?')
  const ends = db.prepare('SELECT from_id, to_id FROM links WHERE id = ?')

  return {
    list: (boardId: string): LinkRecord[] => (list.all(boardId) as unknown as LinkRow[]).map(toLink),
    boardOf: (id: string): string | null => (boardOf.get(id) as { board_id: string } | undefined)?.board_id ?? null,
    endsOf: (id: string): { fromId: string; toId: string } | null => {
      const r = ends.get(id) as { from_id: string; to_id: string } | undefined
      return r ? { fromId: r.from_id, toId: r.to_id } : null
    },
    upsert(link: LinkRecord): void {
      upsert.run(
        link.id,
        link.boardId,
        link.fromId,
        link.toId,
        link.kind,
        link.label,
        link.color,
        JSON.stringify(link.via),
        link.createdAt,
        link.updatedAt
      )
    },
    remove: (boardId: string, id: string): boolean => remove.run(id, boardId).changes > 0
  }
}

export type LinksRepo = ReturnType<typeof createLinksRepo>
