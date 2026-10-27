// Builds a complete backend + router over an in-memory database, as the Electron entry point does.

import { expect } from 'vitest'
import type { ErrorCode, LoginResult, Result, TotpSetup } from '@shared/api'
import type { PublicUser } from '@shared/types'
import { createBackend } from '../src/main/backend'
import { openDatabase } from '../src/main/db'
import { createRouter, type Platform } from '../src/main/router'
import type { SecretCipher } from '../src/main/secrets'
import { base32Decode, totpAt, verifyTotp } from '../src/main/totp'
import { fakeCipher, makeClock } from './fixtures'

export function setup(opts: { cipher?: SecretCipher | null; platform?: Partial<Platform> } = {}) {
  const clock = makeClock()
  const db = openDatabase(':memory:')
  const backend = createBackend({ db, cipher: opts.cipher === undefined ? fakeCipher() : opts.cipher, now: clock.now })
  const opened: string[] = []
  const copied: string[] = []
  const platform: Platform = {
    pickImageFile: async () => null,
    openExternal: async (url) => void opened.push(url),
    copyText: (text) => void copied.push(text),
    appInfo: () => ({ version: '0.1.0', platform: 'win32', dataPath: 'C:\\data' }),
    ...opts.platform
  }
  const logged: unknown[] = []
  const router = createRouter(backend, platform, (_message, err) => logged.push(err))
  const call = (channel: string, payload?: unknown): Promise<Result<unknown>> => router.dispatch(channel, payload)
  return { clock, db, backend, router, call, opened, copied, logged }
}

export type Env = ReturnType<typeof setup>

export function expectOk<T>(result: Result<unknown>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result)}`)
  return result.data as T
}

export function expectError(result: Result<unknown>, error: ErrorCode): void {
  expect(result.ok).toBe(false)
  expect(result).toMatchObject({ ok: false, error })
}

export const PASSWORD = 'Str0ng passphrase'

export async function signup(env: Env, username = 'ahmed.ali', extra: Record<string, unknown> = {}): Promise<PublicUser> {
  return expectOk<PublicUser>(
    await env.call('auth:signup', {
      username,
      password: PASSWORD,
      displayName: '',
      storageMode: 'local',
      language: 'en',
      ...extra
    })
  )
}

export async function login(env: Env, username: string, password = PASSWORD): Promise<Result<unknown>> {
  return env.call('auth:login', { username, password })
}

export const loginResult = (r: Result<unknown>): LoginResult => expectOk<LoginResult>(r)

/** Begins and enables 2FA for the signed-in user; returns the raw secret. */
export async function enableTotp(env: Env): Promise<Buffer> {
  const setupData = expectOk<TotpSetup>(await env.call('auth:totpBegin'))
  const secret = base32Decode(setupData.secret)
  expectOk(await env.call('auth:totpEnable', { code: totpAt(secret, env.clock.now()) }))
  return secret
}

/** A well-formed code guaranteed to be wrong for the whole ±1 step window around `t`. */
export function wrongCode(secret: Buffer, t: number): string {
  for (let n = 0; ; n++) {
    const code = String(n).padStart(6, '0')
    if (verifyTotp(secret, code, t) === null) return code
  }
}
