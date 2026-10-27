import { describe, expect, it } from 'vitest'
import { dummyHash, hashPassword, needsRehash, verifyPassword } from '../src/main/password'
import { LOGIN_POLICY, RateLimiter } from '../src/main/rateLimit'
import { makeClock } from './fixtures'

describe('password hashing (scrypt)', () => {
  it('stores scrypt$15$8$1$<salt>$<hash> with a 16-byte salt and 64-byte key', async () => {
    const stored = await hashPassword('Correct horse 42')
    const parts = stored.split('$')
    expect(parts.slice(0, 4)).toEqual(['scrypt', '15', '8', '1'])
    expect(Buffer.from(parts[4], 'base64')).toHaveLength(16)
    expect(Buffer.from(parts[5], 'base64')).toHaveLength(64)
    expect(needsRehash(stored)).toBe(false)
  })

  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('Correct horse 42')
    expect(await verifyPassword('Correct horse 42', stored)).toBe(true)
    expect(await verifyPassword('correct horse 42', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same password 1'), hashPassword('same password 1')])
    expect(a).not.toBe(b)
  })

  it('treats Unicode-equivalent passwords as equal (NFC)', async () => {
    const stored = await hashPassword('café secret 1')
    expect(await verifyPassword('café secret 1', stored)).toBe(true)
  })

  it('fails closed on malformed or tampered hashes', async () => {
    const stored = await hashPassword('Correct horse 42')
    const [, , r, p, salt, hash] = stored.split('$')
    expect(await verifyPassword('Correct horse 42', '')).toBe(false)
    expect(await verifyPassword('Correct horse 42', 'plain-text')).toBe(false)
    expect(await verifyPassword('Correct horse 42', ['bcrypt', 15, r, p, salt, hash].join('$'))).toBe(false)
    // Absurd cost parameters are refused instead of burning CPU / memory.
    expect(await verifyPassword('Correct horse 42', ['scrypt', 30, r, p, salt, hash].join('$'))).toBe(false)
    expect(await verifyPassword('Correct horse 42', ['scrypt', 15, 99, p, salt, hash].join('$'))).toBe(false)
    expect(await verifyPassword('Correct horse 42', ['scrypt', 15, r, p, salt, 'AAAA'].join('$'))).toBe(false)
  })

  it('flags weaker parameters for rehash', () => {
    const weak = ['scrypt', 14, 8, 1, Buffer.alloc(16).toString('base64'), Buffer.alloc(64).toString('base64')].join('$')
    expect(needsRehash(weak)).toBe(true)
    expect(needsRehash('garbage')).toBe(true)
  })

  it('provides a decoy hash that matches nothing', async () => {
    const decoy = dummyHash()
    expect(needsRehash(decoy)).toBe(false)
    expect(await verifyPassword('anything', decoy)).toBe(false)
  })
})

describe('RateLimiter', () => {
  it('blocks after 5 consecutive failures for 30 s, doubling up to 15 min', () => {
    const clock = makeClock()
    const limiter = new RateLimiter(LOGIN_POLICY, clock.now)
    for (let i = 0; i < 4; i++) expect(limiter.fail('u:ahmed')).toBe(0)
    expect(limiter.retryAfter('u:ahmed')).toBe(0)

    expect(limiter.fail('u:ahmed')).toBe(30_000)
    expect(limiter.retryAfter('u:ahmed')).toBe(30_000)
    clock.advance(10_000)
    expect(limiter.retryAfter('u:ahmed')).toBe(20_000)
    clock.advance(20_000)
    expect(limiter.retryAfter('u:ahmed')).toBe(0)

    const expected = [60_000, 120_000, 240_000, 480_000, 900_000, 900_000, 900_000]
    for (const ms of expected) {
      expect(limiter.fail('u:ahmed')).toBe(ms)
      clock.advance(ms)
    }
  })

  it('keeps keys independent and clears a key on success', () => {
    const clock = makeClock()
    const limiter = new RateLimiter(LOGIN_POLICY, clock.now)
    for (let i = 0; i < 5; i++) limiter.fail('u:a')
    expect(limiter.retryAfter('u:a')).toBeGreaterThan(0)
    expect(limiter.retryAfter('u:b')).toBe(0)

    limiter.succeed('u:a')
    expect(limiter.retryAfter('u:a')).toBe(0)
    // The failure streak starts over.
    for (let i = 0; i < 4; i++) expect(limiter.fail('u:a')).toBe(0)
  })
})
