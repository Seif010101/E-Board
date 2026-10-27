// scrypt password hashing. Stored format: scrypt$<log2 N>$<r>$<p>$<salt b64>$<hash b64>

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const LOG_N = 15
const R = 8
const P = 1
const KEY_LEN = 64
const SALT_LEN = 16
const MAX_MEM = 128 * 1024 * 1024

const derive = (password: string, salt: Buffer, options: ScryptOptions, keyLen: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password.normalize('NFC'), salt, keyLen, options, (err, key) => (err ? reject(err) : resolve(key)))
  })

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const hash = await derive(password, salt, { N: 2 ** LOG_N, r: R, p: P, maxmem: MAX_MEM }, KEY_LEN)
  return ['scrypt', LOG_N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

interface ParsedHash {
  logN: number
  r: number
  p: number
  salt: Buffer
  hash: Buffer
}

const parse = (stored: string): ParsedHash | null => {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null
  const [logN, r, p] = parts.slice(1, 4).map(Number)
  // Bounds keep a tampered row from making us burn unbounded CPU / memory.
  if (!Number.isInteger(logN) || logN < 10 || logN > 20) return null
  if (!Number.isInteger(r) || r < 1 || r > 32) return null
  if (!Number.isInteger(p) || p < 1 || p > 16) return null
  const salt = Buffer.from(parts[4], 'base64')
  const hash = Buffer.from(parts[5], 'base64')
  if (salt.length < 8 || hash.length < 32 || hash.length > 128) return null
  return { logN, r, p, salt, hash }
}

/** Constant-time verification. Malformed hashes simply fail. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored)
  if (!parsed) return false
  const key = await derive(
    password,
    parsed.salt,
    { N: 2 ** parsed.logN, r: parsed.r, p: parsed.p, maxmem: MAX_MEM },
    parsed.hash.length
  )
  return key.length === parsed.hash.length && timingSafeEqual(key, parsed.hash)
}

/**
 * A well-formed hash with the current parameters that matches no password. Verifying against it
 * costs exactly as much as a real check, which hides whether a username exists.
 */
export const dummyHash = (): string =>
  ['scrypt', LOG_N, R, P, randomBytes(SALT_LEN).toString('base64'), randomBytes(KEY_LEN).toString('base64')].join('$')

/** True when the stored hash uses weaker parameters than the current policy. */
export const needsRehash = (stored: string): boolean => {
  const parsed = parse(stored)
  return !parsed || parsed.logN < LOG_N || parsed.r < R || parsed.hash.length < KEY_LEN
}
