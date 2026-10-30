// Image import (from disk or raw bytes) with content validation and per-user de-duplication.

import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { MediaMime, MediaRef } from '@shared/types'
import type { Database } from '../db'
import { fail, isUniqueViolation } from '../errors'
import { hasVideoExtension, inspectImage, inspectVideo, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../media'
import { createMediaRepo } from '../repos/media'

export function createMediaService({ db, now = Date.now }: { db: Database; now?: () => number }) {
  const repo = createMediaRepo(db)

  /** `videos`: also accept MP4 / WebM (album files); photos and logos stay image-only. */
  const store = (userId: string, bytes: Uint8Array, mime: MediaMime, width: number, height: number): MediaRef => {
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const existing = repo.findBySha(userId, sha256)
    if (existing) return existing
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

  const importBytes = (userId: string, name: string, bytes: Uint8Array, videos = false): MediaRef => {
    if (videos && hasVideoExtension(name)) {
      const video = inspectVideo(name, bytes)
      if (!video.ok) return fail(video.error)
      // Players report the real size; the store only needs a placeholder.
      return store(userId, bytes, video.mime, 0, 0)
    }
    const check = inspectImage(name, bytes)
    if (!check.ok) return fail(check.error)
    return store(userId, bytes, check.info.mime, check.info.width, check.info.height)
  }

  return {
    importBytes,

    async importFile(userId: string, path: string, videos = false): Promise<MediaRef> {
      const info = await stat(path).catch(() => null)
      if (!info?.isFile()) return fail('invalid_file')
      // Checked before reading so a huge file is never loaded into memory.
      const limit = videos && hasVideoExtension(path) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
      if (info.size > limit) return fail('file_too_large')
      const bytes = await readFile(path).catch(() => null)
      if (!bytes) return fail('invalid_file')
      return importBytes(userId, basename(path), bytes, videos)
    },

    content: (userId: string, id: string): { mime: MediaMime; bytes: Uint8Array } | null => repo.content(userId, id),

    /** Removes media nobody references any more, keeping anything newer than `graceMs`. */
    pruneOrphans: (graceMs: number): number => repo.pruneOrphans(now() - graceMs)
  }
}

export type MediaService = ReturnType<typeof createMediaService>
