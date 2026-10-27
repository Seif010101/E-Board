// Image import (from disk or raw bytes) with content validation and per-user de-duplication.

import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { ImageMime, MediaRef } from '@shared/types'
import type { Database } from '../db'
import { fail, isUniqueViolation } from '../errors'
import { inspectImage, MAX_IMAGE_BYTES } from '../media'
import { createMediaRepo } from '../repos/media'

export function createMediaService({ db, now = Date.now }: { db: Database; now?: () => number }) {
  const repo = createMediaRepo(db)

  const importBytes = (userId: string, name: string, bytes: Uint8Array): MediaRef => {
    const check = inspectImage(name, bytes)
    if (!check.ok) return fail(check.error)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const existing = repo.findBySha(userId, sha256)
    if (existing) return existing
    const { mime, width, height } = check.info
    const ref: MediaRef = { id: randomUUID(), mime, size: bytes.length, width, height }
    try {
      repo.insert({ ...ref, userId, sha256, bytes, now: now() })
    } catch (err) {
      // A concurrent import of the same file won the race.
      if (isUniqueViolation(err)) return repo.findBySha(userId, sha256) ?? fail('internal')
      throw err
    }
    return ref
  }

  return {
    importBytes,

    async importFile(userId: string, path: string): Promise<MediaRef> {
      const info = await stat(path).catch(() => null)
      if (!info?.isFile()) return fail('invalid_file')
      // Checked before reading so a huge file is never loaded into memory.
      if (info.size > MAX_IMAGE_BYTES) return fail('file_too_large')
      const bytes = await readFile(path).catch(() => null)
      if (!bytes) return fail('invalid_file')
      return importBytes(userId, basename(path), bytes)
    },

    content: (userId: string, id: string): { mime: ImageMime; bytes: Uint8Array } | null => repo.content(userId, id),

    /** Removes media nobody references any more, keeping anything newer than `graceMs`. */
    pruneOrphans: (graceMs: number): number => repo.pruneOrphans(now() - graceMs)
  }
}

export type MediaService = ReturnType<typeof createMediaService>
