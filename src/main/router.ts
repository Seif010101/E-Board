// Maps every IPC channel to: an access level, the zod schema for its payload, and a handler.
// Pure (no Electron): OS integrations arrive through `Platform`, so the whole pipeline is testable.

import type { z } from 'zod'
import { API_CHANNELS, type EBoardApi, type ErrorCode, type Result } from '@shared/api'
import type { Language, MediaRef } from '@shared/types'
import { MAX_ALBUM_FILES } from './media'
import { isHttpUrl, issueKeys, schemas } from '@shared/validation'
import type { Backend } from './backend'
import { AppError, fail } from './errors'

/**
 * any     – always allowed (me, logout)
 * guest   – no session needed, refused while a session is locked (signup, login, verifyTotp)
 * session – needs a session, allowed while locked (lock, unlock)
 * user    – needs an unlocked session (everything else)
 */
type Access = 'any' | 'guest' | 'session' | 'user'

export interface Platform {
  /** Native open dialog; resolves to the chosen path or null when cancelled. */
  pickImageFile(language: Language): Promise<string | null>
  /** Native multi-file dialog for album photos and videos; [] when cancelled. */
  pickAlbumFiles(language: Language): Promise<string[]>
  openExternal(url: string): Promise<void>
  copyText(text: string): void
  appInfo(): { version: string; platform: string; dataPath: string }
}

interface Route<T> {
  access: Access
  schema: z.ZodType | null
  run(input: unknown, userId: string | null): T | Promise<T>
}

type DataOf<F> = F extends (...args: never[]) => Promise<Result<infer D>> ? D : never

type Routes = { [N in keyof EBoardApi]: { [M in keyof EBoardApi[N]]: Route<DataOf<EBoardApi[N][M]>> } }

const open = <S extends z.ZodType, T>(access: 'any' | 'guest', schema: S | null, run: (input: z.output<S>) => T | Promise<T>): Route<T> => ({
  access,
  schema,
  run: (input) => run(input as z.output<S>)
})

const authed = <S extends z.ZodType, T>(
  access: 'session' | 'user',
  schema: S | null,
  run: (input: z.output<S>, userId: string) => T | Promise<T>
): Route<T> => ({
  access,
  schema,
  // The access check guarantees a user id before `run` is reached.
  run: (input, userId) => run(input as z.output<S>, userId as string)
})

export interface Router {
  has(channel: string): boolean
  dispatch(channel: string, payload: unknown): Promise<Result<unknown>>
}

export function createRouter(
  backend: Backend,
  platform: Platform,
  log: (message: string, err: unknown) => void = (m, e) => console.error(m, e)
): Router {
  const { auth, workspace, media, storage } = backend
  const needStorage = (): NonNullable<typeof storage> => storage ?? fail('internal')

  const languageOf = (): Language => auth.me().user?.settings.language ?? 'en'

  const routes: Routes = {
    auth: {
      signup: open('guest', schemas.signup, (i) => auth.signup(i)),
      login: open('guest', schemas.login, (i) => auth.login(i)),
      verifyTotp: open('guest', schemas.verifyTotp, (i) => auth.verifyTotp(i)),
      logout: open('any', null, () => auth.logout()),
      me: open('any', null, () => auth.me()),
      lock: authed('session', null, () => auth.lock()),
      unlock: authed('session', schemas.unlock, (i) => auth.unlock(i)),
      changePassword: authed('user', schemas.changePassword, (i) => auth.changePassword(i)),
      updateProfile: authed('user', schemas.updateProfile, (i) => auth.updateProfile(i)),
      updateSettings: authed('user', schemas.updateSettings, (i) => auth.updateSettings(i)),
      totpBegin: authed('user', null, () => auth.totpBegin()),
      totpEnable: authed('user', schemas.totpEnable, (i) => auth.totpEnable(i)),
      totpDisable: authed('user', schemas.totpDisable, (i) => auth.totpDisable(i)),
      deleteAccount: authed('user', schemas.deleteAccount, (i) => auth.deleteAccount(i))
    },
    cases: {
      list: authed('user', null, (_i, uid) => workspace.listCases(uid)),
      create: authed('user', schemas.caseCreate, (i, uid) => workspace.createCase(uid, i)),
      update: authed('user', schemas.caseUpdate, (i, uid) => workspace.updateCase(uid, i)),
      remove: authed('user', schemas.byId, (i, uid) => workspace.removeCase(uid, i.id))
    },
    boards: {
      list: authed('user', schemas.boardList, (i, uid) => workspace.listBoards(uid, i.caseId)),
      create: authed('user', schemas.boardCreate, (i, uid) => workspace.createBoard(uid, i)),
      update: authed('user', schemas.boardUpdate, (i, uid) => workspace.updateBoard(uid, i)),
      remove: authed('user', schemas.byId, (i, uid) => workspace.removeBoard(uid, i.id)),
      load: authed('user', schemas.byId, (i, uid) => workspace.loadBoard(uid, i.id)),
      applyChanges: authed('user', schemas.boardChanges, (i, uid) => workspace.applyChanges(uid, i))
    },
    items: {
      lockWithPin: authed('user', schemas.itemPin, (i, uid) => workspace.lockItemWithPin(uid, i)),
      unlockWithPin: authed('user', schemas.itemPin, (i, uid) => workspace.unlockItemWithPin(uid, i))
    },
    media: {
      pickImage: authed('user', null, async (_i, uid) => {
        const path = await platform.pickImageFile(languageOf())
        if (!path) return null
        // The dialog may stay open for a long time; the session could have been locked or ended meanwhile.
        const state = auth.state()
        if (state.userId !== uid) fail('not_authenticated')
        if (state.locked) fail('locked')
        return media.importFile(uid, path)
      }),
      importImageBytes: authed('user', schemas.importImageBytes, (i, uid) => media.importBytes(uid, i.name, i.bytes)),
      pickAlbumFiles: authed('user', null, async (_i, uid) => {
        const paths = await platform.pickAlbumFiles(languageOf())
        const state = auth.state()
        if (state.userId !== uid) fail('not_authenticated')
        if (state.locked) fail('locked')
        // Many files at once are fine, but not an unbounded number.
        if (paths.length > MAX_ALBUM_FILES) fail('invalid_input')
        const added: MediaRef[] = []
        for (const path of paths) added.push(await media.importFile(uid, path, true))
        return added
      })
    },
    storage: {
      status: open('any', null, () => storage?.status() ?? { mode: 'local' as const, available: true, drivePath: null }),
      useDrive: open('guest', null, () => needStorage().useDrive()),
      useLocal: open('guest', null, () => needStorage().useLocal()),
      moveData: authed('user', schemas.moveData, (i) => needStorage().moveData(i.target))
    },
    system: {
      openExternal: authed('user', schemas.openExternal, async (i) => {
        if (!isHttpUrl(i.url)) fail('invalid_input', ['validation.invalid_url'])
        await platform.openExternal(i.url)
        return null
      }),
      copyText: authed('user', schemas.copyText, (i) => {
        platform.copyText(i.text)
        return null
      }),
      appInfo: authed('user', null, () => platform.appInfo())
    }
  }

  const table = new Map<string, Route<unknown>>()
  for (const [ns, methods] of Object.entries(routes) as [string, Record<string, Route<unknown>>][]) {
    for (const [method, route] of Object.entries(methods)) table.set(`${ns}:${method}`, route)
  }
  // Runtime guard on top of the compile-time one: the preload exposes exactly API_CHANNELS.
  for (const [ns, methods] of Object.entries(API_CHANNELS)) {
    for (const method of methods) {
      if (!table.has(`${ns}:${method}`)) throw new Error(`No IPC handler for ${ns}:${method}`)
    }
  }

  const denied = (access: Access): ErrorCode | null => {
    const { userId, locked } = auth.state()
    switch (access) {
      case 'any':
        return null
      case 'guest':
        return locked ? 'locked' : null
      case 'session':
        return userId ? null : 'not_authenticated'
      case 'user':
        return !userId ? 'not_authenticated' : locked ? 'locked' : null
    }
  }

  return {
    has: (channel) => table.has(channel),

    async dispatch(channel, payload) {
      const route = table.get(channel)
      if (!route) return { ok: false, error: 'not_found' }
      try {
        const refusal = denied(route.access)
        if (refusal) return { ok: false, error: refusal }

        let input: unknown
        if (route.schema) {
          const parsed = route.schema.safeParse(payload)
          if (!parsed.success) return { ok: false, error: 'invalid_input', details: issueKeys(parsed.error) }
          input = parsed.data
        } else if (payload !== undefined && payload !== null) {
          // Payload-less methods take nothing; an omitted argument may arrive as undefined or null.
          return { ok: false, error: 'invalid_input' }
        }

        const data = await route.run(input, auth.state().userId)
        return { ok: true, data }
      } catch (err) {
        if (err instanceof AppError) {
          return {
            ok: false,
            error: err.code,
            ...(err.details?.length ? { details: err.details } : {}),
            ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {})
          }
        }
        log(`IPC ${channel} failed`, err)
        return { ok: false, error: 'internal' }
      }
    }
  }
}

/**
 * Router used while the drive holding the data is not plugged in: there is no database, so only the
 * storage questions are answered; everything else says the drive is missing.
 */
export function createWaitingRouter(storage: NonNullable<Backend['storage']>): Router {
  const answers: Record<string, () => unknown> = {
    'storage:status': () => storage.status(),
    'storage:useDrive': () => storage.useDrive(),
    'storage:useLocal': () => storage.useLocal()
  }
  return {
    has: (channel) => channel in answers || API_CHANNELS_SET.has(channel),
    async dispatch(channel, payload) {
      void payload
      const answer = answers[channel]
      if (!answer) return { ok: false, error: 'drive_missing' }
      try {
        return { ok: true, data: await answer() }
      } catch (err) {
        return err instanceof AppError ? { ok: false, error: err.code, details: err.details } : { ok: false, error: 'internal' }
      }
    }
  }
}

const API_CHANNELS_SET = new Set(Object.entries(API_CHANNELS).flatMap(([ns, methods]) => methods.map((m) => `${ns}:${m}`)))
