import { create } from 'zustand'
import { DEFAULT_SETTINGS, type PublicUser, type UserSettings } from '@shared/types'
import { api, call } from '@renderer/lib/api'

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated'

interface SessionState {
  status: SessionStatus
  user: PublicUser | null
  locked: boolean
  /** Re-reads the session from the main process. */
  refresh(): Promise<void>
  /** Called after a successful sign-up / login / 2FA verification. */
  signedIn(user: PublicUser): void
  /** Replace the cached user after profile / settings / 2FA changes. */
  setUser(user: PublicUser): void
  updateSettings(patch: Partial<UserSettings>): Promise<void>
  logout(): Promise<void>
  lock(): Promise<void>
  unlocked(): void
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  locked: false,

  async refresh() {
    try {
      const { user, locked } = await call(api.auth.me())
      set({ user, locked, status: user ? 'authenticated' : 'anonymous' })
    } catch {
      set({ user: null, locked: false, status: 'anonymous' })
    }
  },

  signedIn(user) {
    set({ user, locked: false, status: 'authenticated' })
  },

  setUser(user) {
    set({ user })
  },

  async updateSettings(patch) {
    const prev = get().user
    if (!prev) return
    // Optimistic so toggles feel instant; roll back on failure.
    set({ user: { ...prev, settings: { ...prev.settings, ...patch } } })
    try {
      set({ user: await call(api.auth.updateSettings(patch)) })
    } catch (e) {
      set({ user: prev })
      throw e
    }
  },

  async logout() {
    try {
      await call(api.auth.logout())
    } finally {
      set({ user: null, locked: false, status: 'anonymous' })
    }
  },

  async lock() {
    if (get().status !== 'authenticated') return
    await call(api.auth.lock())
    set({ locked: true })
  },

  unlocked() {
    set({ locked: false })
  }
}))

/** Current settings, or defaults while signed out. */
export const useSettings = (): UserSettings => useSession((s) => s.user?.settings ?? DEFAULT_SETTINGS)
