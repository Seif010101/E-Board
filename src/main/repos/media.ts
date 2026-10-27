import type { ImageMime, MediaRef } from '@shared/types'
import type { Database } from '../db'

interface MediaRow {
  id: string
  mime: ImageMime
  size: number
  width: number
  height: number
}

const toRef = (r: MediaRow): MediaRef => ({ id: r.id, mime: r.mime, size: r.size, width: r.width, height: r.height })

export interface NewMedia extends MediaRef {
  userId: string
  sha256: string
  bytes: Uint8Array
  now: number
}

/** JSON paths inside items.data_json that reference media (person, company, entity / image). */
const MEDIA_REFERENCE = `media.id IN (
  json_extract(i.data_json, '$.photoMediaId'),
  json_extract(i.data_json, '$.logoMediaId'),
  json_extract(i.data_json, '$.mediaId'))`

export function createMediaRepo(db: Database) {
  const bySha = db.prepare('SELECT id, mime, size, width, height FROM media WHERE user_id = ? AND sha256 = ?')
  const insert = db.prepare(
    `INSERT INTO media (id, user_id, mime, size, width, height, sha256, bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const content = db.prepare('SELECT mime, bytes FROM media WHERE id = ? AND user_id = ?')
  const owned = db.prepare('SELECT 1 AS found FROM media WHERE id = ? AND user_id = ?')
  const pruneOrphans = db.prepare(
    `DELETE FROM media WHERE created_at < ? AND NOT EXISTS (
       SELECT 1 FROM items i
       JOIN boards b ON b.id = i.board_id
       JOIN cases c ON c.id = b.case_id
       WHERE c.user_id = media.user_id AND ${MEDIA_REFERENCE})`
  )

  return {
    findBySha(userId: string, sha256: string): MediaRef | null {
      const row = bySha.get(userId, sha256) as MediaRow | undefined
      return row ? toRef(row) : null
    },
    insert(m: NewMedia): void {
      insert.run(m.id, m.userId, m.mime, m.size, m.width, m.height, m.sha256, m.bytes, m.now)
    },
    content(userId: string, id: string): { mime: ImageMime; bytes: Uint8Array } | null {
      const row = content.get(id, userId) as { mime: ImageMime; bytes: Uint8Array } | undefined
      return row ?? null
    },
    ownedBy: (userId: string, id: string): boolean => owned.get(id, userId) !== undefined,
    /** Deletes media created before `before` that no item of its owner references. */
    pruneOrphans: (before: number): number => Number(pruneOrphans.run(before).changes)
  }
}

export type MediaRepo = ReturnType<typeof createMediaRepo>
