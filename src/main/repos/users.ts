import { DEFAULT_SETTINGS, type PublicUser, type StorageMode, type UserSettings } from '@shared/types'
import { zSettingsPatch } from '@shared/validation'
import type { Database } from '../db'

export interface UserRow {
  id: string
  username: string
  display_name: string
  password_hash: string
  totp_secret: string | null
  totp_enabled: number
  totp_last_step: number
  storage_mode: StorageMode
  settings_json: string
  created_at: number
  updated_at: number
}

/** Stored settings merged over the defaults; unknown or invalid stored values are ignored. */
export function readSettings(json: string): UserSettings {
  let stored: unknown
  try {
    stored = JSON.parse(json)
  } catch {
    stored = null
  }
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const shape = zSettingsPatch.shape
    for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
      const parsed = shape[key].safeParse((stored as Record<string, unknown>)[key])
      if (parsed.success && parsed.data !== undefined) out[key] = parsed.data
    }
  }
  return out as unknown as UserSettings
}

export const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  storageMode: row.storage_mode,
  totpEnabled: row.totp_enabled === 1,
  createdAt: row.created_at,
  settings: readSettings(row.settings_json)
})

export interface NewUser {
  id: string
  username: string
  displayName: string
  passwordHash: string
  storageMode: StorageMode
  settings: UserSettings
  now: number
}

export function createUsersRepo(db: Database) {
  const byId = db.prepare('SELECT * FROM users WHERE id = ?')
  const byName = db.prepare('SELECT * FROM users WHERE username = ?')
  const insert = db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, storage_mode, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const setPassword = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
  const setDisplayName = db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?')
  const setSettings = db.prepare('UPDATE users SET settings_json = ?, updated_at = ? WHERE id = ?')
  const setTotp = db.prepare(
    'UPDATE users SET totp_secret = ?, totp_enabled = ?, totp_last_step = ?, updated_at = ? WHERE id = ?'
  )
  const setTotpStep = db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?')
  const remove = db.prepare('DELETE FROM users WHERE id = ?')

  return {
    findById: (id: string) => byId.get(id) as UserRow | undefined,
    /** Case-insensitive (the column is COLLATE NOCASE). */
    findByUsername: (username: string) => byName.get(username) as UserRow | undefined,
    insert(u: NewUser): void {
      insert.run(u.id, u.username, u.displayName, u.passwordHash, u.storageMode, JSON.stringify(u.settings), u.now, u.now)
    },
    updatePassword: (id: string, hash: string, now: number) => void setPassword.run(hash, now, id),
    updateDisplayName: (id: string, name: string, now: number) => void setDisplayName.run(name, now, id),
    updateSettings: (id: string, settings: UserSettings, now: number) =>
      void setSettings.run(JSON.stringify(settings), now, id),
    setTotp: (id: string, sealedSecret: string | null, enabled: boolean, lastStep: number, now: number) =>
      void setTotp.run(sealedSecret, enabled ? 1 : 0, lastStep, now, id),
    /** Advances the replay guard; returns false if a newer-or-equal step was already accepted. */
    advanceTotpStep: (id: string, step: number): boolean => setTotpStep.run(step, id, step).changes > 0,
    remove: (id: string): boolean => remove.run(id).changes > 0
  }
}

export type UsersRepo = ReturnType<typeof createUsersRepo>
