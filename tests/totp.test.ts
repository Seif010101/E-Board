import { describe, expect, it } from 'vitest'
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUrl,
  timeStep,
  totpAt,
  verifyTotp
} from '../src/main/totp'

// RFC 6238 Appendix B, SHA-1 seed.
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii')

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130']
  ])('matches the 8-digit SHA-1 vector at T=%i', (t, code) => {
    expect(totpAt(RFC_SECRET, t * 1000, 8)).toBe(code)
  })

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037']
  ])('produces the 6-digit code at T=%i', (t, code) => {
    expect(totpAt(RFC_SECRET, t * 1000)).toBe(code)
  })

  it('matches RFC 4226 HOTP vectors', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code))
  })

  it('uses 30 second steps', () => {
    expect(timeStep(0)).toBe(0)
    expect(timeStep(29_999)).toBe(0)
    expect(timeStep(30_000)).toBe(1)
    expect(timeStep(59_000)).toBe(1)
  })
})

describe('base32 (RFC 4648)', () => {
  it.each([
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI']
  ])('encodes %j without padding', (plain, encoded) => {
    expect(base32Encode(Buffer.from(plain))).toBe(encoded)
    expect(base32Decode(encoded).toString()).toBe(plain)
  })

  it('decodes lower case and trailing padding', () => {
    expect(base32Decode('mzxw6ytboi======').toString()).toBe('foobar')
  })

  it('round-trips random secrets', () => {
    for (let i = 0; i < 50; i++) {
      const secret = generateTotpSecret()
      expect(secret).toHaveLength(20)
      const encoded = base32Encode(secret)
      expect(encoded).toMatch(/^[A-Z2-7]{32}$/)
      expect(base32Decode(encoded).equals(secret)).toBe(true)
    }
  })

  it('rejects characters outside the alphabet', () => {
    expect(() => base32Decode('MZXW1')).toThrow()
    expect(() => base32Decode('MZ XW')).toThrow()
    expect(() => base32Decode('MZ=XW')).toThrow()
  })
})

describe('verifyTotp', () => {
  const secret = generateTotpSecret()
  const t0 = 1_800_000_000_000
  const step0 = timeStep(t0)

  it('accepts the current step and ±1 neighbour, returning the matched step', () => {
    expect(verifyTotp(secret, totpAt(secret, t0), t0)).toBe(step0)
    expect(verifyTotp(secret, totpAt(secret, t0 - 30_000), t0)).toBe(step0 - 1)
    expect(verifyTotp(secret, totpAt(secret, t0 + 30_000), t0)).toBe(step0 + 1)
  })

  it('rejects codes outside the window', () => {
    expect(verifyTotp(secret, totpAt(secret, t0 - 60_000), t0)).toBeNull()
    expect(verifyTotp(secret, totpAt(secret, t0 + 60_000), t0)).toBeNull()
  })

  it('refuses replays of an already accepted step', () => {
    const code = totpAt(secret, t0)
    const step = verifyTotp(secret, code, t0)
    expect(step).toBe(step0)
    expect(verifyTotp(secret, code, t0, { lastStep: step! })).toBeNull()
    // An older code that is still inside the window is a replay too.
    expect(verifyTotp(secret, totpAt(secret, t0 - 30_000), t0, { lastStep: step! })).toBeNull()
    // The next step is fresh.
    expect(verifyTotp(secret, totpAt(secret, t0 + 30_000), t0 + 30_000, { lastStep: step! })).toBe(step0 + 1)
  })

  it('rejects malformed codes and the wrong secret', () => {
    const code = totpAt(secret, t0)
    expect(verifyTotp(secret, code.slice(0, 5), t0)).toBeNull()
    expect(verifyTotp(secret, `${code}0`, t0)).toBeNull()
    expect(verifyTotp(secret, 'abcdef', t0)).toBeNull()
    expect(verifyTotp(secret, '', t0)).toBeNull()
    expect(verifyTotp(generateTotpSecret(), code, t0, { window: 0 })).toBeNull()
  })
})

describe('otpauthUrl', () => {
  it('builds a key URI that authenticator apps understand', () => {
    const url = otpauthUrl('ahmed.ali', 'JBSWY3DPEHPK3PXP')
    expect(url).toBe(
      'otpauth://totp/E-Board:ahmed.ali?secret=JBSWY3DPEHPK3PXP&issuer=E-Board&algorithm=SHA1&digits=6&period=30'
    )
    const parsed = new URL(url)
    expect(parsed.protocol).toBe('otpauth:')
    expect(parsed.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP')
    expect(parsed.searchParams.get('issuer')).toBe('E-Board')
  })

  it('URI-encodes the label', () => {
    expect(otpauthUrl('a b&c', 'AAAA')).toContain('otpauth://totp/E-Board:a%20b%26c?')
  })
})
