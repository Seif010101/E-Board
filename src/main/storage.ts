// Where the data lives: on this computer (default) or on a removable drive ("portable mode").
// Pure Node (no Electron) so it can be tested. The choice itself is kept in a small config file in
// the app's user-data folder; the data folder lives on the drive and is recognised by a marker file.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SecretCipher } from './secrets'

export interface StorageConfig {
  mode: 'local' | 'portable'
  /** Folder chosen on the drive (absolute); only for portable mode. */
  dir: string | null
}

export const DATA_FOLDER = 'E-Board-data'
export const MARKER_FILE = '.eboard-drive'
export const DB_FILE = 'eboard.db'
export const KEY_FILE = 'secret.key'
const CONFIG_FILE = 'storage.json'

export const LOCAL_CONFIG: StorageConfig = { mode: 'local', dir: null }

/** Reads the choice; anything missing or malformed means "local". */
export function readStorageConfig(userData: string): StorageConfig {
  try {
    const raw = JSON.parse(readFileSync(join(userData, CONFIG_FILE), 'utf8')) as Partial<StorageConfig>
    if (raw.mode === 'portable' && typeof raw.dir === 'string' && isAbsolute(raw.dir)) return { mode: 'portable', dir: resolve(raw.dir) }
  } catch {
    /* no config yet */
  }
  return LOCAL_CONFIG
}

/** Atomic write: a crash never leaves a half-written config. */
export function writeStorageConfig(userData: string, config: StorageConfig): void {
  mkdirSync(userData, { recursive: true })
  const target = join(userData, CONFIG_FILE)
  const tmp = `${target}.tmp`
  writeFileSync(tmp, JSON.stringify(config))
  renameSync(tmp, target)
}

/** Folder holding the database (and key) for a configuration. */
export const dataDirOf = (config: StorageConfig, userData: string): string =>
  config.mode === 'portable' && config.dir ? join(config.dir, DATA_FOLDER) : userData

export const dbPathOf = (dataDir: string): string => join(dataDir, DB_FILE)

/** Portable data is "there" only while the drive's marker file is readable. */
export function isDriveAvailable(config: StorageConfig): boolean {
  if (config.mode !== 'portable' || !config.dir) return true
  try {
    return statSync(join(config.dir, DATA_FOLDER, MARKER_FILE)).isFile() && statSync(join(config.dir, DATA_FOLDER, DB_FILE)).isFile()
  } catch {
    return false
  }
}

/** True when `dir` already holds E-Board data (a drive from another computer). */
export function holdsData(dir: string): boolean {
  return existsSync(join(dir, DATA_FOLDER, MARKER_FILE)) && existsSync(join(dir, DATA_FOLDER, DB_FILE))
}

/** Creates the data folder and its marker on a drive. */
export function prepareDriveFolder(dir: string): string {
  const folder = join(dir, DATA_FOLDER)
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, MARKER_FILE), 'E-Board portable data\n')
  return folder
}

/** Overwrites a file with zeros, then deletes it (best effort: flash storage may keep old blocks). */
export function shredFile(path: string): void {
  let size: number
  try {
    size = statSync(path).size
  } catch {
    return
  }
  try {
    const fd = openSync(path, 'r+')
    try {
      const chunk = Buffer.alloc(1024 * 1024)
      for (let done = 0; done < size; done += chunk.length) writeSync(fd, chunk, 0, Math.min(chunk.length, size - done), done)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
  } catch {
    /* fall through to a plain delete */
  }
  unlinkSync(path)
}

/** Removes a database together with its WAL / shared-memory / journal files. */
export function shredDatabase(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) shredFile(dbPath + suffix)
}

/**
 * Writes a consistent copy of a live database to `target` (which must not exist) using
 * VACUUM INTO, so the source keeps working and WAL contents are included.
 */
export function copyDatabase(source: DatabaseSync, target: string): void {
  if (existsSync(target)) throw new Error('Target database already exists')
  // The path is quoted as an SQL string literal; it comes from a native dialog, never from the renderer.
  source.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
}

/** True when the file opens as a database with the app's tables (used before switching to it). */
export function looksLikeEBoardDatabase(path: string): boolean {
  let db: DatabaseSync | null = null
  try {
    db = new DatabaseSync(path, { readOnly: true })
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    const names = new Set(rows.map((r) => r.name))
    return ['users', 'cases', 'boards', 'items', 'links', 'media'].every((n) => names.has(n))
  } catch {
    return false
  } finally {
    db?.close()
  }
}

// ---------------------------------------------------------------------------
// Secrets on a drive

/**
 * Cipher for small secrets (TOTP seeds) that travels with the data: an AES-256-GCM key kept next to
 * the database on the drive. Unlike the OS keystore it works on whichever computer the drive is
 * plugged into, so two-factor codes keep working there.
 */
export function createDriveCipher(dataDir: string): SecretCipher {
  const keyPath = join(dataDir, KEY_FILE)
  let key: Buffer
  if (existsSync(keyPath)) key = readFileSync(keyPath)
  else {
    key = randomBytes(32)
    writeFileSync(keyPath, key, { mode: 0o600 })
  }
  if (key.length !== 32) throw new Error('Drive key file is damaged')
  return {
    isEncryptionAvailable: () => true,
    encryptString(plain) {
      const iv = randomBytes(12)
      const c = createCipheriv('aes-256-gcm', key, iv)
      const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
      return Buffer.concat([iv, c.getAuthTag(), body])
    },
    decryptString(data) {
      const d = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
      d.setAuthTag(data.subarray(12, 28))
      return Buffer.concat([d.update(data.subarray(28)), d.final()]).toString('utf8')
    }
  }
}

// ---------------------------------------------------------------------------
// Watching the drive

/**
 * Calls `onGone` once, as soon as the drive's data stops being readable (the drive was pulled out).
 * Polling is deliberate: it is cheap and works the same for every kind of removable media.
 */
export function watchDrive(config: StorageConfig, onGone: () => void, intervalMs = 750): () => void {
  if (config.mode !== 'portable') return () => {}
  let fired = false
  const timer = setInterval(() => {
    if (fired || isDriveAvailable(config)) return
    fired = true
    clearInterval(timer)
    onGone()
  }, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
