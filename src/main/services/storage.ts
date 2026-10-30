// Switching between "data on this computer" and "data on a removable drive". Everything that touches
// the filesystem or Electron is injected, so the whole flow is testable with temp folders.

import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { StorageStatus } from '@shared/api'
import { fail } from '../errors'
import { openDatabase, type Database } from '../db'
import { createSecretBox, type SecretBox, type SecretCipher } from '../secrets'
import {
  copyDatabase,
  createDriveCipher,
  dataDirOf,
  dbPathOf,
  DATA_FOLDER,
  holdsData,
  isDriveAvailable,
  KEY_FILE,
  looksLikeEBoardDatabase,
  LOCAL_CONFIG,
  MARKER_FILE,
  prepareDriveFolder,
  shredDatabase,
  shredFile,
  writeStorageConfig,
  type StorageConfig
} from '../storage'

export interface StorageDeps {
  /** The open database; null while the drive holding the data is missing. */
  db: Database | null
  config: StorageConfig
  /** The app's own data folder on this computer. */
  userData: string
  /** The OS key store (DPAPI / Keychain), if usable. */
  osCipher: SecretCipher | null
  /** Native folder dialog; null when cancelled. */
  pickFolder(): Promise<string | null>
  /** Closes the database ahead of deleting its files. */
  closeDb(): void
  /** Restarts the whole app (so nothing stays in memory). */
  restart(): void
}

/** Re-encrypts every stored two-factor secret from one key store to another, inside `file`. */
function resealSecrets(file: string, from: SecretBox, to: SecretBox): void {
  const db = new DatabaseSync(file)
  try {
    const rows = db.prepare('SELECT id, totp_secret FROM users WHERE totp_secret IS NOT NULL').all() as { id: string; totp_secret: string }[]
    const update = db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?')
    for (const row of rows) update.run(to.seal(from.open(row.totp_secret)), row.id)
  } finally {
    db.close()
  }
}

export function createStorageService(deps: StorageDeps) {
  const { config, userData } = deps

  const validFolder = (dir: string): void => {
    try {
      if (!statSync(dir).isDirectory()) fail('invalid_input', ['storage.not_a_folder'])
    } catch {
      fail('invalid_input', ['storage.not_a_folder'])
    }
  }

  return {
    status(): StorageStatus {
      return { mode: config.mode, available: isDriveAvailable(config), drivePath: config.dir }
    },

    /** Connects to the data on a drive (or starts empty data there). Signed-out only. */
    async useDrive(): Promise<boolean> {
      const dir = await deps.pickFolder()
      if (!dir) return false
      validFolder(dir)
      if (!holdsData(dir)) {
        const folder = prepareDriveFolder(dir)
        // Creates the database (and its key) so the drive is recognised as ready.
        openDatabase(dbPathOf(folder), { removable: true }).close()
        createDriveCipher(folder)
      }
      writeStorageConfig(userData, { mode: 'portable', dir })
      deps.restart()
      return true
    },

    /** Back to this computer's own data, without moving anything. */
    async useLocal(): Promise<boolean> {
      writeStorageConfig(userData, LOCAL_CONFIG)
      deps.restart()
      return true
    },

    /** Moves all data to a drive, or back to this computer; the copy that is left behind is erased. */
    async moveData(target: 'portable' | 'local'): Promise<boolean> {
      if (target === 'portable') return moveToDrive()
      return moveToLocal()
    }
  }

  async function moveToDrive(): Promise<boolean> {
    if (config.mode === 'portable') fail('invalid_input', ['storage.already_portable'])
    const dir = await deps.pickFolder()
    if (!dir) return false
    validFolder(dir)
    if (holdsData(dir)) fail('invalid_input', ['storage.drive_has_data'])
    const folder = prepareDriveFolder(dir)
    const target = dbPathOf(folder)
    try {
      copyDatabase(deps.db ?? fail('internal'), target)
      resealSecrets(target, createSecretBox(deps.osCipher), createSecretBox(createDriveCipher(folder)))
      if (!looksLikeEBoardDatabase(target)) throw new Error('The copy on the drive is not readable')
    } catch (err) {
      cleanDrive(dir)
      if (err instanceof Error && err.name === 'AppError') throw err
      console.error('Moving data to the drive failed', err)
      return fail('internal')
    }
    writeStorageConfig(userData, { mode: 'portable', dir })
    deps.closeDb()
    shredDatabase(dbPathOf(userData))
    deps.restart()
    return true
  }

  async function moveToLocal(): Promise<boolean> {
    if (config.mode !== 'portable' || !config.dir) fail('invalid_input', ['storage.already_local'])
    const dataDir = dataDirOf(config, userData)
    const target = dbPathOf(userData)
    if (existsSync(target)) fail('invalid_input', ['storage.local_has_data'])
    mkdirSync(userData, { recursive: true })
    try {
      copyDatabase(deps.db ?? fail('internal'), target)
      resealSecrets(target, createSecretBox(createDriveCipher(dataDir)), createSecretBox(deps.osCipher))
      if (!looksLikeEBoardDatabase(target)) throw new Error('The local copy is not readable')
    } catch (err) {
      shredDatabase(target)
      console.error('Moving data back to this computer failed', err)
      return fail('internal')
    }
    writeStorageConfig(userData, LOCAL_CONFIG)
    deps.closeDb()
    cleanDrive(config.dir as string)
    deps.restart()
    return true
  }
}

/** Erases the E-Board folder on a drive. */
export function cleanDrive(dir: string): void {
  const folder = join(dir, DATA_FOLDER)
  shredDatabase(join(folder, 'eboard.db'))
  shredFile(join(folder, KEY_FILE))
  shredFile(join(folder, MARKER_FILE))
  rmSync(folder, { recursive: true, force: true })
}

export type StorageService = ReturnType<typeof createStorageService>
