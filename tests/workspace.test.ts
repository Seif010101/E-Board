import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CaseInput } from '@shared/api'
import { DEFAULT_SETTINGS, type BoardBundle, type BoardChanges, type BoardRecord, type CaseRecord, type MediaRef } from '@shared/types'
import { schemas } from '@shared/validation'
import { openDatabase, SCHEMA_VERSION, type Database } from '../src/main/db'
import { AppError } from '../src/main/errors'
import { createUsersRepo } from '../src/main/repos/users'
import { createMediaService } from '../src/main/services/media'
import { createWorkspaceService } from '../src/main/services/workspace'
import { company, entity, id, image, link, makeClock, note, person, personData, pngBytes, type Clock } from './fixtures'

const CASE: CaseInput = {
  title: 'Fraud & social-engineering by a fake company based in India',
  description: 'Victims were contacted through fake recruitment ads.',
  category: 'Fraud',
  status: 'open',
  priority: 'high',
  color: '#c0392b'
}

let db: Database
let clock: Clock
let ws: ReturnType<typeof createWorkspaceService>
let media: ReturnType<typeof createMediaService>
let alice: string
let bob: string

const addUser = (username: string): string => {
  const userId = id()
  createUsersRepo(db).insert({
    id: userId,
    username,
    displayName: username,
    passwordHash: 'scrypt$15$8$1$AAAA$AAAA',
    storageMode: 'local',
    settings: DEFAULT_SETTINGS,
    now: clock.now()
  })
  return userId
}

const changes = (boardId: string, patch: Partial<BoardChanges> = {}): BoardChanges => ({
  boardId,
  upsertItems: [],
  deleteItemIds: [],
  upsertLinks: [],
  deleteLinkIds: [],
  ...patch
})

/** Mirrors the IPC path: the payload is parsed (and normalised) before it reaches the service. */
const apply = (userId: string, payload: BoardChanges): null => ws.applyChanges(userId, schemas.boardChanges.parse(payload))

const errorCode = (fn: () => unknown): string | null => {
  try {
    fn()
    return null
  } catch (err) {
    if (err instanceof AppError) return err.code
    throw err
  }
}

const count = (table: 'items' | 'links' | 'boards' | 'cases' | 'media'): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

beforeEach(() => {
  clock = makeClock()
  db = openDatabase(':memory:')
  ws = createWorkspaceService({ db, now: clock.now })
  media = createMediaService({ db, now: clock.now })
  alice = addUser('alice')
  bob = addUser('bob')
})

describe('database', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'eboard-db-'))
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('migrates to the current schema version with foreign keys and WAL on', () => {
    const file = openDatabase(join(dir, 'fresh.db'))
    try {
      expect(file.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: SCHEMA_VERSION })
      expect(file.prepare('PRAGMA foreign_keys').get()).toMatchObject({ foreign_keys: 1 })
      expect(file.prepare('PRAGMA journal_mode').get()).toMatchObject({ journal_mode: 'wal' })
      const tables = (file.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
      expect(tables).toEqual(expect.arrayContaining(['boards', 'cases', 'items', 'links', 'media', 'users']))
    } finally {
      file.close()
    }
  })

  it('keeps data when an up-to-date database is reopened', () => {
    const path = join(dir, 'reopen.db')
    const first = openDatabase(path)
    const userId = id()
    createUsersRepo(first).insert({
      id: userId,
      username: 'keeper',
      displayName: 'keeper',
      passwordHash: 'x',
      storageMode: 'local',
      settings: DEFAULT_SETTINGS,
      now: 1
    })
    first.close()
    const second = openDatabase(path)
    try {
      expect(createUsersRepo(second).findById(userId)?.username).toBe('keeper')
      expect(second.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: SCHEMA_VERSION })
    } finally {
      second.close()
    }
  })

  it('refuses a database written by a newer app version', () => {
    const path = join(dir, 'newer.db')
    const newer = openDatabase(path)
    newer.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
    newer.close()
    expect(() => openDatabase(path)).toThrow(/newer/)
  })
})

describe('cases', () => {
  it('creates, lists (most recent first, with board counts), updates partially and removes', () => {
    const first = ws.createCase(alice, CASE)
    expect(first).toMatchObject({ ...CASE, boardCount: 0, createdAt: clock.now(), updatedAt: clock.now() })
    clock.advance(1000)
    const second = ws.createCase(alice, { ...CASE, title: 'Crypto wallet laundering' })
    expect(ws.listCases(alice).map((c) => c.id)).toEqual([second.id, first.id])

    clock.advance(1000)
    ws.createBoard(alice, { caseId: first.id, title: 'People', theme: 'detective' })
    const listed = ws.listCases(alice)
    expect(listed.map((c) => c.id)).toEqual([first.id, second.id])
    expect(listed[0].boardCount).toBe(1)

    clock.advance(1000)
    const updated = ws.updateCase(alice, { id: second.id, status: 'closed' })
    expect(updated).toMatchObject({ ...CASE, title: 'Crypto wallet laundering', status: 'closed', updatedAt: clock.now() })

    expect(ws.removeCase(alice, second.id)).toBeNull()
    expect(ws.listCases(alice).map((c) => c.id)).toEqual([first.id])
    expect(errorCode(() => ws.removeCase(alice, second.id))).toBe('not_found')
  })

  it("isolates users: someone else's case behaves as if it did not exist", () => {
    const mine = ws.createCase(alice, CASE)
    expect(ws.listCases(bob)).toEqual([])
    expect(errorCode(() => ws.updateCase(bob, { id: mine.id, title: 'Hijacked' }))).toBe('not_found')
    expect(errorCode(() => ws.removeCase(bob, mine.id))).toBe('not_found')
    expect(errorCode(() => ws.listBoards(bob, mine.id))).toBe('not_found')
    expect(errorCode(() => ws.createBoard(bob, { caseId: mine.id, title: 'Intruder', theme: 'normal' }))).toBe('not_found')
    expect(ws.listCases(alice)[0].title).toBe(CASE.title)
    expect(count('boards')).toBe(0)
  })

  it('stores hostile text as plain data (parameterised SQL)', () => {
    const title = "Robert'); DROP TABLE cases;--"
    const created = ws.createCase(alice, { ...CASE, title })
    expect(ws.listCases(alice).find((c) => c.id === created.id)?.title).toBe(title)
    expect(count('cases')).toBe(1)
  })
})

describe('boards', () => {
  let caseRecord: CaseRecord
  let board: BoardRecord

  beforeEach(() => {
    caseRecord = ws.createCase(alice, CASE)
    clock.advance(1000)
    board = ws.createBoard(alice, { caseId: caseRecord.id, title: 'Suspects', theme: 'detective' })
  })

  it('creates with a default viewport and touches the case', () => {
    expect(board).toMatchObject({ caseId: caseRecord.id, title: 'Suspects', theme: 'detective', itemCount: 0 })
    expect(board.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(ws.listCases(alice)[0].updatedAt).toBe(clock.now())
  })

  it('updates title, theme and viewport; a viewport change alone keeps updatedAt', () => {
    clock.advance(1000)
    const renamed = ws.updateBoard(alice, { id: board.id, title: 'Network', theme: 'hacker' })
    expect(renamed).toMatchObject({ title: 'Network', theme: 'hacker', updatedAt: clock.now() })
    clock.advance(1000)
    const panned = ws.updateBoard(alice, { id: board.id, viewport: { x: -420, y: 130, zoom: 1.5 } })
    expect(panned.viewport).toEqual({ x: -420, y: 130, zoom: 1.5 })
    expect(panned.updatedAt).toBe(renamed.updatedAt)
    expect(errorCode(() => ws.updateBoard(bob, { id: board.id, title: 'Mine now' }))).toBe('not_found')
  })

  it('loads a bundle and lists boards with item counts', () => {
    const p = person(board.id)
    apply(alice, changes(board.id, { upsertItems: [p, note(board.id)] }))
    const bundle: BoardBundle = ws.loadBoard(alice, board.id)
    expect(bundle.caseRecord.id).toBe(caseRecord.id)
    expect(bundle.board.itemCount).toBe(2)
    expect(bundle.items.find((i) => i.id === p.id)).toEqual(p)
    expect(bundle.links).toEqual([])
    expect(ws.listBoards(alice, caseRecord.id).map((b) => [b.id, b.itemCount])).toEqual([[board.id, 2]])
    expect(errorCode(() => ws.loadBoard(bob, board.id))).toBe('not_found')
  })

  it('removes a board with everything on it', () => {
    const a = person(board.id)
    const b = company(board.id)
    apply(alice, changes(board.id, { upsertItems: [a, b], upsertLinks: [link(board.id, a.id, b.id, { kind: 'employee' })] }))
    expect(errorCode(() => ws.removeBoard(bob, board.id))).toBe('not_found')
    expect(ws.removeBoard(alice, board.id)).toBeNull()
    expect([count('boards'), count('items'), count('links')]).toEqual([0, 0, 0])
    expect(errorCode(() => ws.loadBoard(alice, board.id))).toBe('not_found')
  })

  describe('applyChanges', () => {
    it('upserts items and links, keeping createdAt and touching board and case', () => {
      const a = person(board.id)
      const b = person(board.id, { data: personData({ fullName: 'Sara Ali' }) })
      const l = link(board.id, a.id, b.id)
      clock.advance(5000)
      apply(alice, changes(board.id, { upsertItems: [a, b], upsertLinks: [l] }))

      const moved = { ...a, x: 900, createdAt: a.createdAt + 99, updatedAt: a.updatedAt + 10 }
      apply(alice, changes(board.id, { upsertItems: [moved], upsertLinks: [{ ...l, kind: 'friend', label: 'Old friends' }] }))

      const bundle = ws.loadBoard(alice, board.id)
      const stored = bundle.items.find((i) => i.id === a.id)!
      expect(stored.x).toBe(900)
      expect(stored.createdAt).toBe(a.createdAt)
      expect(stored.updatedAt).toBe(moved.updatedAt)
      expect(bundle.links).toEqual([{ ...l, kind: 'friend', label: 'Old friends' }])
      expect(bundle.board.updatedAt).toBe(clock.now())
      expect(bundle.caseRecord.updatedAt).toBe(clock.now())
    })

    it('rolls back the whole batch when one link is bad', () => {
      const a = person(board.id)
      const b = note(board.id)
      const good = link(board.id, a.id, b.id)
      const dangling = link(board.id, a.id, id())
      expect(errorCode(() => apply(alice, changes(board.id, { upsertItems: [a, b], upsertLinks: [good, dangling] })))).toBe(
        'invalid_input'
      )
      expect([count('items'), count('links')]).toEqual([0, 0])
      expect(db.isTransaction).toBe(false)

      // The same batch without the bad link goes through.
      apply(alice, changes(board.id, { upsertItems: [a, b], upsertLinks: [good] }))
      expect([count('items'), count('links')]).toEqual([2, 1])
    })

    it('rejects self-links and links to items deleted in the same batch', () => {
      const a = person(board.id)
      const b = person(board.id)
      apply(alice, changes(board.id, { upsertItems: [a, b] }))
      expect(errorCode(() => apply(alice, changes(board.id, { upsertLinks: [link(board.id, a.id, a.id)] })))).toBe('invalid_input')
      expect(
        errorCode(() => apply(alice, changes(board.id, { deleteItemIds: [b.id], upsertLinks: [link(board.id, a.id, b.id)] })))
      ).toBe('invalid_input')
      expect(count('items')).toBe(2)
    })

    it('rejects ids that live on another board, and records addressed to another board', () => {
      const other = ws.createBoard(alice, { caseId: caseRecord.id, title: 'Money trail', theme: 'normal' })
      const a = person(board.id)
      const b = person(board.id)
      const l = link(board.id, a.id, b.id)
      apply(alice, changes(board.id, { upsertItems: [a, b], upsertLinks: [l] }))

      // Same item id re-targeted at a different board.
      expect(errorCode(() => apply(alice, changes(other.id, { upsertItems: [{ ...a, boardId: other.id }] })))).toBe('invalid_input')
      // Item whose boardId disagrees with the change set.
      expect(errorCode(() => apply(alice, changes(other.id, { upsertItems: [note(board.id)] })))).toBe('invalid_input')
      // Link id reused on another board.
      const c = person(other.id)
      const d = person(other.id)
      expect(
        errorCode(() =>
          apply(alice, changes(other.id, { upsertItems: [c, d], upsertLinks: [{ ...l, boardId: other.id, fromId: c.id, toId: d.id }] }))
        )
      ).toBe('invalid_input')
      // Link on this board pointing at items of another board.
      apply(alice, changes(other.id, { upsertItems: [c] }))
      expect(errorCode(() => apply(alice, changes(board.id, { upsertLinks: [link(board.id, a.id, c.id)] })))).toBe('invalid_input')

      const original = ws.loadBoard(alice, board.id)
      expect(original.items.map((i) => i.boardId)).toEqual([board.id, board.id])
      expect(ws.loadBoard(alice, other.id).items.map((i) => i.id)).toEqual([c.id])
    })

    it('scopes deletes to the board and cascades item deletion to its threads', () => {
      const other = ws.createBoard(alice, { caseId: caseRecord.id, title: 'Money trail', theme: 'normal' })
      const a = person(board.id)
      const b = company(board.id)
      const c = note(board.id)
      apply(alice, changes(board.id, { upsertItems: [a, b, c], upsertLinks: [link(board.id, a.id, b.id), link(board.id, b.id, c.id)] }))

      // Deleting through another board's change set does nothing.
      apply(alice, changes(other.id, { deleteItemIds: [a.id] }))
      expect(count('items')).toBe(3)

      apply(alice, changes(board.id, { deleteItemIds: [b.id] }))
      const bundle = ws.loadBoard(alice, board.id)
      expect(bundle.items.map((i) => i.id).sort()).toEqual([a.id, c.id].sort())
      expect(bundle.links).toEqual([])
    })

    it("refuses another user's board and media", () => {
      const p = person(board.id)
      expect(errorCode(() => apply(bob, changes(board.id, { upsertItems: [p] })))).toBe('not_found')

      const bobsPhoto: MediaRef = media.importBytes(bob, 'photo.png', pngBytes(64, 64))
      const alicesPhoto: MediaRef = media.importBytes(alice, 'photo.png', pngBytes(32, 32))
      const withBobs = person(board.id, { data: personData({ photoMediaId: bobsPhoto.id }) })
      expect(errorCode(() => apply(alice, changes(board.id, { upsertItems: [withBobs] })))).toBe('invalid_input')
      expect(errorCode(() => apply(alice, changes(board.id, { upsertItems: [image(board.id, id())] })))).toBe('invalid_input')
      const bobsEvidence = entity(board.id, { kind: 'evidence', fields: {}, mediaId: bobsPhoto.id })
      expect(errorCode(() => apply(alice, changes(board.id, { upsertItems: [bobsEvidence] })))).toBe('invalid_input')

      const withPhoto = person(board.id, { data: personData({ photoMediaId: alicesPhoto.id }) })
      const withLogo = company(board.id)
      withLogo.data.logoMediaId = alicesPhoto.id
      const evidence = entity(board.id, { kind: 'evidence', fields: {}, mediaId: alicesPhoto.id })
      apply(alice, changes(board.id, { upsertItems: [withPhoto, withLogo, evidence, image(board.id, alicesPhoto.id)] }))
      expect(count('items')).toBe(4)
    })

    it('stores the parsed, normalised item rather than the raw payload', () => {
      const raw = entity(board.id, {
        kind: 'ip',
        title: '  C2‮ server  ',
        fields: { address: ' 203.0.113.7 ', isp: 'Example ISP', injected: '<script>alert(1)</script>' }
      })
      apply(alice, changes(board.id, { upsertItems: [raw] }))
      const stored = ws.loadBoard(alice, board.id).items[0]
      expect(stored.type).toBe('entity')
      if (stored.type !== 'entity') return
      expect(stored.data.title).toBe('C2 server')
      expect(stored.data.fields).toEqual({ address: '203.0.113.7', isp: 'Example ISP' })
    })

    it('is a no-op for an empty change set', () => {
      const before = ws.loadBoard(alice, board.id).board.updatedAt
      clock.advance(1000)
      apply(alice, changes(board.id))
      expect(ws.loadBoard(alice, board.id).board.updatedAt).toBe(before)
    })
  })
})

describe('cascades', () => {
  it('deleting a case removes its boards, items and links', () => {
    const c = ws.createCase(alice, CASE)
    const b = ws.createBoard(alice, { caseId: c.id, title: 'Board', theme: 'normal' })
    const p = person(b.id)
    const n = note(b.id)
    apply(alice, changes(b.id, { upsertItems: [p, n], upsertLinks: [link(b.id, p.id, n.id)] }))
    ws.removeCase(alice, c.id)
    expect([count('cases'), count('boards'), count('items'), count('links')]).toEqual([0, 0, 0, 0])
  })

  it('deleting a user removes all of their data and only theirs', () => {
    const mine = ws.createCase(alice, CASE)
    const theirs = ws.createCase(bob, CASE)
    const board = ws.createBoard(alice, { caseId: mine.id, title: 'Board', theme: 'normal' })
    apply(alice, changes(board.id, { upsertItems: [person(board.id)] }))
    media.importBytes(alice, 'a.png', pngBytes(8, 8))
    media.importBytes(bob, 'b.png', pngBytes(9, 9))

    createUsersRepo(db).remove(alice)
    expect(ws.listCases(bob).map((c) => c.id)).toEqual([theirs.id])
    expect([count('cases'), count('boards'), count('items'), count('media')]).toEqual([1, 0, 0, 1])
  })
})
