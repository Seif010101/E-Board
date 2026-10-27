// RFC 4648 base32 and RFC 6238 TOTP (HMAC-SHA1, 30 s steps) for authenticator apps.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const TOTP_PERIOD_S = 30
export const TOTP_DIGITS = 6
export const TOTP_ISSUER = 'E-Board'
export const TOTP_SECRET_BYTES = 20

/** Base32 without padding. */
export function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31]
      bits -= 5
    }
    buffer &= (1 << bits) - 1
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31]
  return out
}

/** Decodes base32 (case-insensitive, optional '=' padding). Throws on any other character. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '')
  const out: number[] = []
  let buffer = 0
  let bits = 0
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch)
    if (v < 0) throw new Error('Invalid base32 character')
    buffer = (buffer << 5) | v
    bits += 5
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 0xff)
      bits -= 8
    }
    buffer &= (1 << bits) - 1
  }
  return Buffer.from(out)
}

export const generateTotpSecret = (): Buffer => randomBytes(TOTP_SECRET_BYTES)

export const timeStep = (timeMs: number, periodS = TOTP_PERIOD_S): number => Math.floor(timeMs / 1000 / periodS)

/** RFC 4226 HOTP with dynamic truncation. */
export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', secret).update(msg).digest()
  const offset = mac[mac.length - 1] & 0x0f
  const bin =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export const totpAt = (secret: Uint8Array, timeMs: number, digits = TOTP_DIGITS): string =>
  hotp(secret, timeStep(timeMs), digits)

const sameCode = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/**
 * Verifies `code` within ±`window` steps of `timeMs`. Steps at or before `lastStep` are refused
 * so an observed code can never be replayed. Returns the matched step, or null.
 */
export function verifyTotp(
  secret: Uint8Array,
  code: string,
  timeMs: number,
  opts: { window?: number; lastStep?: number } = {}
): number | null {
  if (code.length !== TOTP_DIGITS || !/^\d+$/.test(code)) return null
  const window = opts.window ?? 1
  const lastStep = opts.lastStep ?? -1
  const current = timeStep(timeMs)
  let matched: number | null = null
  // Check every candidate (no early exit) so timing does not reveal which step matched.
  for (let step = current - window; step <= current + window; step++) {
    if (step < 0) continue
    if (sameCode(hotp(secret, step), code) && step > lastStep && matched === null) matched = step
  }
  return matched
}

export function otpauthUrl(username: string, secretB32: string): string {
  const label = `${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(username)}`
  const params = [
    `secret=${secretB32}`,
    `issuer=${encodeURIComponent(TOTP_ISSUER)}`,
    'algorithm=SHA1',
    `digits=${TOTP_DIGITS}`,
    `period=${TOTP_PERIOD_S}`
  ]
  return `otpauth://totp/${label}?${params.join('&')}`
}
