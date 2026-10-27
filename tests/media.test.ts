import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import { openDatabase } from '../src/main/db'
import { AppError } from '../src/main/errors'
import { inspectImage, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, parseJpeg, parsePng } from '../src/main/media'
import { mediaIdFromUrl } from '../src/main/protocol'
import { createUsersRepo } from '../src/main/repos/users'
import { createMediaService } from '../src/main/services/media'
import { createWorkspaceService } from '../src/main/services/workspace'
import { id, image, jpegBytes, makeClock, PNG_SIGNATURE, pngBytes } from './fixtures'

// protocol.ts registers handlers on Electron's `protocol`; only its pure URL parser is under test.
vi.mock('electron', () => ({ protocol: {} }))

const GIF = Buffer.from('474946383961010001008000000000ffffff21f90401000000002c00000000010001000002024401003b', 'hex')
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(14)])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>')

describe('image validation', () => {
  it('accepts a real PNG and reads its IHDR dimensions', () => {
    expect(inspectImage('photo.png', pngBytes(640, 480))).toEqual({ ok: true, info: { mime: 'image/png', width: 640, height: 480 } })
    expect(parsePng(pngBytes(1, 1))).toEqual({ width: 1, height: 1 })
  })

  it('accepts baseline and progressive JPEGs and reads SOFn dimensions', () => {
    expect(inspectImage('suspect.jpg', jpegBytes(1920, 1080))).toEqual({
      ok: true,
      info: { mime: 'image/jpeg', width: 1920, height: 1080 }
    })
    expect(inspectImage('suspect.JPEG', jpegBytes(300, 200, { sof: 0xc2 }))).toMatchObject({ ok: true, info: { width: 300, height: 200 } })
    expect(parseJpeg(jpegBytes(17, 33, { fill: true }))).toEqual({ width: 17, height: 33 })
  })

  it('takes the MIME type from the content, not the extension', () => {
    expect(inspectImage('looks-like.jpg', pngBytes(10, 10))).toMatchObject({ ok: true, info: { mime: 'image/png' } })
    expect(inspectImage('looks-like.png', jpegBytes(10, 10))).toMatchObject({ ok: true, info: { mime: 'image/jpeg' } })
  })

  it('requires a .png / .jpg / .jpeg file name', () => {
    for (const name of ['photo.gif', 'photo.svg', 'photo.png.exe', 'photo', '.png', 'photo.webp', 'photo.txt']) {
      expect(inspectImage(name, pngBytes(10, 10))).toEqual({ ok: false, error: 'invalid_file' })
    }
  })

  it('rejects GIF, WebP, SVG, text and empty files even when named .png', () => {
    for (const bytes of [GIF, WEBP, SVG, Buffer.from('hello, this is not an image'), Buffer.alloc(0)]) {
      expect(inspectImage('renamed.png', bytes)).toEqual({ ok: false, error: 'invalid_file' })
    }
  })

  it('rejects truncated or malformed PNG / JPEG data', () => {
    const png = pngBytes(10, 10)
    expect(inspectImage('a.png', png.subarray(0, png.length - 6))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.png', pngBytes(10, 10, { iend: false }))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.png', pngBytes(10, 10, { idat: false }))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.png', PNG_SIGNATURE)).toEqual({ ok: false, error: 'invalid_file' })

    // JPEG that reaches its scan without a frame header.
    const noFrame = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9])
    expect(inspectImage('a.jpg', noFrame)).toEqual({ ok: false, error: 'invalid_file' })
    const jpeg = jpegBytes(10, 10)
    expect(inspectImage('a.jpg', jpeg.subarray(0, 30))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.jpg', Buffer.from([0xff, 0xd8, 0xff]))).toEqual({ ok: false, error: 'invalid_file' })
  })

  it('enforces the dimension limits', () => {
    expect(inspectImage('a.png', pngBytes(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))).toMatchObject({ ok: true })
    expect(inspectImage('a.png', pngBytes(MAX_IMAGE_SIDE + 1, 10))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.png', pngBytes(10, 0))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.jpg', jpegBytes(10, MAX_IMAGE_SIDE + 1))).toEqual({ ok: false, error: 'invalid_file' })
    expect(inspectImage('a.jpg', jpegBytes(0, 10))).toEqual({ ok: false, error: 'invalid_file' })
  })

  it('enforces the 15 MB size limit', () => {
    const big = Buffer.concat([pngBytes(10, 10), Buffer.alloc(MAX_IMAGE_BYTES)])
    expect(inspectImage('big.png', big)).toEqual({ ok: false, error: 'file_too_large' })
  })
})

describe('media service', () => {
  const clock = makeClock()
  const db = openDatabase(':memory:')
  const media = createMediaService({ db, now: clock.now })
  const users = createUsersRepo(db)
  const alice = id()
  const bob = id()
  for (const [userId, username] of [
    [alice, 'alice'],
    [bob, 'bob']
  ]) {
    users.insert({ id: userId, username, displayName: username, passwordHash: 'x', storageMode: 'local', settings: DEFAULT_SETTINGS, now: 1 })
  }

  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'eboard-media-'))
  })
  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const codeOf = async (fn: () => unknown): Promise<string | null> => {
    try {
      await fn()
      return null
    } catch (err) {
      if (err instanceof AppError) return err.code
      throw err
    }
  }

  it('stores validated bytes and serves them only to their owner', () => {
    const bytes = pngBytes(120, 80)
    const ref = media.importBytes(alice, 'avatar.png', bytes)
    expect(ref).toMatchObject({ mime: 'image/png', size: bytes.length, width: 120, height: 80 })
    expect(ref.id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)

    const content = media.content(alice, ref.id)
    expect(content?.mime).toBe('image/png')
    expect(Buffer.from(content!.bytes).equals(bytes)).toBe(true)
    expect(media.content(bob, ref.id)).toBeNull()
    expect(media.content(alice, id())).toBeNull()
  })

  it('de-duplicates identical files per user', () => {
    const bytes = jpegBytes(50, 50)
    const first = media.importBytes(alice, 'one.jpg', bytes)
    const again = media.importBytes(alice, 'two.jpeg', bytes)
    const bobs = media.importBytes(bob, 'one.jpg', bytes)
    expect(again).toEqual(first)
    expect(bobs.id).not.toBe(first.id)
  })

  it('rejects invalid bytes', async () => {
    expect(await codeOf(() => media.importBytes(alice, 'x.png', GIF))).toBe('invalid_file')
    expect(await codeOf(() => media.importBytes(alice, 'x.svg', SVG))).toBe('invalid_file')
  })

  it('imports from disk, checking the size before reading', async () => {
    const good = join(dir, 'evidence.jpg')
    writeFileSync(good, jpegBytes(800, 600))
    expect(await media.importFile(alice, good)).toMatchObject({ mime: 'image/jpeg', width: 800, height: 600 })

    const renamed = join(dir, 'evidence.png')
    writeFileSync(renamed, SVG)
    expect(await codeOf(() => media.importFile(alice, renamed))).toBe('invalid_file')

    const wrongExtension = join(dir, 'evidence.gif')
    writeFileSync(wrongExtension, pngBytes(10, 10))
    expect(await codeOf(() => media.importFile(alice, wrongExtension))).toBe('invalid_file')

    const huge = join(dir, 'huge.png')
    writeFileSync(huge, pngBytes(10, 10))
    truncateSync(huge, MAX_IMAGE_BYTES + 1)
    expect(await codeOf(() => media.importFile(alice, huge))).toBe('file_too_large')

    expect(await codeOf(() => media.importFile(alice, join(dir, 'missing.png')))).toBe('invalid_file')
    expect(await codeOf(() => media.importFile(alice, dir))).toBe('invalid_file')
  })

  it('prunes only old media that no item references', () => {
    const ws = createWorkspaceService({ db, now: clock.now })
    const kept = media.importBytes(alice, 'kept.png', pngBytes(77, 77))
    const caseRecord = ws.createCase(alice, {
      title: 'Case',
      description: '',
      category: '',
      status: 'open',
      priority: 'low',
      color: '#336699'
    })
    const board = ws.createBoard(alice, { caseId: caseRecord.id, title: 'Board', theme: 'normal' })
    ws.applyChanges(alice, { boardId: board.id, upsertItems: [image(board.id, kept.id)], deleteItemIds: [], upsertLinks: [], deleteLinkIds: [] })
    const total = (db.prepare('SELECT COUNT(*) AS n FROM media').get() as { n: number }).n

    // Everything is still inside the grace period.
    expect(media.pruneOrphans(60_000)).toBe(0)
    clock.advance(120_000)
    expect(media.pruneOrphans(60_000)).toBe(total - 1)
    expect(media.content(alice, kept.id)).not.toBeNull()
  })
})

describe('eboard-media:// URLs', () => {
  it('extracts a valid media id', () => {
    expect(mediaIdFromUrl('eboard-media://media/0b6f2c1e-3d4a-4f5b-8c7d-9e0f1a2b3c4d')).toBe('0b6f2c1e-3d4a-4f5b-8c7d-9e0f1a2b3c4d')
  })

  it.each([
    'eboard-media://other/0b6f2c1e-3d4a-4f5b-8c7d-9e0f1a2b3c4d',
    'https://media/0b6f2c1e-3d4a-4f5b-8c7d-9e0f1a2b3c4d',
    'eboard-media://media/../../etc/passwd',
    'eboard-media://media/%2E%2E%2Fsecret-file-id',
    'eboard-media://media/short',
    'eboard-media://media/0b6f2c1e/3d4a4f5b',
    'eboard-media://media/',
    'not a url'
  ])('rejects %s', (url) => {
    expect(mediaIdFromUrl(url)).toBeNull()
  })
})
