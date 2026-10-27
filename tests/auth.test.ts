import { describe, expect, it } from 'vitest'
import type { TotpSetup } from '@shared/api'
import { DEFAULT_SETTINGS, type PublicUser } from '@shared/types'
import { CHALLENGE_TTL_MS } from '../src/main/services/auth'
import { base32Decode, base32Encode, totpAt } from '../src/main/totp'
import {
  enableTotp,
  expectError,
  expectOk,
  login,
  loginResult,
  PASSWORD,
  setup,
  signup,
  wrongCode,
  type Env
} from './helpers'

const me = async (env: Env) => expectOk<{ user: PublicUser | null; locked: boolean }>(await env.call('auth:me'))

const storedTotpSecret = (env: Env, userId: string): string | null =>
  (env.db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(userId) as { totp_secret: string | null }).totp_secret

describe('sign-up', () => {
  it('creates the account, signs it in and applies defaults', async () => {
    const env = setup()
    const user = await signup(env, 'Ahmed.Ali', { language: 'ar' })
    expect(user).toMatchObject({
      username: 'Ahmed.Ali',
      displayName: 'Ahmed.Ali',
      storageMode: 'local',
      totpEnabled: false,
      settings: { ...DEFAULT_SETTINGS, language: 'ar' }
    })
    expect(user.createdAt).toBe(env.clock.now())
    expect(await me(env)).toEqual({ user, locked: false })
  })

  it('keeps a chosen display name', async () => {
    const env = setup()
    const user = await signup(env, 'investigator', { displayName: '  أحمد   علي ' })
    expect(user.displayName).toBe('أحمد علي')
  })

  it('rejects a username that differs only in case', async () => {
    const env = setup()
    await signup(env, 'ahmed.ali')
    const r = await env.call('auth:signup', {
      username: 'AHMED.ALI',
      password: PASSWORD,
      displayName: '',
      storageMode: 'local',
      language: 'en'
    })
    expectError(r, 'username_taken')
  })

  it('refuses cloud storage until sync exists', async () => {
    const env = setup()
    const r = await env.call('auth:signup', {
      username: 'cloudy',
      password: PASSWORD,
      displayName: '',
      storageMode: 'cloud',
      language: 'en'
    })
    expectError(r, 'cloud_unavailable')
    expect((await me(env)).user).toBeNull()
  })

  it('validates the payload and reports i18n keys', async () => {
    const env = setup()
    const r = await env.call('auth:signup', {
      username: 'a; DROP TABLE users',
      password: 'short',
      displayName: '<script>',
      storageMode: 'local',
      language: 'en'
    })
    expectError(r, 'invalid_input')
    expect(r.ok ? [] : r.details).toEqual(
      expect.arrayContaining(['validation.invalid_username', 'validation.password_too_short', 'validation.invalid_display_name'])
    )
  })
})

describe('login', () => {
  it('signs in with the right password only', async () => {
    const env = setup()
    const user = await signup(env)
    expectOk(await env.call('auth:logout'))
    expect((await me(env)).user).toBeNull()

    expectError(await login(env, 'ahmed.ali', 'Wrong password 1'), 'invalid_credentials')
    expectError(await login(env, 'nobody', PASSWORD), 'invalid_credentials')
    expect((await me(env)).user).toBeNull()

    const result = loginResult(await login(env, 'AHMED.ALI'))
    expect(result).toEqual({ status: 'ok', user })
    expect((await me(env)).user?.id).toBe(user.id)
  })

  it('locks a username out after 5 failures, doubling the wait', async () => {
    const env = setup()
    await signup(env)
    await env.call('auth:logout')

    for (let i = 0; i < 4; i++) expectError(await login(env, 'ahmed.ali', 'Wrong password 1'), 'invalid_credentials')
    const blocked = await login(env, 'ahmed.ali', 'Wrong password 1')
    expect(blocked).toEqual({ ok: false, error: 'rate_limited', retryAfterMs: 30_000 })

    // Even the right password is refused while blocked; the user key is case-insensitive.
    env.clock.advance(10_000)
    expect(await login(env, 'Ahmed.Ali')).toEqual({ ok: false, error: 'rate_limited', retryAfterMs: 20_000 })

    env.clock.advance(20_000)
    expect(await login(env, 'ahmed.ali', 'Wrong password 1')).toEqual({ ok: false, error: 'rate_limited', retryAfterMs: 60_000 })

    env.clock.advance(60_000)
    expect(loginResult(await login(env, 'ahmed.ali')).status).toBe('ok')

    // Success resets the streak.
    await env.call('auth:logout')
    for (let i = 0; i < 4; i++) expectError(await login(env, 'ahmed.ali', 'Wrong password 1'), 'invalid_credentials')
  })

  it('applies a global limit across usernames', async () => {
    const env = setup()
    await signup(env, 'real.user')
    await env.call('auth:logout')
    for (let i = 0; i < 4; i++) expectError(await login(env, `ghost${i}`, 'Wrong password 1'), 'invalid_credentials')
    expectError(await login(env, 'ghost4', 'Wrong password 1'), 'rate_limited')
    expectError(await login(env, 'real.user'), 'rate_limited')
    env.clock.advance(30_000)
    expect(loginResult(await login(env, 'real.user')).status).toBe('ok')
  })

  it('accepts any password shape at login without leaking the policy', async () => {
    const env = setup()
    expectError(await login(env, 'someone', 'x'), 'invalid_credentials')
    expectError(await env.call('auth:login', { username: 'someone', password: '' }), 'invalid_input')
  })
})

describe('two-factor authentication', () => {
  it('requires totpBegin before totpEnable', async () => {
    const env = setup()
    await signup(env)
    expectError(await env.call('auth:totpEnable', { code: '123456' }), 'totp_not_started')
  })

  it('enables 2FA, stores the seed sealed and requires a code at login', async () => {
    const env = setup()
    const user = await signup(env)

    const begin = expectOk<TotpSetup>(await env.call('auth:totpBegin'))
    expect(begin.secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(begin.otpauthUrl).toBe(
      `otpauth://totp/E-Board:ahmed.ali?secret=${begin.secret}&issuer=E-Board&algorithm=SHA1&digits=6&period=30`
    )
    expect(begin.qrDataUrl).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)

    const secret = base32Decode(begin.secret)
    expectError(await env.call('auth:totpEnable', { code: wrongCode(secret, env.clock.now()) }), 'invalid_totp')
    const enableCode = totpAt(secret, env.clock.now())
    // Spaces are tolerated (codes are often shown as "123 456").
    const enabled = expectOk<PublicUser>(
      await env.call('auth:totpEnable', { code: `${enableCode.slice(0, 3)} ${enableCode.slice(3)}` })
    )
    expect(enabled.totpEnabled).toBe(true)

    const sealed = storedTotpSecret(env, user.id)
    expect(sealed?.startsWith('ss:')).toBe(true)
    expect(sealed).not.toContain(begin.secret)

    await env.call('auth:logout')
    const step1 = loginResult(await login(env, 'ahmed.ali'))
    if (step1.status !== 'totp_required') throw new Error('expected a TOTP challenge')
    expect(step1.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect((await me(env)).user).toBeNull()

    // The code used to enable 2FA cannot be replayed.
    expectError(await env.call('auth:verifyTotp', { challenge: step1.challenge, code: enableCode }), 'invalid_totp')

    env.clock.advance(30_000)
    const code = totpAt(secret, env.clock.now())
    const signedIn = expectOk<PublicUser>(await env.call('auth:verifyTotp', { challenge: step1.challenge, code }))
    expect(signedIn.id).toBe(user.id)
    expect((await me(env)).user?.id).toBe(user.id)

    // Challenges are single-use.
    expectError(await env.call('auth:verifyTotp', { challenge: step1.challenge, code }), 'challenge_expired')

    // A fresh challenge cannot reuse the code that was just accepted either.
    await env.call('auth:logout')
    const step2 = loginResult(await login(env, 'ahmed.ali'))
    if (step2.status !== 'totp_required') throw new Error('expected a TOTP challenge')
    expectError(await env.call('auth:verifyTotp', { challenge: step2.challenge, code }), 'invalid_totp')
  })

  it('stores the seed as tagged plain text when OS encryption is unavailable', async () => {
    const env = setup({ cipher: null })
    const user = await signup(env)
    const secret = await enableTotp(env)
    expect(storedTotpSecret(env, user.id)).toBe(`pt:${base32Encode(secret)}`)
  })

  it('expires challenges after 5 minutes', async () => {
    const env = setup()
    await signup(env)
    const secret = await enableTotp(env)
    await env.call('auth:logout')
    const step = loginResult(await login(env, 'ahmed.ali'))
    if (step.status !== 'totp_required') throw new Error('expected a TOTP challenge')
    env.clock.advance(CHALLENGE_TTL_MS)
    expectError(
      await env.call('auth:verifyTotp', { challenge: step.challenge, code: totpAt(secret, env.clock.now()) }),
      'challenge_expired'
    )
  })

  it('burns a challenge after 5 wrong codes', async () => {
    const env = setup()
    await signup(env)
    const secret = await enableTotp(env)
    await env.call('auth:logout')
    env.clock.advance(30_000)
    const step = loginResult(await login(env, 'ahmed.ali'))
    if (step.status !== 'totp_required') throw new Error('expected a TOTP challenge')
    const bad = wrongCode(secret, env.clock.now())
    for (let i = 0; i < 4; i++) {
      expectError(await env.call('auth:verifyTotp', { challenge: step.challenge, code: bad }), 'invalid_totp')
    }
    expectError(await env.call('auth:verifyTotp', { challenge: step.challenge, code: bad }), 'challenge_expired')
    expectError(
      await env.call('auth:verifyTotp', { challenge: step.challenge, code: totpAt(secret, env.clock.now()) }),
      'challenge_expired'
    )
    expectError(
      await env.call('auth:verifyTotp', { challenge: 'A'.repeat(43), code: totpAt(secret, env.clock.now()) }),
      'challenge_expired'
    )
  })

  it('keeps counting wrong codes across fresh challenges', async () => {
    const env = setup()
    await signup(env)
    const secret = await enableTotp(env)
    await env.call('auth:logout')
    env.clock.advance(30_000)

    const challenge = async (): Promise<string> => {
      const step = loginResult(await login(env, 'ahmed.ali'))
      if (step.status !== 'totp_required') throw new Error('expected a TOTP challenge')
      return step.challenge
    }
    const bad = wrongCode(secret, env.clock.now())
    const first = await challenge()
    for (let i = 0; i < 4; i++) expectError(await env.call('auth:verifyTotp', { challenge: first, code: bad }), 'invalid_totp')
    expectError(await env.call('auth:verifyTotp', { challenge: first, code: bad }), 'challenge_expired')

    // A new password login does not buy a new guessing budget, not even for the right code.
    const second = await challenge()
    const code = totpAt(secret, env.clock.now())
    expect(await env.call('auth:verifyTotp', { challenge: second, code })).toEqual({
      ok: false,
      error: 'rate_limited',
      retryAfterMs: 30_000
    })

    env.clock.advance(30_000)
    const fresh = totpAt(secret, env.clock.now())
    expect(expectOk<PublicUser>(await env.call('auth:verifyTotp', { challenge: second, code: fresh })).username).toBe('ahmed.ali')
  })

  it('disables 2FA only with the password and a fresh code', async () => {
    const env = setup()
    const user = await signup(env)
    const secret = await enableTotp(env)
    env.clock.advance(30_000)
    const code = totpAt(secret, env.clock.now())

    expectError(await env.call('auth:totpDisable', { password: 'Wrong password 1', code }), 'invalid_credentials')
    expectError(
      await env.call('auth:totpDisable', { password: PASSWORD, code: wrongCode(secret, env.clock.now()) }),
      'invalid_totp'
    )
    const disabled = expectOk<PublicUser>(await env.call('auth:totpDisable', { password: PASSWORD, code }))
    expect(disabled.totpEnabled).toBe(false)
    expect(storedTotpSecret(env, user.id)).toBeNull()

    await env.call('auth:logout')
    expect(loginResult(await login(env, 'ahmed.ali')).status).toBe('ok')
  })
})

describe('session lock', () => {
  it('only allows me / lock / unlock / logout while locked', async () => {
    const env = setup()
    const user = await signup(env)
    expectOk(await env.call('auth:lock'))
    expect(await me(env)).toEqual({ user, locked: true })

    expectError(await env.call('cases:list'), 'locked')
    expectError(await env.call('auth:updateSettings', { appTheme: 'light' }), 'locked')
    expectError(await env.call('system:appInfo'), 'locked')
    expectError(await login(env, 'ahmed.ali'), 'locked')
    expectError(
      await env.call('auth:signup', { username: 'other', password: PASSWORD, displayName: '', storageMode: 'local', language: 'en' }),
      'locked'
    )

    expectError(await env.call('auth:unlock', { password: 'Wrong password 1' }), 'invalid_credentials')
    expectOk(await env.call('auth:unlock', { password: PASSWORD }))
    expect((await me(env)).locked).toBe(false)
    expectOk(await env.call('cases:list'))
  })

  it('rate-limits unlock attempts', async () => {
    const env = setup()
    await signup(env)
    await env.call('auth:lock')
    for (let i = 0; i < 4; i++) expectError(await env.call('auth:unlock', { password: 'Wrong password 1' }), 'invalid_credentials')
    expectError(await env.call('auth:unlock', { password: 'Wrong password 1' }), 'rate_limited')
    expectError(await env.call('auth:unlock', { password: PASSWORD }), 'rate_limited')
    env.clock.advance(30_000)
    expectOk(await env.call('auth:unlock', { password: PASSWORD }))
  })

  it('allows signing out of a locked session', async () => {
    const env = setup()
    await signup(env)
    await env.call('auth:lock')
    expectOk(await env.call('auth:logout'))
    expect(await me(env)).toEqual({ user: null, locked: false })
    expectError(await env.call('auth:lock'), 'not_authenticated')
  })
})

describe('account management', () => {
  it('changes the password after confirming the current one', async () => {
    const env = setup()
    await signup(env)
    expectError(await env.call('auth:changePassword', { current: 'Wrong password 1', next: 'New passw0rd!' }), 'invalid_credentials')
    expectError(await env.call('auth:changePassword', { current: PASSWORD, next: 'weak' }), 'invalid_input')
    expectOk(await env.call('auth:changePassword', { current: PASSWORD, next: 'New passw0rd!' }))

    await env.call('auth:logout')
    expectError(await login(env, 'ahmed.ali'), 'invalid_credentials')
    expect(loginResult(await login(env, 'ahmed.ali', 'New passw0rd!')).status).toBe('ok')
  })

  it('updates the display name, falling back to the username', async () => {
    const env = setup()
    await signup(env)
    expect(expectOk<PublicUser>(await env.call('auth:updateProfile', { displayName: '  Agent   Smith ' })).displayName).toBe('Agent Smith')
    expect(expectOk<PublicUser>(await env.call('auth:updateProfile', { displayName: '' })).displayName).toBe('ahmed.ali')
    expectError(await env.call('auth:updateProfile', { displayName: '<b>bold</b>' }), 'invalid_input')
  })

  it('merges settings patches over stored settings', async () => {
    const env = setup()
    await signup(env, 'ahmed.ali', { language: 'ar' })
    const a = expectOk<PublicUser>(await env.call('auth:updateSettings', { appTheme: 'light', toolbarEdge: 'top' }))
    expect(a.settings).toEqual({ ...DEFAULT_SETTINGS, language: 'ar', appTheme: 'light', toolbarEdge: 'top' })
    const b = expectOk<PublicUser>(await env.call('auth:updateSettings', { autoLockMinutes: 0 }))
    expect(b.settings).toEqual({ ...a.settings, autoLockMinutes: 0 })

    expectError(await env.call('auth:updateSettings', { appTheme: 'neon' }), 'invalid_input')
    expectError(await env.call('auth:updateSettings', { isAdmin: true }), 'invalid_input')
    expectError(await env.call('auth:updateSettings', { autoLockMinutes: 9999 }), 'invalid_input')
  })

  it('reads damaged stored settings back as defaults', async () => {
    const env = setup()
    const user = await signup(env)
    env.db
      .prepare('UPDATE users SET settings_json = ? WHERE id = ?')
      .run(JSON.stringify({ appTheme: 'light', toolbarEdge: 'diagonal', extra: 1 }), user.id)
    expect((await me(env)).user?.settings).toEqual({ ...DEFAULT_SETTINGS, appTheme: 'light' })
    env.db.prepare('UPDATE users SET settings_json = ? WHERE id = ?').run('{not json', user.id)
    expect((await me(env)).user?.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('deletes the account and everything in it after confirming the password', async () => {
    const env = setup()
    const user = await signup(env)
    expectOk(
      await env.call('cases:create', {
        title: 'Fraud by a fake company',
        description: '',
        category: 'Fraud',
        status: 'open',
        priority: 'high',
        color: '#c0392b'
      })
    )
    expectError(await env.call('auth:deleteAccount', { password: 'Wrong password 1' }), 'invalid_credentials')
    expect((await me(env)).user?.id).toBe(user.id)

    expectOk(await env.call('auth:deleteAccount', { password: PASSWORD }))
    expect((await me(env)).user).toBeNull()
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 })
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM cases').get()).toEqual({ n: 0 })
    expectError(await login(env, 'ahmed.ali'), 'invalid_credentials')
  })
})
