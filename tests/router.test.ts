import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { API_CHANNELS } from '@shared/api'
import type { BoardBundle, BoardRecord, CaseRecord, Language, MediaRef } from '@shared/types'
import { expectError, expectOk, setup, signup } from './helpers'
import { link, note, person, personData, pngBytes } from './fixtures'

const CASE = { title: 'Romance scam ring', description: '', category: 'Fraud', status: 'active', priority: 'critical', color: '#8e44ad' }

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'eboard-router-'))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('router wiring', () => {
  it('routes every API channel and nothing else', async () => {
    const { router } = setup()
    for (const [ns, methods] of Object.entries(API_CHANNELS)) {
      for (const method of methods) expect(router.has(`${ns}:${method}`), `${ns}:${method}`).toBe(true)
    }
    expect(router.has('auth:becomeAdmin')).toBe(false)
    expect(await router.dispatch('auth:becomeAdmin', {})).toEqual({ ok: false, error: 'not_found' })
  })

  it('requires a session for everything except sign-in, me and logout', async () => {
    const env = setup()
    const open = new Set(['auth:signup', 'auth:login', 'auth:verifyTotp', 'auth:me', 'auth:logout'])
    for (const [ns, methods] of Object.entries(API_CHANNELS)) {
      for (const method of methods) {
        const channel = `${ns}:${method}`
        if (open.has(channel)) continue
        expect(await env.call(channel, {}), channel).toEqual({ ok: false, error: 'not_authenticated' })
      }
    }
    expectOk(await env.call('auth:me'))
    expectOk(await env.call('auth:logout'))
  })

  it('rejects payloads that do not match the schema', async () => {
    const env = setup()
    await signup(env)
    for (const bad of [null, 'text', 42, [], { title: 'x' }, { ...CASE, extra: true }, { ...CASE, color: 'red' }]) {
      const r = await env.call('cases:create', bad)
      expectError(r, 'invalid_input')
      if (!r.ok) for (const key of r.details ?? []) expect(key).toMatch(/^validation\./)
    }
    // Methods without a payload accept none (an omitted argument may be serialised as null).
    expectOk(await env.call('cases:list', null))
    expectError(await env.call('cases:list', {}), 'invalid_input')
    expectError(await env.call('auth:me', { userId: 'someone-else' }), 'invalid_input')
  })

  it('reports unexpected failures as internal without leaking details', async () => {
    const boom = new Error('SQLITE_CORRUPT at C:\\Users\\agent\\eboard.db')
    const env = setup({
      platform: {
        appInfo: () => {
          throw boom
        }
      }
    })
    await signup(env)
    expect(await env.call('system:appInfo')).toEqual({ ok: false, error: 'internal' })
    expect(env.logged).toContain(boom)
  })
})

describe('system channels', () => {
  it('opens only http(s) URLs', async () => {
    const env = setup()
    await signup(env)
    expectOk(await env.call('system:openExternal', { url: 'https://www.google.com/maps?q=25.11,55.13' }))
    for (const url of ['javascript:alert(1)', 'file:///C:/Windows/System32/calc.exe', 'ftp://example.com', '', 'https://user:pw@example.com']) {
      expectError(await env.call('system:openExternal', { url }), 'invalid_input')
    }
    expect(env.opened).toEqual(['https://www.google.com/maps?q=25.11,55.13'])
  })

  it('copies sanitised text', async () => {
    const env = setup()
    await signup(env)
    expectOk(await env.call('system:copyText', { text: '25.114542313280626, 55.13366881944347' }))
    expectOk(await env.call('system:copyText', { text: 'line 1\nline\u0007 2\u202E' }))
    expect(env.copied).toEqual(['25.114542313280626, 55.13366881944347', 'line 1\nline 2'])
  })

  it('reports app info', async () => {
    const env = setup()
    await signup(env)
    expect(expectOk(await env.call('system:appInfo'))).toEqual({ version: '0.1.0', platform: 'win32', dataPath: 'C:\\data' })
  })
})

describe('media channels', () => {
  it('imports a picked file, or returns null when the dialog is cancelled', async () => {
    const file = join(dir, 'suspect.png')
    writeFileSync(file, pngBytes(200, 100))
    let next: string | null = null
    const languages: Language[] = []
    const env = setup({
      platform: {
        pickImageFile: async (language) => {
          languages.push(language)
          return next
        }
      }
    })
    await signup(env, 'ahmed.ali', { language: 'ar' })
    expect(expectOk(await env.call('media:pickImage'))).toBeNull()
    next = file
    expect(expectOk<MediaRef>(await env.call('media:pickImage'))).toMatchObject({ mime: 'image/png', width: 200, height: 100 })
    expect(languages).toEqual(['ar', 'ar'])
  })

  it('re-checks the session after the dialog closes', async () => {
    const file = join(dir, 'late.png')
    writeFileSync(file, pngBytes(10, 10))
    let onPick: () => void = () => {}
    const env = setup({
      platform: {
        pickImageFile: async () => {
          onPick()
          return file
        }
      }
    })
    await signup(env)
    onPick = () => void env.backend.auth.lock()
    expectError(await env.call('media:pickImage'), 'locked')
    expectOk(await env.call('auth:logout'))
    await signup(env, 'second.user')
    onPick = () => void env.backend.auth.logout()
    expectError(await env.call('media:pickImage'), 'not_authenticated')
  })

  it('imports dropped bytes only as a Uint8Array of a real image', async () => {
    const env = setup()
    await signup(env)
    const bytes = new Uint8Array(pngBytes(16, 16))
    expect(expectOk<MediaRef>(await env.call('media:importImageBytes', { name: 'drop.png', bytes }))).toMatchObject({ width: 16 })
    expectError(await env.call('media:importImageBytes', { name: 'drop.png', bytes: Array.from(bytes) }), 'invalid_input')
    expectError(await env.call('media:importImageBytes', { name: 'drop.svg', bytes }), 'invalid_file')
  })
})

describe('board flow over IPC', () => {
  it('creates a case and board, validates item payloads and loads the bundle', async () => {
    const env = setup()
    await signup(env)
    const caseRecord = expectOk<CaseRecord>(await env.call('cases:create', CASE))
    const board = expectOk<BoardRecord>(await env.call('boards:create', { caseId: caseRecord.id, title: 'Network', theme: 'hacker' }))
    const base = { boardId: board.id, deleteItemIds: [], upsertLinks: [], deleteLinkIds: [] }

    const injected = person(board.id, { data: personData({ fullName: "Robert'); DROP TABLE users;--" }) })
    const r = await env.call('boards:applyChanges', { ...base, upsertItems: [injected] })
    expectError(r, 'invalid_input')
    expect(r.ok ? [] : r.details).toContain('validation.letters_only')

    const a = person(board.id, { data: personData({ fullName: 'أحمد علي' }) })
    const b = note(board.id, 'Met at the Dubai office')
    expectOk(await env.call('boards:applyChanges', { ...base, upsertItems: [a, b], upsertLinks: [link(board.id, a.id, b.id)] }))

    const bundle = expectOk<BoardBundle>(await env.call('boards:load', { id: board.id }))
    expect(bundle.board.itemCount).toBe(2)
    expect(bundle.links).toHaveLength(1)
    expect(expectOk<CaseRecord[]>(await env.call('cases:list'))[0].boardCount).toBe(1)
  })

  it("hides other users' cases and boards", async () => {
    const env = setup()
    await signup(env, 'owner')
    const caseRecord = expectOk<CaseRecord>(await env.call('cases:create', CASE))
    const board = expectOk<BoardRecord>(await env.call('boards:create', { caseId: caseRecord.id, title: 'Private', theme: 'normal' }))
    await env.call('auth:logout')

    await signup(env, 'intruder')
    expect(expectOk(await env.call('cases:list'))).toEqual([])
    expectError(await env.call('boards:list', { caseId: caseRecord.id }), 'not_found')
    expectError(await env.call('boards:load', { id: board.id }), 'not_found')
    expectError(await env.call('cases:update', { id: caseRecord.id, title: 'Mine' }), 'not_found')
    expectError(
      await env.call('boards:applyChanges', {
        boardId: board.id,
        upsertItems: [note(board.id)],
        deleteItemIds: [],
        upsertLinks: [],
        deleteLinkIds: []
      }),
      'not_found'
    )
  })
})
