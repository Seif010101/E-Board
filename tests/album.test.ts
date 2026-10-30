// Person albums: photos and videos stored per person, validated by content, served in ranges.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { MediaRef } from '@shared/types'
import { inspectVideo, MAX_VIDEO_BYTES } from '../src/main/media'
import { parseRange } from '../src/main/protocol'
import { expectError, expectOk, setup } from './helpers'
import { jpegBytes, personData } from './fixtures'

vi.mock('electron', () => ({ protocol: {} }))

/** The start of an MP4: an "ftyp" box (size, "ftyp", brand) and some more bytes. */
const mp4 = (brand = 'isom'): Buffer => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp'), Buffer.from(brand), Buffer.alloc(16)])
const webm = (): Buffer => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]), Buffer.from('B\u0082\u0084webm'), Buffer.alloc(16)])

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'eboard-album-'))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('video validation', () => {
  it('accepts MP4 and WebM by their container signature', () => {
    expect(inspectVideo('clip.mp4', mp4())).toEqual({ ok: true, mime: 'video/mp4' })
    expect(inspectVideo('clip.m4v', mp4('M4V '))).toEqual({ ok: true, mime: 'video/mp4' })
    expect(inspectVideo('clip.webm', webm())).toEqual({ ok: true, mime: 'video/webm' })
  })

  it('rejects renamed files, other containers and oversized files', () => {
    expect(inspectVideo('clip.mp4', Buffer.from('MZ' + 'x'.repeat(64)))).toMatchObject({ ok: false, error: 'invalid_file' })
    expect(inspectVideo('clip.mp4', jpegBytes(10, 10))).toMatchObject({ ok: false, error: 'invalid_file' })
    expect(inspectVideo('clip.avi', mp4())).toMatchObject({ ok: false, error: 'invalid_file' })
    expect(inspectVideo('clip.webm', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('matroska'), Buffer.alloc(20)]))).toMatchObject({ ok: false })
    expect(inspectVideo('big.mp4', { length: MAX_VIDEO_BYTES + 1 } as unknown as Uint8Array)).toMatchObject({ ok: false, error: 'file_too_large' })
    expect(inspectVideo('.mp4', mp4())).toMatchObject({ ok: false })
  })
})

describe('range requests', () => {
  it('parse the forms a video player sends', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange(null, 1000)).toBeNull()
    expect(parseRange('items=0-1', 1000)).toBeNull()
    expect(parseRange('bytes=1000-1200', 1000)).toBe('unsatisfiable')
    expect(parseRange('bytes=50-10', 1000)).toBe('unsatisfiable')
  })
})

describe('album import', () => {
  const login = async () => {
    const env = setup({
      platform: {
        pickAlbumFiles: async () => [join(dir, 'a.jpg'), join(dir, 'b.mp4'), join(dir, 'c.webm')]
      }
    })
    expectOk(await env.call('auth.signup'.replace('.', ':'), { username: 'alice', password: 'Passw0rd!x', displayName: 'Alice', storageMode: 'local', language: 'en' }))
    return env
  }

  it('stores photos and videos, keeps the real MIME type and de-duplicates', async () => {
    writeFileSync(join(dir, 'a.jpg'), jpegBytes(40, 30))
    writeFileSync(join(dir, 'b.mp4'), mp4())
    writeFileSync(join(dir, 'c.webm'), webm())
    const env = await login()
    const added = expectOk<MediaRef[]>(await env.call('media:pickAlbumFiles'))
    expect(added.map((m) => m.mime)).toEqual(['image/jpeg', 'video/mp4', 'video/webm'])
    const again = expectOk<MediaRef[]>(await env.call('media:pickAlbumFiles'))
    expect(again.map((m) => m.id)).toEqual(added.map((m) => m.id))
    expect(env.backend.media.content(env.backend.auth.state().userId!, added[1].id)?.mime).toBe('video/mp4')
  })

  it('refuses a video that is not one, and videos where only images are allowed', async () => {
    writeFileSync(join(dir, 'fake.mp4'), Buffer.from('not a video at all, just text'))
    writeFileSync(join(dir, 'real.mp4'), mp4())
    const env = setup({ platform: { pickAlbumFiles: async () => [join(dir, 'fake.mp4')], pickImageFile: async () => join(dir, 'real.mp4') } })
    expectOk(await env.call('auth:signup', { username: 'bob', password: 'Passw0rd!x', displayName: 'Bob', storageMode: 'local', language: 'en' }))
    expectError(await env.call('media:pickAlbumFiles'), 'invalid_file')
    // Profile photos, logos and image cards stay image-only.
    expectError(await env.call('media:pickImage'), 'invalid_file')
  })

  it('lets a person card reference album media, but only the owner’s', async () => {
    writeFileSync(join(dir, 'a.jpg'), jpegBytes(40, 30))
    const env = await login()
    const [photo] = expectOk<MediaRef[]>(await env.call('media:pickAlbumFiles'))
    const me = env.backend.auth.me().user!
    const caseId = (expectOk(await env.call('cases:create', { title: 'C', description: '', category: '', status: 'open', priority: 'low', color: '#c0392b' })) as { id: string }).id
    const boardId = (expectOk(await env.call('boards:create', { caseId, title: 'B', theme: 'normal' })) as { id: string }).id
    void me
    const { person } = await import('./fixtures')
    const withAlbum = person(boardId, { data: personData({ album: [{ mediaId: photo.id, kind: 'image', caption: 'At the harbour' }] }) })
    expectOk(await env.call('boards:applyChanges', { boardId, upsertItems: [withAlbum], deleteItemIds: [], upsertLinks: [], deleteLinkIds: [] }))
    const loaded = expectOk<{ items: { data: { album: unknown[] } }[] }>(await env.call('boards:load', { id: boardId }))
    expect(loaded.items[0].data.album).toHaveLength(1)

    const stranger = person(boardId, { data: personData({ album: [{ mediaId: crypto.randomUUID(), kind: 'image', caption: '' }] }) })
    expectError(await env.call('boards:applyChanges', { boardId, upsertItems: [stranger], deleteItemIds: [], upsertLinks: [], deleteLinkIds: [] }), 'invalid_input')
  })

  it('keeps album media through start-up cleanup while a card references it', async () => {
    writeFileSync(join(dir, 'a.jpg'), jpegBytes(40, 30))
    writeFileSync(join(dir, 'b.mp4'), mp4())
    writeFileSync(join(dir, 'c.webm'), webm())
    const env = await login()
    const [photo, , loose] = expectOk<MediaRef[]>(await env.call('media:pickAlbumFiles'))
    const caseId = (expectOk(await env.call('cases:create', { title: 'C', description: '', category: '', status: 'open', priority: 'low', color: '#c0392b' })) as { id: string }).id
    const boardId = (expectOk(await env.call('boards:create', { caseId, title: 'B', theme: 'normal' })) as { id: string }).id
    const { person } = await import('./fixtures')
    const item = person(boardId, { data: personData({ album: [{ mediaId: photo.id, kind: 'image', caption: '' }] }) })
    expectOk(await env.call('boards:applyChanges', { boardId, upsertItems: [item], deleteItemIds: [], upsertLinks: [], deleteLinkIds: [] }))
    env.clock.advance(10 * 24 * 3600_000)
    env.backend.media.pruneOrphans(24 * 3600_000)
    const uid = env.backend.auth.state().userId!
    expect(env.backend.media.content(uid, photo.id)).not.toBeNull()
    expect(env.backend.media.content(uid, loose.id)).toBeNull()
  })
})
