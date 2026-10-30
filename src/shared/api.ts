// The typed contract between renderer and main process.
// Preload exposes `window.api: EBoardApi`; each method maps to the IPC channel `${namespace}:${method}`.

import type {
  BoardBundle,
  BoardChanges,
  BoardRecord,
  BoardTheme,
  CaseRecord,
  CasePriority,
  CaseStatus,
  Id,
  Language,
  MediaRef,
  PublicUser,
  StorageMode,
  UserSettings,
  Viewport
} from './types'

export type ErrorCode =
  | 'invalid_input'
  | 'username_taken'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'invalid_totp'
  | 'challenge_expired'
  | 'totp_not_started'
  | 'not_authenticated'
  | 'locked'
  | 'pin_locked'
  | 'invalid_pin'
  | 'not_found'
  | 'invalid_file'
  | 'file_too_large'
  | 'cloud_unavailable'
  | 'internal'

export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: ErrorCode
      /** i18n keys (e.g. "validation.letters_only") describing invalid fields. */
      details?: string[]
      /** For rate_limited: milliseconds until the next attempt is allowed. */
      retryAfterMs?: number
    }

export type LoginResult = { status: 'ok'; user: PublicUser } | { status: 'totp_required'; challenge: string }

export interface TotpSetup {
  secret: string
  otpauthUrl: string
  qrDataUrl: string
}

export interface CaseInput {
  title: string
  description: string
  category: string
  status: CaseStatus
  priority: CasePriority
  color: string
}

export interface EBoardApi {
  auth: {
    signup(input: {
      username: string
      password: string
      displayName: string
      storageMode: StorageMode
      language: Language
    }): Promise<Result<PublicUser>>
    login(input: { username: string; password: string }): Promise<Result<LoginResult>>
    verifyTotp(input: { challenge: string; code: string }): Promise<Result<PublicUser>>
    logout(): Promise<Result<null>>
    /** The signed-in user, or null. Also reports whether the session is locked. */
    me(): Promise<Result<{ user: PublicUser | null; locked: boolean }>>
    lock(): Promise<Result<null>>
    unlock(input: { password: string }): Promise<Result<null>>
    changePassword(input: { current: string; next: string }): Promise<Result<null>>
    updateProfile(input: { displayName: string }): Promise<Result<PublicUser>>
    updateSettings(patch: Partial<UserSettings>): Promise<Result<PublicUser>>
    /** Generates a new pending TOTP secret (not active until totpEnable succeeds). */
    totpBegin(): Promise<Result<TotpSetup>>
    totpEnable(input: { code: string }): Promise<Result<PublicUser>>
    totpDisable(input: { password: string; code: string }): Promise<Result<PublicUser>>
    deleteAccount(input: { password: string }): Promise<Result<null>>
  }
  cases: {
    list(): Promise<Result<CaseRecord[]>>
    create(input: CaseInput): Promise<Result<CaseRecord>>
    update(input: Partial<CaseInput> & { id: Id }): Promise<Result<CaseRecord>>
    remove(input: { id: Id }): Promise<Result<null>>
  }
  boards: {
    list(input: { caseId: Id }): Promise<Result<BoardRecord[]>>
    create(input: { caseId: Id; title: string; theme: BoardTheme }): Promise<Result<BoardRecord>>
    update(input: { id: Id; title?: string; theme?: BoardTheme; viewport?: Viewport }): Promise<Result<BoardRecord>>
    remove(input: { id: Id }): Promise<Result<null>>
    load(input: { id: Id }): Promise<Result<BoardBundle>>
    /** Atomically applies item/link upserts and deletes for one board. */
    applyChanges(changes: BoardChanges): Promise<Result<null>>
  }
  items: {
    /** Locks an item and protects it with a PIN (4-8 digits); every change is refused until it is unlocked. */
    lockWithPin(input: { boardId: Id; itemId: Id; pin: string }): Promise<Result<null>>
    /** Removes the lock (and the PIN) when the PIN is right; repeated failures are rate limited. */
    unlockWithPin(input: { boardId: Id; itemId: Id; pin: string }): Promise<Result<null>>
  }
  media: {
    /** Opens a native file dialog restricted to PNG/JPEG; null if the user cancelled. */
    pickImage(): Promise<Result<MediaRef | null>>
    /** For drag & drop / paste. Bytes are validated by magic number in the main process. */
    importImageBytes(input: { name: string; bytes: Uint8Array }): Promise<Result<MediaRef>>
  }
  system: {
    /** Opens an http(s) URL in the default browser. */
    openExternal(input: { url: string }): Promise<Result<null>>
    copyText(input: { text: string }): Promise<Result<null>>
    appInfo(): Promise<Result<{ version: string; platform: string; dataPath: string }>>
  }
}

/** Channel names, used by preload (to expose) and main (to register). Keep in sync with EBoardApi. */
export const API_CHANNELS = {
  auth: [
    'signup',
    'login',
    'verifyTotp',
    'logout',
    'me',
    'lock',
    'unlock',
    'changePassword',
    'updateProfile',
    'updateSettings',
    'totpBegin',
    'totpEnable',
    'totpDisable',
    'deleteAccount'
  ],
  cases: ['list', 'create', 'update', 'remove'],
  boards: ['list', 'create', 'update', 'remove', 'load', 'applyChanges'],
  items: ['lockWithPin', 'unlockWithPin'],
  media: ['pickImage', 'importImageBytes'],
  system: ['openExternal', 'copyText', 'appInfo']
} as const satisfies { [K in keyof EBoardApi]: readonly (keyof EBoardApi[K])[] }

// Compile-time completeness check: every API method has a channel.
type Missing = {
  [K in keyof EBoardApi]: Exclude<keyof EBoardApi[K], (typeof API_CHANNELS)[K][number]>
}[keyof EBoardApi]
export const _channelsComplete: [Missing] extends [never] ? true : never = true
