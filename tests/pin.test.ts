// PIN-locked items: the main process refuses every change to them until the PIN is entered,
// whatever the renderer sends.

import { beforeEach, describe, expect, it } from 'vitest'
import type { CaseInput } from '@shared/api'
import { DEFAULT_SETTINGS, type BoardChanges } from '@shared/types'
import { schemas } from '@shared/validation'
import { openDatabase, type Database } from '../src/main/db'
import { AppError } from '../src/main/errors'
import { createUsersRepo } from '../src/main/repos/users'
import { createWorkspaceService } from '../src/main/services/workspace'
import { id, link, makeClock, person, type Clock } from './fixtures'

const CASE: CaseInput = { title: 'Case', description: '', category: '', status: 'open', priority: 'low', color: '#c0392b' }

let db: Database
let clock: Clock
let ws: ReturnType<typeof createWorkspaceService>
let alice: string
let bob: string
let boardId: string
let caseId: string

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

const changes = (patch: Partial<BoardChanges>): BoardChanges => ({
  boardId,
  upsertItems: [],
  deleteItemIds: [],
  upsertLinks: [],
  deleteLinkIds: [],
  ...patch
})
const apply = (userId: string, patch: Partial<BoardChanges>) => ws.applyChanges(userId, schemas.boardChanges.parse(changes(patch)))

const codeOf = async (fn: () => unknown): Promise<{ code: string; retryAfterMs?: number } | null> => {
  try {
    await fn()
    return null
  } catch (err) {
    if (err instanceof AppError) return { code: err.code, retryAfterMs: err.retryAfterMs }
    throw err
  }
}

const row = (itemId: string) =>
  db.prepare('SELECT locked, pin_hash, pin_fails, x FROM items WHERE id = ?').get(itemId) as {
    locked: number
    pin_hash: string | null
    pin_fails: number
    x: number
  }

beforeEach(() => {
  clock = makeClock()
  db = openDatabase(':memory:')
  ws = createWorkspaceService({ db, now: clock.now })
  alice = addUser('alice')
  bob = addUser('bob')
  caseId = ws.createCase(alice, CASE).id
  boardId = ws.createBoard(alice, { caseId, title: 'Board', theme: 'normal' }).id
})

describe('PIN lock', () => {
  it('locks with a hashed PIN and reports the item as PIN-locked', async () => {
    const a = person(boardId)
    apply(alice, { upsertItems: [a] })
    await ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })

    const stored = row(a.id)
    expect(stored.locked).toBe(1)
    expect(stored.pin_hash).toMatch(/^scrypt\$/)
    expect(stored.pin_hash).not.toContain('4821')
    expect(ws.loadBoard(alice, boardId).items[0]).toMatchObject({ locked: true, pinLocked: true })
  })

  it('refuses edits, deletes and thread changes on a PIN-locked item', async () => {
    const a = person(boardId)
    const b = person(boardId)
    const l = link(boardId, a.id, b.id)
    apply(alice, { upsertItems: [a, b], upsertLinks: [l] })
    await ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })

    // Even claiming it is unlocked and moving it.
    const forged = { ...a, locked: false, pinLocked: false, x: 999 }
    expect((await codeOf(() => apply(alice, { upsertItems: [forged] })))?.code).toBe('pin_locked')
    expect((await codeOf(() => apply(alice, { deleteItemIds: [a.id] })))?.code).toBe('pin_locked')
    expect((await codeOf(() => apply(alice, { upsertLinks: [{ ...l, label: 'x' }] })))?.code).toBe('pin_locked')
    expect((await codeOf(() => apply(alice, { deleteLinkIds: [l.id] })))?.code).toBe('pin_locked')
    expect(row(a.id).x).toBe(a.x)
    expect(row(a.id).locked).toBe(1)
    // A batch that includes a locked item is refused as a whole.
    expect((await codeOf(() => apply(alice, { upsertItems: [{ ...b, x: 5 }, forged] })))?.code).toBe('pin_locked')
    expect(row(b.id).x).toBe(b.x)
    // Deleting the other end takes the thread with it; the locked item itself is untouched.
    apply(alice, { deleteItemIds: [b.id], deleteLinkIds: [l.id] })
    expect(row(a.id).locked).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS n FROM links').get()).toMatchObject({ n: 0 })
    const c = person(boardId)
    apply(alice, { upsertItems: [c] })
    // Other items stay editable.
    apply(alice, { upsertItems: [{ ...c, x: 5 }] })
    expect(row(c.id).x).toBe(5)
  })

  it('refuses to delete the board or case that holds one', async () => {
    const a = person(boardId)
    apply(alice, { upsertItems: [a] })
    await ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })
    expect((await codeOf(() => ws.removeBoard(alice, boardId)))?.code).toBe('pin_locked')
    expect((await codeOf(() => ws.removeCase(alice, caseId)))?.code).toBe('pin_locked')
    await ws.unlockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })
    expect(ws.removeBoard(alice, boardId)).toBeNull()
  })

  it('unlocks with the right PIN and clears it', async () => {
    const a = person(boardId)
    apply(alice, { upsertItems: [a] })
    await ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })
    expect((await codeOf(() => ws.unlockItemWithPin(alice, { boardId, itemId: a.id, pin: '0000' })))?.code).toBe('invalid_pin')
    await ws.unlockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })
    expect(row(a.id)).toMatchObject({ locked: 0, pin_hash: null, pin_fails: 0 })
    apply(alice, { upsertItems: [{ ...a, x: 7 }] })
    expect(row(a.id).x).toBe(7)
  })

  it('blocks guessing: five wrong PINs, then a wait that grows, even for the right PIN', async () => {
    const a = person(boardId)
    apply(alice, { upsertItems: [a] })
    await ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })
    const guess = (pin: string) => codeOf(() => ws.unlockItemWithPin(alice, { boardId, itemId: a.id, pin }))
    for (let i = 0; i < 4; i++) expect((await guess('1111'))?.code).toBe('invalid_pin')
    const blocked = await guess('1111')
    expect(blocked).toMatchObject({ code: 'rate_limited', retryAfterMs: 60_000 })
    // The right PIN is refused during the wait, so the block cannot be used to test guesses.
    expect((await guess('4821'))?.code).toBe('rate_limited')
    expect(row(a.id).pin_hash).not.toBeNull()
    clock.advance(61_000)
    expect((await guess('1111'))).toMatchObject({ code: 'rate_limited', retryAfterMs: 120_000 })
    clock.advance(121_000)
    expect(await guess('4821')).toBeNull()
  })

  it("keeps other users out and rejects malformed PINs", async () => {
    const a = person(boardId)
    apply(alice, { upsertItems: [a] })
    expect((await codeOf(() => ws.lockItemWithPin(bob, { boardId, itemId: a.id, pin: '4821' })))?.code).toBe('not_found')
    for (const pin of ['123', '123456789', 'abcd', '12 34', '']) {
      expect(schemas.itemPin.safeParse({ boardId, itemId: a.id, pin }).success, pin).toBe(false)
    }
    expect(schemas.itemPin.safeParse({ boardId, itemId: a.id, pin: '12345678' }).success).toBe(true)
  })

  it('does not let a PIN be replaced while one is set', async () => {
    const a = person(boardId)
    apply(alice, { upsertItems: [a] })
    await ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })
    expect((await codeOf(() => ws.lockItemWithPin(alice, { boardId, itemId: a.id, pin: '9999' })))?.code).toBe('pin_locked')
    await expect(ws.unlockItemWithPin(alice, { boardId, itemId: a.id, pin: '4821' })).resolves.toBeNull()
  })
})
