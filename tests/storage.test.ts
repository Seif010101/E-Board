// Portable storage: moving data to a drive and back, two-factor secrets that follow the data, erasing
// what is left behind, and noticing that the drive was pulled out.

import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { DEFAULT_SETTINGS } from '@shared/types'
import { openDatabase, type Database } from '../src/main/db'
import { AppError } from '../src/main/errors'
import { createUsersRepo } from '../src/main/repos/users'
import { createSecretBox } from '../src/main/secrets'
import { createStorageService } from '../src/main/services/storage'
import {
  copyDatabase,
  createDriveCipher,
  DATA_FOLDER,
  dataDirOf,
  dbPathOf,
  holdsData,
  isDriveAvailable,
  looksLikeEBoardDatabase,
  prepareDriveFolder,
  readStorageConfig,
  shredDatabase,
  shredFile,
  watchDrive,
  writeStorageConfig,
  type StorageConfig
} from '../src/main/storage'
import { createWaitingRouter } from '../src/main/router'
import { fakeCipher, id, makeClock } from './fixtures'

let root: string
let userData: string
let drive: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'eboard-storage-'))
  userData = join(root, 'userData')
  drive = join(root, 'USB')
  mkdirSync(userData)
  mkdirSync(drive)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const codeOf = async (fn: () => Promise<unknown>): Promise<string | null> => {
  try {
    await fn()
    return null
  } catch (err) {
    if (err instanceof AppError) return `${err.code}:${err.details?.join(',') ?? ''}`
    throw err
  }
}

describe('storage config', () => {
  it('defaults to local and survives a round trip', () => {
    expect(readStorageConfig(userData)).toEqual({ mode: 'local', dir: null })
    writeStorageConfig(userData, { mode: 'portable', dir: drive })
    expect(readStorageConfig(userData)).toEqual({ mode: 'portable', dir: drive })
    expect(dataDirOf({ mode: 'portable', dir: drive }, userData)).toBe(join(drive, DATA_FOLDER))
    expect(dataDirOf({ mode: 'local', dir: null }, userData)).toBe(userData)
  })

  it('ignores a damaged or hostile config', () => {
    for (const bad of ['not json', '{"mode":"portable"}', '{"mode":"portable","dir":"relative/path"}', '{"mode":"x","dir":"/tmp"}', '[]']) {
      writeFileSync(join(userData, 'storage.json'), bad)
      expect(readStorageConfig(userData)).toEqual({ mode: 'local', dir: null })
    }
  })
})

describe('erasing', () => {
  it.skipIf(process.platform === 'win32')('overwrites a file with zeros before deleting it', () => {
    const file = join(root, 'secret.bin')
    writeFileSync(file, Buffer.alloc(3 * 1024 * 1024, 0xab))
    // A handle opened beforehand still reads the old inode after the unlink: it must hold zeros.
    const fd = openSync(file, 'r')
    try {
      shredFile(file)
      expect(existsSync(file)).toBe(false)
      const seen = Buffer.alloc(3 * 1024 * 1024)
      readSync(fd, seen, 0, seen.length, 0)
      expect(seen.every((b) => b === 0)).toBe(true)
    } finally {
      closeSync(fd)
    }
    shredFile(file) // missing files are fine
  })

  it('removes a database with its journal files', () => {
    const path = join(root, 'x.db')
    for (const suffix of ['', '-wal', '-shm', '-journal']) writeFileSync(path + suffix, 'data')
    shredDatabase(path)
    expect(readdirSync(root).filter((n) => n.startsWith('x.db'))).toEqual([])
  })
})

describe('moving data', () => {
  let db: Database
  let restarted: number
  let closed: number
  let picked: string | null
  const osCipher = fakeCipher()

  const service = (config: StorageConfig, withDb: Database | null = db) =>
    createStorageService({
      db: withDb,
      config,
      userData,
      osCipher,
      pickFolder: async () => picked,
      closeDb: () => {
        closed++
        withDb?.close()
      },
      restart: () => void restarted++
    })

  beforeEach(() => {
    restarted = 0
    closed = 0
    picked = drive
    db = openDatabase(dbPathOf(userData))
    const clock = makeClock()
    createUsersRepo(db).insert({
      id: id(),
      username: 'alice',
      displayName: 'Alice',
      passwordHash: 'scrypt$15$8$1$AAAA$AAAA',
      storageMode: 'local',
      settings: DEFAULT_SETTINGS,
      now: clock.now()
    })
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1').run(createSecretBox(osCipher).seal('JBSWY3DPEHPK3PXP'))
  })
  afterEach(() => {
    try {
      db.close()
    } catch {
      /* already closed */
    }
  })

  const secretIn = (file: string, from: ReturnType<typeof createSecretBox>): string => {
    const copy = new DatabaseSync(file, { readOnly: true })
    try {
      return from.open((copy.prepare('SELECT totp_secret FROM users').get() as { totp_secret: string }).totp_secret)
    } finally {
      copy.close()
    }
  }

  it('copies everything to the drive, re-seals two-factor secrets for it, erases the local copy and restarts', async () => {
    expect(await service({ mode: 'local', dir: null }).moveData('portable')).toBe(true)

    const folder = join(drive, DATA_FOLDER)
    expect(looksLikeEBoardDatabase(dbPathOf(folder))).toBe(true)
    expect(holdsData(drive)).toBe(true)
    // The seed is readable with the drive's own key — on any computer — not with this PC's key store.
    expect(secretIn(dbPathOf(folder), createSecretBox(createDriveCipher(folder)))).toBe('JBSWY3DPEHPK3PXP')
    expect(readStorageConfig(userData)).toEqual({ mode: 'portable', dir: drive })
    expect(existsSync(dbPathOf(userData))).toBe(false)
    expect(readdirSync(userData).filter((n) => n.startsWith('eboard.db'))).toEqual([])
    expect(closed).toBe(1)
    expect(restarted).toBe(1)
  })

  it('does nothing when the folder dialog is cancelled', async () => {
    picked = null
    expect(await service({ mode: 'local', dir: null }).moveData('portable')).toBe(false)
    expect(existsSync(dbPathOf(userData))).toBe(true)
    expect(readStorageConfig(userData).mode).toBe('local')
    expect(restarted).toBe(0)
  })

  it('refuses a drive that already holds E-Board data, and a non-folder', async () => {
    prepareDriveFolder(drive)
    writeFileSync(join(drive, DATA_FOLDER, 'eboard.db'), '')
    expect(await codeOf(() => service({ mode: 'local', dir: null }).moveData('portable'))).toBe('invalid_input:storage.drive_has_data')
    picked = join(root, 'missing')
    expect(await codeOf(() => service({ mode: 'local', dir: null }).moveData('portable'))).toBe('invalid_input:storage.not_a_folder')
    expect(existsSync(dbPathOf(userData))).toBe(true)
  })

  it('leaves the local data alone and cleans the drive when the copy fails', async () => {
    const broken = createStorageService({
      db,
      config: { mode: 'local', dir: null },
      userData,
      // A key store that cannot read the stored seed makes re-sealing fail.
      osCipher: { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(s), decryptString: () => { throw new Error('boom') } },
      pickFolder: async () => drive,
      closeDb: () => void closed++,
      restart: () => void restarted++
    })
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await codeOf(() => broken.moveData('portable'))).toBe('internal:')
    quiet.mockRestore()
    expect(existsSync(join(drive, DATA_FOLDER))).toBe(false)
    expect(existsSync(dbPathOf(userData))).toBe(true)
    expect(readStorageConfig(userData).mode).toBe('local')
    expect(restarted).toBe(0)
  })

  it('moves data back to this computer and erases the drive', async () => {
    await service({ mode: 'local', dir: null }).moveData('portable')
    const config: StorageConfig = { mode: 'portable', dir: drive }
    const folder = dataDirOf(config, userData)
    const onDrive = openDatabase(dbPathOf(folder), { removable: true })
    restarted = 0
    closed = 0
    expect(await service(config, onDrive).moveData('local')).toBe(true)

    expect(looksLikeEBoardDatabase(dbPathOf(userData))).toBe(true)
    expect(secretIn(dbPathOf(userData), createSecretBox(osCipher))).toBe('JBSWY3DPEHPK3PXP')
    expect(existsSync(join(drive, DATA_FOLDER))).toBe(false)
    expect(readStorageConfig(userData)).toEqual({ mode: 'local', dir: null })
    expect(restarted).toBe(1)
  })

  it('connects to a drive that already holds data, or starts empty data on a new one', async () => {
    // Empty folder: fresh portable data is created and usable.
    expect(await service({ mode: 'local', dir: null }).useDrive()).toBe(true)
    expect(readStorageConfig(userData)).toEqual({ mode: 'portable', dir: drive })
    expect(isDriveAvailable({ mode: 'portable', dir: drive })).toBe(true)
    expect(looksLikeEBoardDatabase(dbPathOf(join(drive, DATA_FOLDER)))).toBe(true)

    // Going back to this computer's own data changes nothing on the drive.
    expect(await service({ mode: 'portable', dir: drive }).useLocal()).toBe(true)
    expect(readStorageConfig(userData).mode).toBe('local')
    expect(holdsData(drive)).toBe(true)
  })

  it('copyDatabase includes everything and refuses to overwrite', () => {
    const target = join(root, 'copy.db')
    copyDatabase(db, target)
    expect(looksLikeEBoardDatabase(target)).toBe(true)
    expect(() => copyDatabase(db, target)).toThrow()
    expect(readFileSync(target).length).toBeGreaterThan(0)
  })
})

describe('the drive being pulled out', () => {
  it('is noticed once, as soon as the data stops being readable', () => {
    vi.useFakeTimers()
    try {
      const folder = prepareDriveFolder(drive)
      openDatabase(dbPathOf(folder), { removable: true }).close()
      const config: StorageConfig = { mode: 'portable', dir: drive }
      const gone = vi.fn()
      const stop = watchDrive(config, gone, 100)
      vi.advanceTimersByTime(350)
      expect(gone).not.toHaveBeenCalled()
      rmSync(folder, { recursive: true, force: true })
      vi.advanceTimersByTime(250)
      expect(gone).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1000)
      expect(gone).toHaveBeenCalledTimes(1)
      stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not watch local data', () => {
    const gone = vi.fn()
    watchDrive({ mode: 'local', dir: null }, gone, 10)()
    expect(gone).not.toHaveBeenCalled()
  })

  it('opens a database on a drive with a rollback journal and full syncing', () => {
    const file = join(root, 'removable.db')
    const d = openDatabase(file, { removable: true })
    expect(d.prepare('PRAGMA journal_mode').get()).toMatchObject({ journal_mode: 'delete' })
    expect(d.prepare('PRAGMA synchronous').get()).toMatchObject({ synchronous: 2 })
    d.close()
  })
})

describe('waiting for the drive', () => {
  const waiting = () =>
    createWaitingRouter(
      createStorageService({
        db: null,
        config: { mode: 'portable', dir: drive },
        userData,
        osCipher: null,
        pickFolder: async () => null,
        closeDb: () => {},
        restart: () => {}
      })
    )

  it('answers only storage questions; everything else says the drive is missing', async () => {
    const router = waiting()
    expect(await router.dispatch('storage:status', undefined)).toEqual({ ok: true, data: { mode: 'portable', available: false, drivePath: drive } })
    expect(await router.dispatch('auth:me', undefined)).toEqual({ ok: false, error: 'drive_missing' })
    expect(await router.dispatch('boards:load', { id: id() })).toEqual({ ok: false, error: 'drive_missing' })
    expect(await router.dispatch('storage:moveData', { target: 'local' })).toEqual({ ok: false, error: 'drive_missing' })
    expect(router.has('auth:login')).toBe(true)
    expect(await router.dispatch('storage:useDrive', undefined)).toEqual({ ok: true, data: false })
  })
})
