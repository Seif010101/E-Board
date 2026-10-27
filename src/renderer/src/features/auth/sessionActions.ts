// Session transitions shared by the profile menu, lock screen and auto-lock.

import type { UserSettings } from '@shared/types'
import { flush } from '@renderer/features/board/core/persistence'
import { usePrefs } from '@renderer/stores/prefs'
import { useSession } from '@renderer/stores/session'

/** Keep the signed-out screens in the language and theme the investigator last used. */
export function rememberDevicePrefs(settings: Pick<UserSettings, 'language' | 'appTheme'>): void {
  const prefs = usePrefs.getState()
  if (prefs.language !== settings.language || prefs.appTheme !== settings.appTheme) {
    prefs.set({ language: settings.language, appTheme: settings.appTheme })
  }
}

/** Saves pending board edits first: a locked session refuses writes, so they would otherwise wait. */
export async function lockSession(): Promise<void> {
  const { status, locked } = useSession.getState()
  if (status !== 'authenticated' || locked) return
  await flush()
  await useSession.getState().lock()
}

export async function signOut(): Promise<void> {
  const { user, locked } = useSession.getState()
  if (user) rememberDevicePrefs(user.settings)
  if (!locked) await flush()
  await useSession.getState().logout()
}
